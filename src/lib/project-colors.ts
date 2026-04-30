import type { Project, ProjectColor } from '@/types';

import { PROJECT_COLORS } from '@/types';

interface ColorClasses {
  // Solid tinted background for the icon tile.
  bg: string;
  // Foreground color for the icon glyph.
  fg: string;
  // Soft swatch used in the color picker preview.
  swatch: string;
  // Human-readable label.
  label: string;
}

// Static map so Tailwind's JIT keeps every class in the final bundle.
export const PROJECT_COLOR_CLASSES: Record<ProjectColor, ColorClasses> = {
  red: {
    bg: 'bg-red-900/40',
    fg: 'text-red-600 dark:text-red-400/80',
    swatch: 'bg-red-600',
    label: 'Red',
  },
  orange: {
    bg: 'bg-orange-900/40',
    fg: 'text-orange-600 dark:text-orange-400/80',
    swatch: 'bg-orange-600',
    label: 'Orange',
  },
  amber: {
    bg: 'bg-amber-900/40',
    fg: 'text-amber-600 dark:text-amber-400/80',
    swatch: 'bg-amber-600',
    label: 'Amber',
  },
  green: {
    bg: 'bg-emerald-900/40',
    fg: 'text-emerald-600 dark:text-emerald-400/80',
    swatch: 'bg-emerald-600',
    label: 'Green',
  },
  blue: {
    bg: 'bg-blue-900/40',
    fg: 'text-blue-600 dark:text-blue-400/80',
    swatch: 'bg-blue-600',
    label: 'Blue',
  },
  purple: {
    bg: 'bg-purple-900/40',
    fg: 'text-purple-600 dark:text-purple-400/80',
    swatch: 'bg-purple-600',
    label: 'Purple',
  },
};

export function randomProjectColor(): ProjectColor {
  const idx = Math.floor(Math.random() * PROJECT_COLORS.length);
  return PROJECT_COLORS[idx];
}

// Stable color from a string. Used as a default for legacy records that were
// persisted before the `color` field existed, so they still render with a
// consistent accent until the user explicitly picks one.
export function colorFromKey(key: string): ProjectColor {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % PROJECT_COLORS.length;
  return PROJECT_COLORS[idx];
}

export function resolveProjectColor(project: Project): ProjectColor {
  if (project.color && PROJECT_COLORS.includes(project.color)) {
    return project.color;
  }
  return colorFromKey(project.slug || project.id);
}

export function projectColorClasses(project: Project): ColorClasses {
  return PROJECT_COLOR_CLASSES[resolveProjectColor(project)];
}
