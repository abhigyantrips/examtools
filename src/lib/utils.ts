import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Faculty } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Canonical, deterministic comparator for faculty:
// 1) designation A→Z
// 2) facultyName A→Z
// 3) facultyId A→Z
export function facultyCompare(
  a: Faculty | undefined,
  b: Faculty | undefined
): number {
  const da = a?.designation ?? '';
  const db = b?.designation ?? '';
  if (da !== db) return da.localeCompare(db);

  const na = a?.facultyName ?? '';
  const nb = b?.facultyName ?? '';
  if (na !== nb) return na.localeCompare(nb);

  const ia = a?.facultyId ?? '';
  const ib = b?.facultyId ?? '';
  return ia.localeCompare(ib);
}
