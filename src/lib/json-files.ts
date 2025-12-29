import type JSZip from 'jszip';

import type {
  Assignment,
  AssignmentJson,
  Faculty,
  JsonSlot,
  MetadataJson,
  SlotAttendance,
  UnavailableFaculty,
} from '@/types';

import { loadZip, readTextFile, writeTextFile } from './zip';

// Read existing attendance JSON for a given slot from internal folder, if present
export async function readSlotAttendance(
  zip: JSZip,
  day: number,
  slot: number
): Promise<SlotAttendance | null> {
  const filename = `internal/attendance-day${day}-slot${slot}.json`;
  const text = await readTextFile(zip as any, filename);
  if (!text) return null;
  try {
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
  const text = await readTextFile(zip as any, 'internal/assignment.json') || await readTextFile(zip as any, 'assignment.json');
  if (!text) return [];
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (a: any) => Number(a.day) === Number(day) && Number(a.slot) === Number(slot)
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
  const text = await readTextFile(zip as any, 'internal/metadata.json') || await readTextFile(zip as any, 'metadata.json');
  if (!text) return [];
  try {
    const obj = JSON.parse(text);
    const slots = Array.isArray(obj.slots)
      ? obj.slots
      : obj.dutySlots && Array.isArray(obj.dutySlots)
        ? obj.dutySlots
        : [];
    return slots.map((s: any) => ({
      day: Number(s.day),
      slot: Number(s.slot),
      date: s.date || (s.date && typeof s.date === 'string' ? s.date : new Date().toISOString()),
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

// Read metadata faculty list from internal/metadata.json
export async function readMetadataFaculty(zip: JSZip): Promise<Array<Faculty>> {
  const text = await readTextFile(zip as any, 'internal/metadata.json') || await readTextFile(zip as any, 'metadata.json');
  if (!text) return [];
  try {
    const obj = JSON.parse(text);
    const facultyList = Array.isArray(obj.faculty) ? obj.faculty : Array.isArray(obj.facultyList) ? obj.facultyList : [];
    return facultyList.map((f: any, index: number) => ({
      sNo: Number(f.sNo || index + 1),
      facultyName: String(f.facultyName || ''),
      facultyId: String(f.facultyId || ''),
      designation: String(f.designation || ''),
      department: String(f.department || ''),
      phoneNo: String(f.phoneNo || ''),
    }));
  } catch (err) {
    console.warn('Failed to parse metadata.json from zip', err);
    return [];
  }
}

// Save attendance object into the zip (mutates zip) and update last_modified.txt
export async function saveSlotAttendance(zip: JSZip, attendance: SlotAttendance): Promise<void> {
  const filename = `internal/attendance-day${attendance.day}-slot${attendance.slot}.json`;
  attendance.updatedAt = new Date().toISOString();
  if (!attendance.createdAt) attendance.createdAt = new Date().toISOString();
  writeTextFile(zip as any, filename, JSON.stringify(attendance, null, 2));

  // update last_modified.txt at root and internal/last_modified.txt
  const ts = new Date().toISOString();
  try {
    writeTextFile(zip as any, 'last_modified.txt', ts);
    writeTextFile(zip as any, 'internal/last_modified.txt', ts);
  } catch (err) {
    // ignore
  }
}

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

// -------------------------
// Metadata import helpers
// -------------------------

export interface ImportedMetadata {
  faculty: Faculty[];
  examStructure: {
    days: number;
    dutySlots: any[]; // DutySlot[]
    designationDutyCounts: Record<string, number>;
  };
  unavailability: UnavailableFaculty[];
}

function buildExamStructureFromSlots(slots: JsonSlot[]): {
  days: number;
  dutySlots: any[];
  designationDutyCounts: Record<string, number>;
} {
  const dutySlots: any[] = (slots || []).map((s) => ({
    day: s.day,
    slot: s.slot,
    date: new Date(s.date),
    startTime: s.startTime,
    subjectCode: s.subjectCode || '',
    endTime: s.endTime,
    regularDuties: s.regularDuties,
    relieverDuties: s.relieverDuties,
    squadDuties: s.squadDuties,
    bufferDuties: s.bufferDuties,
    rooms: Array.isArray(s.rooms) ? s.rooms.slice() : [],
  }));

  const maxDay = dutySlots.reduce((acc, ds) => Math.max(acc, ds.day), 0);
  return {
    days: maxDay >= 0 ? maxDay + 1 : 0,
    dutySlots,
    designationDutyCounts: {},
  };
}

function parseMetadataObject(obj: MetadataJson): ImportedMetadata {
  const faculty: Faculty[] = Array.isArray(obj.faculty)
    ? obj.faculty.map((f, idx) => ({
        sNo: idx + 1,
        facultyName: f.facultyName,
        facultyId: f.facultyId,
        designation: f.designation,
        department: f.department,
        phoneNo: f.phoneNo,
      }))
    : [];

  const unavailability: UnavailableFaculty[] = Array.isArray(obj.unavailable)
    ? obj.unavailable.map((u) => ({
        facultyId: u.facultyId,
        date: u.date,
      }))
    : [];

  const examStructure = buildExamStructureFromSlots(
    Array.isArray(obj.slots) ? obj.slots : []
  );
  if (
    obj.designationDutyCounts &&
    typeof obj.designationDutyCounts === 'object'
  ) {
    examStructure.designationDutyCounts = {
      ...(obj.designationDutyCounts || {}),
    };
  }
  if (
    obj.designationRelieverCounts &&
    typeof obj.designationRelieverCounts === 'object'
  ) {
    (examStructure as any).designationRelieverCounts = {
      ...(obj.designationRelieverCounts || {}),
    };
  }
  if (
    obj.designationSquadCounts &&
    typeof obj.designationSquadCounts === 'object'
  ) {
    (examStructure as any).designationSquadCounts = {
      ...(obj.designationSquadCounts || {}),
    };
  }
  if (
    obj.designationBufferEligibility &&
    typeof obj.designationBufferEligibility === 'object'
  ) {
    (examStructure as any).designationBufferEligibility = {
      ...(obj.designationBufferEligibility || {}),
    };
  }

  return { faculty, examStructure, unavailability };
}

export interface ImportedData extends ImportedMetadata {
  assignments: Assignment[];
}

export async function importDataFromZip(file: File): Promise<ImportedData> {
  const zip = await loadZip(file as File);

  const metadataContent = await readTextFile(
    zip as any,
    'internal/metadata.json'
  );
  const assignmentContent = await readTextFile(
    zip as any,
    'internal/assignment.json'
  );

  if (!metadataContent || !assignmentContent) {
    throw new Error(
      'Missing required internal files (metadata.json or assignment.json)'
    );
  }

  let metadataJson: MetadataJson;
  let assignmentJson: AssignmentJson[];

  try {
    metadataJson = JSON.parse(metadataContent);
    assignmentJson = JSON.parse(assignmentContent);
  } catch (e) {
    throw new Error('Failed to parse JSON files');
  }

  if (
    !metadataJson.type ||
    !Array.isArray(metadataJson.slots) ||
    !Array.isArray(metadataJson.faculty)
  ) {
    throw new Error('Invalid metadata.json structure');
  }
  if (!Array.isArray(assignmentJson)) {
    throw new Error('Invalid assignment.json structure');
  }

  const metadata = parseMetadataObject(metadataJson);

  const assignments: Assignment[] = assignmentJson.map((a) => ({
    day: a.day,
    slot: a.slot,
    facultyId: a.facultyId,
    role: a.role,
    roomNumber: a.roomNumber || undefined,
    rooms: a.rooms || undefined,
  }));

  return {
    ...metadata,
    assignments,
  };
}

export async function importMetadataFromJsonFile(
  file: File
): Promise<ImportedMetadata> {
  const text = await file.text();
  const obj = JSON.parse(text) as MetadataJson;
  return parseMetadataObject(obj);
}

export async function importMetadataFromZipFile(
  file: File
): Promise<ImportedMetadata> {
  const zip = await loadZip(file as File);
  const candidates = ['internal/metadata.json', 'metadata.json'];
  let content: string | null = null;
  for (const p of candidates) {
    const txt = await readTextFile(zip as any, p);
    if (txt) {
      content = txt;
      break;
    }
  }
  if (!content)
    throw new Error(
      'metadata.json not found in ZIP (searched internal/metadata.json and metadata.json)'
    );
  const obj = JSON.parse(content) as MetadataJson;
  return parseMetadataObject(obj);
}
