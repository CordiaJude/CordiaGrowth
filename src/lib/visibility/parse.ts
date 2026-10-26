import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { aiConfig } from "../../config/ai";
import { anthropic, fallbackParams } from "../ai/anthropic";
import { costFor, type Usage } from "../ai/pricing";
import { brandNames, mentionsAny } from "./brand-match";

export type Brand = { name: string; aliases: string[]; domains: string[] };
export type Competitor = { name: string; aliases: string[]; domain: string | null };

export const ParsedAnswerSchema = z.object({
  is_list: z
    .boolean()
    .describe("True if the answer recommends businesses as a numbered or bulleted list or a ranking."),
  businesses: z
    .array(
      z.object({
        name: z.string().describe("Business or brand name exactly as written in the answer."),
        position: z
          .number()
          .int()
          .nullable()
          .describe(
            "1-based order among recommended businesses, in the order they appear. null if not recommended.",
          ),
        is_our_brand: z
          .boolean()
          .describe("True only if this is the target brand (by name, alias or domain)."),
        competitor: z
          .string()
          .nullable()
          .describe(
            "If this is one of the listed competitors, that competitor's name exactly as listed; else null.",
          ),
      }),
    )
    .describe("Every business, brand or service provider named in the answer, in order of appearance."),
});

export type ParsedAnswer = z.infer<typeof ParsedAnswerSchema>;

export type Entity = {
  name: string;
  position: number | null;
  kind: "brand" | "competitor" | "other";
  competitor: string | null;
};

export type AnswerAnalysis = {
  brandMentioned: boolean;
  brandPosition: number | null;
  listedCount: number;
  competitorsMentioned: string[];
  entities: Entity[];
  ourDomainCited: boolean;
};

const SYSTEM = `You extract structured data from an AI assistant's answer, to measure which businesses AI assistants recommend.

Rules:
- Only report businesses whose names literally appear in the answer text. Never add, infer or correct names.
- Positions count recommended businesses in the order the answer presents them, starting at 1. Businesses that are only mentioned in passing (for example "unlike X") get position null.
- is_our_brand is true only for the target brand, matched by its name, an alias, or its domain.
- competitor must be copied exactly from the competitor list, or null.
- If the answer recommends no businesses, return an empty list.`;

/** Asks Claude to extract businesses from an answer. Returns null parse on refusal. */
export async function parseAnswerWithClaude(input: {
  prompt: string;
  answer: string;
  brand: Brand;
  competitors: Competitor[];
}): Promise<{ parsed: ParsedAnswer | null; model: string; usage: Usage; costUsd: number }> {
  const model = aiConfig().parser.model;
  const competitorList = input.competitors.length
    ? input.competitors
        .map(
          (c) =>
            `- ${c.name}${c.aliases.length ? ` (also: ${c.aliases.join(", ")})` : ""}${c.domain ? ` [${c.domain}]` : ""}`,
        )
        .join("\n")
    : "(none listed)";

  const response = await anthropic().beta.messages.parse({
    model,
    max_tokens: 4000,
    ...fallbackParams(model),
    output_config: { effort: aiConfig().parser.effort, format: betaZodOutputFormat(ParsedAnswerSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `<target_brand>
Name: ${input.brand.name}
Aliases: ${input.brand.aliases.join(", ") || "(none)"}
Domains: ${input.brand.domains.join(", ") || "(none)"}
</target_brand>

<competitors>
${competitorList}
</competitors>

<question>${input.prompt}</question>

<answer>
${input.answer}
</answer>`,
      },
    ],
  });

  const usage: Usage = {
    inputTokens:
      response.usage.input_tokens +
      (response.usage.cache_read_input_tokens ?? 0) +
      (response.usage.cache_creation_input_tokens ?? 0),
    outputTokens: response.usage.output_tokens,
    searchRequests: 0,
  };
  const servedBy = response.model;
  const parsed = response.stop_reason === "refusal" ? null : (response.parsed_output ?? null);
  return { parsed, model: servedBy, usage, costUsd: costFor(servedBy, usage) };
}

/**
 * Combines the LLM extraction with deterministic checks:
 * - entities whose names don't appear in the answer are dropped (no hallucinated mentions)
 * - competitor labels must match the configured list
 * - a literal brand/competitor name match counts as a mention even if the parser missed it
 */
export function analyzeAnswer(input: {
  answer: string;
  parsed: ParsedAnswer | null;
  brand: Brand;
  competitors: Competitor[];
  citedDomains: string[];
}): AnswerAnalysis {
  const { answer, brand, competitors } = input;
  const ourNames = brandNames(brand);
  const competitorByName = new Map(competitors.map((c) => [c.name.toLowerCase(), c]));

  const entities: Entity[] = [];
  for (const b of input.parsed?.businesses ?? []) {
    const name = b.name.trim();
    if (!name || !mentionsAny(answer, [name])) continue;
    const isOurs = b.is_our_brand && (mentionsAny(name, ourNames) || mentionsAny(answer, ourNames));
    const competitor =
      !isOurs && b.competitor ? (competitorByName.get(b.competitor.toLowerCase())?.name ?? null) : null;
    entities.push({
      name,
      position: b.position != null && b.position >= 1 ? b.position : null,
      kind: isOurs ? "brand" : competitor ? "competitor" : "other",
      competitor,
    });
  }

  // Re-number positions 1..n in the parser's order so gaps from dropped names close.
  const ranked = entities.filter((e) => e.position != null).sort((a, b) => a.position! - b.position!);
  ranked.forEach((e, i) => (e.position = i + 1));

  const brandEntity = entities.find((e) => e.kind === "brand");
  const brandMentioned = Boolean(brandEntity) || mentionsAny(answer, ourNames);

  const competitorsMentioned = new Set(entities.filter((e) => e.competitor).map((e) => e.competitor!));
  for (const c of competitors) {
    if (
      mentionsAny(
        answer,
        brandNames({ name: c.name, aliases: c.aliases, domains: c.domain ? [c.domain] : [] }),
      )
    ) {
      competitorsMentioned.add(c.name);
    }
  }

  const ownDomains = brand.domains.map((d) => d.toLowerCase());
  const ourDomainCited = input.citedDomains.some((d) =>
    ownDomains.some((o) => d === o || d.endsWith(`.${o}`)),
  );

  return {
    brandMentioned,
    brandPosition: ranked.find((e) => e.kind === "brand")?.position ?? null,
    listedCount: ranked.length,
    competitorsMentioned: [...competitorsMentioned].sort(),
    entities,
    ourDomainCited,
  };
}
