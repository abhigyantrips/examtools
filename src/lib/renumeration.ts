import type JSZip from 'jszip';

// Read unique roles from assignment.json inside the ZIP and return RenumerationRoleEntry[]
import type {
  AdditionalStaff,
  DutySlot,
  Faculty,
  NonSlotWiseAssignmentEntry,
  Person,
  RenumerationRoleEntry,
  SlotAttendance,
  SlotWiseAssignmentEntry,
} from '@/types';

import { readSlotAttendance } from './json-files';
import { capitalize } from './utils';
import { readTextFile } from './zip';

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

    // Drop the buffer role
    uniq.delete('buffer');

    const out: RenumerationRoleEntry[] = Array.from(uniq).map((r, i) => ({
      id: Math.random().toString(36).slice(2, 9),
      name: capitalize(r),
      rate: 0,
      order: i,
      imported: true,
      slotWiseAssignment: true,
      nonSlotWiseSubjectInfo: null,
    }));

    return out;
  } catch (err) {
    return [];
  }
}

function getPersonOptions(
  facultyList: Faculty[] | null,
  staffList: AdditionalStaff[] | null
): Person[] {
  const f = (facultyList || []).map((x) => ({
    refId: x.facultyId,
    staffId: x.facultyId,
    name: x.facultyName,
    source: 'faculty' as const,
  }));
  const s = (staffList || []).map((x) => ({
    refId: x.uuid,
    staffId: x.staffId,
    name: x.staffName,
    source: 'staff' as const,
  }));
  return [...f, ...s];
}

async function loadAttendanceBySlot(
  zip: JSZip,
  slots: DutySlot[]
): Promise<Record<string, SlotAttendance | null>> {
  const out: Record<string, SlotAttendance | null> = {};
  for (const slot of slots) {
    const key = `d${slot.day}-s${slot.slot}`;
    try {
      const att = await readSlotAttendance(zip as any, slot.day, slot.slot);
      out[key] = att;
    } catch (err) {
      out[key] = null;
    }
  }
  return out;
}

function computeSummary(
  zipInstance: JSZip,
  zipSlots: DutySlot[] | null,
  roles: RenumerationRoleEntry[],
  facultyList: Faculty[],
  staffList: AdditionalStaff[],
  slotWiseAssignments: Record<string, Array<SlotWiseAssignmentEntry>>,
  nonSlotAssignments: Record<string, Array<NonSlotWiseAssignmentEntry>>,
  roleNameToIdMap: Record<string, string>
): void {
  const personList = getPersonOptions(facultyList, staffList);
  const personMap: Record<string, Person> = {};
  for (const p of personList) {
    personMap[p.refId] = p;
  }

  const roleMap: Record<string, RenumerationRoleEntry> = {};
  for (const r of roles) {
    roleMap[r.id] = r;
  }
  // debug log all variables
  console.log('Computing summary with:');
  console.log('Roles:', roles);
  // console.log('Faculty List:', facultyList);
  // console.log('Staff List:', staffList);
  console.log('Slot-wise Assignments:', slotWiseAssignments);
  console.log('Non-slot-wise Assignments:', nonSlotAssignments);
  console.log('Role Name to ID Map:', roleNameToIdMap);

  // Get attendance data for all slots
  const attendanceData = loadAttendanceBySlot(zipInstance, zipSlots || []).then(
    (data) => {
      // After loading attendance data, we can compute summaries or do further processing if needed
      console.log('Loaded attendance data for all slots:', data);
      return data;
    }
  );
  console.log(attendanceData);

  console.log('Attendance data loading initiated, waiting for results...');
}

export { getPersonOptions, loadAttendanceBySlot, computeSummary };
