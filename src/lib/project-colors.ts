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
    bg: 'bg-red-500/15',
    fg: 'text-red-600 dark:text-red-400',
    swatch: 'bg-red-500',
    label: 'Red',
  },
  orange: {
    bg: 'bg-orange-500/15',
    fg: 'text-orange-600 dark:text-orange-400',
    swatch: 'bg-orange-500',
    label: 'Orange',
  },
  amber: {
    bg: 'bg-amber-500/15',
    fg: 'text-amber-600 dark:text-amber-400',
    swatch: 'bg-amber-500',
    label: 'Amber',
  },
  green: {
    bg: 'bg-emerald-500/15',
    fg: 'text-emerald-600 dark:text-emerald-400',
    swatch: 'bg-emerald-500',
    label: 'Green',
  },
  blue: {
    bg: 'bg-blue-500/15',
    fg: 'text-blue-600 dark:text-blue-400',
    swatch: 'bg-blue-500',
    label: 'Blue',
  },
  purple: {
    bg: 'bg-purple-500/15',
    fg: 'text-purple-600 dark:text-purple-400',
    swatch: 'bg-purple-500',
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
