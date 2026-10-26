import type { Database } from "@/lib/supabase/database.types";

type CmsType = Database["public"]["Enums"]["cms_type"];

export const CMS_TYPES: { value: CmsType; label: string }[] = [
  { value: "wordpress", label: "WordPress" },
  { value: "webflow", label: "Webflow" },
  { value: "shopify", label: "Shopify" },
  { value: "squarespace", label: "Squarespace" },
  { value: "wix", label: "Wix" },
  { value: "custom", label: "Custom / hand-built" },
  { value: "other", label: "Other / not sure" },
];

export function cmsLabel(value: string): string {
  return CMS_TYPES.find((c) => c.value === value)?.label ?? value;
}
