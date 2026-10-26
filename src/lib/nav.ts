import {
  BarChart3Icon,
  BotIcon,
  FileTextIcon,
  GaugeIcon,
  type LucideIcon,
  MegaphoneIcon,
  SearchIcon,
  SettingsIcon,
  WrenchIcon,
} from "lucide-react";

export type SiteSection = {
  slug: string;
  title: string;
  icon: LucideIcon;
  phase?: number;
  summary: string;
};

/** Per-site navigation. `phase` marks sections that aren't built yet. */
export const SITE_SECTIONS: SiteSection[] = [
  { slug: "", title: "Overview", icon: GaugeIcon, summary: "Site status and recent jobs." },
  {
    slug: "visibility",
    title: "AI visibility",
    icon: BotIcon,
    summary:
      "Track how often ChatGPT, Claude, Gemini and Perplexity mention and cite this business, with sample sizes and date ranges.",
  },
  {
    slug: "audit",
    title: "Site audit",
    icon: WrenchIcon,
    phase: 2,
    summary:
      "Crawl the site, check AI crawler access and schema, connect Search Console, and get a prioritized fix list.",
  },
  {
    slug: "keywords",
    title: "Keywords & plan",
    icon: SearchIcon,
    phase: 3,
    summary:
      "Quick wins from Search Console, keyword clusters, cannibalization checks and a content calendar.",
  },
  {
    slug: "content",
    title: "Content",
    icon: FileTextIcon,
    phase: 4,
    summary:
      "Briefs, first-party inputs, drafts with quality gates, a review queue, and WordPress publishing.",
  },
  {
    slug: "authority",
    title: "Authority",
    icon: MegaphoneIcon,
    phase: 5,
    summary:
      "White-hat off-site work: unlinked mentions, directory listings, AI-cited sources and PR pitches.",
  },
  {
    slug: "reports",
    title: "Reports",
    icon: BarChart3Icon,
    phase: 6,
    summary: "Trends across Search Console, rankings, AI share of voice and content performance.",
  },
  {
    slug: "settings",
    title: "Settings",
    icon: SettingsIcon,
    summary: "Publishing, budget and cadence settings for this site.",
  },
];
