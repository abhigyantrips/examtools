import type { Faculty, SlotAttendance } from '@/types';

export {
  readSlotAttendance,
  readAssignmentsFromZip,
  readMetadataSlots,
  readMetadataFaculty,
  saveSlotAttendance,
} from './json-files';

// Helper to create an empty attendance template for a slot
export function createEmptyAttendance(
  day: number,
  slot: number,
  date: string,
  time?: string
): SlotAttendance {
  return {
    day,
    slot,
    date,
    time,
    entries: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Re-export types for convenience
export type { Faculty, SlotAttendance };
