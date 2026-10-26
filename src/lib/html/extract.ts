import * as cheerio from "cheerio";

export type PageSummary = {
  title: string | null;
  metaDescription: string | null;
  headings: string[];
  text: string;
};

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Title, meta description, headings and visible body text (capped) from HTML. */
export function summarizeHtml(html: string, maxText = 4000): PageSummary {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, template").remove();
  const title = clean($("title").first().text()) || null;
  const metaDescription = clean($('meta[name="description"]').attr("content") ?? "") || null;
  const headings = $("h1, h2, h3")
    .map((_, el) => clean($(el).text()))
    .get()
    .filter(Boolean)
    .slice(0, 30);
  const text = clean($("body").text()).slice(0, maxText);
  return { title, metaDescription, headings, text };
}
