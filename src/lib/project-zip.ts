import JSZip from 'jszip';

import type {
  AssignmentJson,
  ExamData,
  MetadataJson,
  ProjectAttendanceData,
  SlotAttendance,
} from '@/types';

import { readMetadataFaculty, readMetadataSlots } from './json-files';
import { loadZip, readTextFile, writeTextFile } from './zip';

// ---------------------------------------------------------------------------
// Project state -> JSZip (for export, or to feed the existing tool flows)
// ---------------------------------------------------------------------------

interface BuildZipInput {
  examData: ExamData | null;
  attendance: ProjectAttendanceData | null;
}

export function buildZipFromProject(input: BuildZipInput): JSZip {
  const zip = new JSZip();

  if (input.examData) {
    const metadata: MetadataJson = examDataToMetadataJson(input.examData);
    writeTextFile(zip as any, 'internal/metadata.json', JSON.stringify(metadata, null, 2));
    writeTextFile(zip as any, 'metadata.json', JSON.stringify(metadata, null, 2));

    const assignmentJson: AssignmentJson[] = input.examData.assignments.map(
      (a) => {
        const slot = input.examData!.examStructure.dutySlots.find(
          (s) => s.day === a.day && s.slot === a.slot
        );
        return {
          day: a.day,
          slot: a.slot,
          date: slot ? slot.date.toISOString() : null,
          time: slot ? `${slot.startTime} - ${slot.endTime}` : null,
          facultyId: a.facultyId,
          role: a.role,
          roomNumber: a.roomNumber ?? null,
          rooms: a.rooms ?? null,
        };
      }
    );
    writeTextFile(
      zip as any,
      'internal/assignment.json',
      JSON.stringify(assignmentJson, null, 2)
    );
  }

  if (input.attendance) {
    for (const [, slotAttendance] of Object.entries(input.attendance.slots)) {
      const filename = `internal/attendance-day${slotAttendance.day}-slot${slotAttendance.slot}.json`;
      writeTextFile(
        zip as any,
        filename,
        JSON.stringify(slotAttendance, null, 2)
      );
    }
  }

  const ts = new Date().toISOString();
  writeTextFile(zip as any, 'last_modified.txt', ts);
  writeTextFile(zip as any, 'internal/last_modified.txt', ts);

  return zip;
}

function examDataToMetadataJson(examData: ExamData): MetadataJson {
  return {
    type: 'assignment',
    generatedAt: new Date().toISOString(),
    slots: examData.examStructure.dutySlots.map((s) => ({
      day: s.day,
      slot: s.slot,
      date:
        s.date instanceof Date ? s.date.toISOString() : String(s.date ?? ''),
      startTime: s.startTime,
      endTime: s.endTime,
      subjectCode: s.subjectCode,
      rooms: Array.isArray(s.rooms) ? s.rooms.slice() : [],
      regularDuties: s.regularDuties,
      relieverDuties: s.relieverDuties,
      squadDuties: s.squadDuties,
      bufferDuties: s.bufferDuties,
    })),
    designationDutyCounts: { ...examData.examStructure.designationDutyCounts },
    designationRelieverCounts: examData.examStructure.designationRelieverCounts
      ? { ...examData.examStructure.designationRelieverCounts }
      : undefined,
    designationSquadCounts: examData.examStructure.designationSquadCounts
      ? { ...examData.examStructure.designationSquadCounts }
      : undefined,
    designationBufferEligibility: examData.examStructure
      .designationBufferEligibility
      ? { ...examData.examStructure.designationBufferEligibility }
      : undefined,
    unavailable: examData.unavailability.map((u) => ({
      facultyId: u.facultyId,
      date: u.date,
    })),
    faculty: examData.faculty.map((f) => ({
      facultyId: f.facultyId,
      facultyName: f.facultyName,
      designation: f.designation,
      department: f.department,
      phoneNo: f.phoneNo,
    })),
  };
}

// ---------------------------------------------------------------------------
// JSZip -> project state (for save/import paths)
// ---------------------------------------------------------------------------

export async function extractExamDataFromZip(
  zip: JSZip
): Promise<ExamData | null> {
  // We piggyback on the existing parsers in lib/json-files. Returns null when
  // the ZIP doesn't carry assignment-tool metadata.
  const metadataText =
    (await readTextFile(zip as any, 'internal/metadata.json')) ||
    (await readTextFile(zip as any, 'metadata.json'));
  if (!metadataText) return null;

  let metadata: MetadataJson;
  try {
    metadata = JSON.parse(metadataText) as MetadataJson;
  } catch {
    return null;
  }

  const facultyList = await readMetadataFaculty(zip);
  const slots = await readMetadataSlots(zip);

  const assignmentText = await readTextFile(
    zip as any,
    'internal/assignment.json'
  );
  let assignmentJson: AssignmentJson[] = [];
  if (assignmentText) {
    try {
      const parsed = JSON.parse(assignmentText);
      if (Array.isArray(parsed)) assignmentJson = parsed;
    } catch {
      assignmentJson = [];
    }
  }

  const dutySlots = slots.map((s: any) => ({
    day: Number(s.day),
    slot: Number(s.slot),
    date: new Date(s.date),
    startTime: String(s.startTime || ''),
    endTime: String(s.endTime || ''),
    subjectCode: s.subjectCode || undefined,
    subjectNames: s.subjectNames || undefined,
    regularDuties: Number(s.regularDuties || 0),
    relieverDuties: Number(s.relieverDuties || 0),
    squadDuties: Number(s.squadDuties || 0),
    bufferDuties: Number(s.bufferDuties || 0),
    rooms: Array.isArray(s.rooms) ? s.rooms.slice() : [],
    studentsAttended:
      s.studentsAttended != null ? Number(s.studentsAttended) : undefined,
  }));

  const maxDay = dutySlots.reduce((acc, s) => Math.max(acc, s.day), -1);

  return {
    faculty: facultyList,
    examStructure: {
      days: maxDay >= 0 ? maxDay + 1 : 0,
      dutySlots,
      designationDutyCounts: { ...(metadata.designationDutyCounts || {}) },
      designationRelieverCounts: metadata.designationRelieverCounts
        ? { ...metadata.designationRelieverCounts }
        : undefined,
      designationSquadCounts: metadata.designationSquadCounts
        ? { ...metadata.designationSquadCounts }
        : undefined,
      designationBufferEligibility: metadata.designationBufferEligibility
        ? { ...metadata.designationBufferEligibility }
        : undefined,
    },
    unavailability: (metadata.unavailable || []).map((u) => ({
      facultyId: u.facultyId,
      date: u.date,
    })),
    assignments: assignmentJson.map((a) => ({
      day: a.day,
      slot: a.slot,
      facultyId: a.facultyId,
      role: a.role,
      roomNumber: a.roomNumber || undefined,
      rooms: a.rooms || undefined,
    })),
    lastUpdated: new Date(),
  };
}

export async function extractAttendanceFromZip(
  zip: JSZip
): Promise<ProjectAttendanceData | null> {
  // Walk the ZIP for any `internal/attendance-day{d}-slot{s}.json` files.
  const slots: Record<string, SlotAttendance> = {};
  const re = /^internal\/attendance-day(\d+)-slot(\d+)\.json$/;
  const filenames = Object.keys(zip.files);
  for (const name of filenames) {
    const m = name.match(re);
    if (!m) continue;
    const text = await readTextFile(zip as any, name);
    if (!text) continue;
    try {
      const parsed = JSON.parse(text) as SlotAttendance;
      const key = `d${parsed.day}-s${parsed.slot}`;
      slots[key] = parsed;
    } catch {
      // skip malformed
    }
  }

  if (Object.keys(slots).length === 0) return null;
  return { slots, updatedAt: new Date() };
}

export async function loadZipFromFile(file: File): Promise<JSZip> {
  return loadZip(file) as unknown as JSZip;
}

// Convenience: data URL (legacy localStorage format) -> JSZip
export async function loadZipFromDataUrl(
  dataUrl: string,
  filename = 'recovered.zip'
): Promise<JSZip> {
  const resp = await fetch(dataUrl);
  const buffer = await resp.arrayBuffer();
  const file = new File([buffer], filename, { type: 'application/zip' });
  return loadZipFromFile(file);
}
