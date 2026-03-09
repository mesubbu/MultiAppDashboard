import { z } from 'zod';

import type { GraphLayoutMode } from '@/lib/graph-layouts';

const savedGraphPresetSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(60),
  presetId: z.string().trim().min(1),
  query: z.string().max(160).default(''),
  focusId: z.string().trim().min(1).optional(),
  layoutMode: z.enum(['radial', 'hierarchical', 'force-directed'] satisfies GraphLayoutMode[]),
  savedAt: z.string(),
});

const savedGraphPresetListSchema = z.array(savedGraphPresetSchema);

export type SavedGraphPreset = z.infer<typeof savedGraphPresetSchema>;

export function getSavedGraphPresetStorageKey(userId: string) {
  return `knowledge-graph-presets:${userId}`;
}

export function parseSavedGraphPresets(rawValue: string | null | undefined): SavedGraphPreset[] {
  if (!rawValue) return [];
  try {
    return savedGraphPresetListSchema.parse(JSON.parse(rawValue));
  } catch {
    return [];
  }
}