import type JSZip from 'jszip';

// Read unique roles from assignment.json inside the ZIP and return RenumerationRoleEntry[]
import type { RenumerationRoleEntry } from '@/types';

import { readTextFile } from './zip';
import { capitalize } from './utils';

export {
  readSlotAttendance,
  readAssignmentsFromZip,
  readMetadataSlots,
  readMetadataFaculty,
  saveSlotAttendance,
} from './json-files';

export async function readRolesFromZip(
  zip: JSZip
): Promise<RenumerationRoleEntry[]> {
  try {
    // read all assignments and collect unique roles
    const assignments = await (async () => {
      try {
        const txt =
          (await readTextFile(zip as any, 'internal/assignment.json')) ||
          (await readTextFile(zip as any, 'assignment.json'));
        if (!txt) return [] as any[];
        try {
          const arr = JSON.parse(txt);
          if (!Array.isArray(arr)) return [] as any[];
          return arr;
        } catch (err) {
          return [] as any[];
        }
      } catch (err) {
        return [] as any[];
      }
    })();

    const uniq = new Set<string>();
    for (const a of assignments) {
      if (a && a.role) uniq.add(String(a.role));
    }

    const out: RenumerationRoleEntry[] = Array.from(uniq).map((r, i) => ({
      id: Math.random().toString(36).slice(2, 9),
      name: capitalize(r),
      rate: 0,
      order: i,
      imported: true,
    }));

    return out;
  } catch (err) {
    return [];
  }
}
