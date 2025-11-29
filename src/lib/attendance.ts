import JSZip from 'jszip';

import type { SlotAttendance } from '@/types';

// Read a ZIP file and return the JSZip instance
export async function loadZip(file: File) {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  return zip;
}

// Read existing attendance JSON for a given slot from internal folder, if present
export async function readSlotAttendance(
  zip: JSZip,
  day: number,
  slot: number
): Promise<SlotAttendance | null> {
  const filename = `internal/attendance-day${day}-slot${slot}.json`;
  const f = zip.file(filename);
  if (!f) return null;
  try {
    const text = await f.async('string');
    const obj = JSON.parse(text) as SlotAttendance;
    return obj;
  } catch (err) {
    console.warn('Failed to parse attendance file', filename, err);
    return null;
  }
}

// Read assignments exported inside the ZIP at internal/assignment.json and return entries for the slot
export async function readAssignmentsFromZip(
  zip: JSZip,
  day: number,
  slot: number
): Promise<Array<{ facultyId: string; role: string }>> {
  const f = zip.file('internal/assignment.json') || zip.file('assignment.json');
  if (!f) return [];
  try {
    const text = await f.async('string');
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (a: any) =>
          Number(a.day) === Number(day) && Number(a.slot) === Number(slot)
      )
      .map((a: any) => ({
        facultyId: String(a.facultyId || ''),
        role: String(a.role || 'regular'),
      }));
  } catch (err) {
    console.warn('Failed to read assignment.json from zip', err);
    return [];
  }
}

// Read metadata.json (internal/metadata.json or metadata.json) and return duty slot summaries
export async function readMetadataSlots(zip: JSZip): Promise<any[]> {
  const f = zip.file('internal/metadata.json') || zip.file('metadata.json');
  if (!f) return [];
  try {
    const text = await f.async('string');
    const obj = JSON.parse(text);
    const slots = Array.isArray(obj.slots)
      ? obj.slots
      : obj.dutySlots && Array.isArray(obj.dutySlots)
        ? obj.dutySlots
        : [];
    return slots.map((s: any) => ({
      day: Number(s.day),
      slot: Number(s.slot),
      date:
        s.date ||
        (s.date && typeof s.date === 'string'
          ? s.date
          : new Date().toISOString()),
      startTime: s.startTime || s.start || '',
      endTime: s.endTime || s.end || '',
      regularDuties: Number(s.regularDuties || s.regular || 0),
      relieverDuties: Number(s.relieverDuties || 0),
      squadDuties: Number(s.squadDuties || 0),
      bufferDuties: Number(s.bufferDuties || 0),
    }));
  } catch (err) {
    console.warn('Failed to parse metadata.json from zip', err);
    return [];
  }
}

// Save attendance object into the zip (mutates zip) and update last_modified.txt
export async function saveSlotAttendance(
  zip: JSZip,
  attendance: SlotAttendance
): Promise<void> {
  const filename = `internal/attendance-day${attendance.day}-slot${attendance.slot}.json`;
  attendance.updatedAt = new Date().toISOString();
  if (!attendance.createdAt) attendance.createdAt = new Date().toISOString();
  zip.file(filename, JSON.stringify(attendance, null, 2));

  // update last_modified.txt at root and internal/last_modified.txt
  const ts = new Date().toISOString();
  try {
    zip.file('last_modified.txt', ts);
    zip.file('internal/last_modified.txt', ts);
  } catch (err) {
    // ignore
  }
}

// Generate a Blob for the ZIP so it can be downloaded
export async function generateZipBlob(zip: JSZip) {
  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

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
