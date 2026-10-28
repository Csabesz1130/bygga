import type { MetadataRoute } from "next";
import { PRODUCTS } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/browse`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/kit`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...PRODUCTS.map((p) => ({ url: `${SITE_URL}/build/${p.slug}`, changeFrequency: "monthly" as const, priority: p.featured ? 0.9 : p.checked ? 0.7 : 0.5 })),
  ];
}
