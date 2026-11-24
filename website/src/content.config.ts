import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { referenceLoader } from "./reference/loader.ts";

export const collections = {
  // Hand-written pages from src/content/docs/, plus the reference pages generated from the repo.
  docs: defineCollection({
    loader: referenceLoader(docsLoader()),
    schema: docsSchema({ extend: z.object({ generated: z.boolean().optional() }) }),
  }),
};
