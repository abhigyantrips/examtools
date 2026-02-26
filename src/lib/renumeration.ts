import type JSZip from 'jszip';

// Read unique roles from assignment.json inside the ZIP and return RenumerationRoleEntry[]
import type {
  AdditionalStaff,
  DutySlot,
  Faculty,
  NonSlotWiseAssignmentEntry,
  Person,
  PersonSummary,
  RenumerationRoleEntry,
  RenumerationSummary,
  SlotAttendance,
  SlotSummary,
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
): Promise<Record<string, SlotAttendance>> {
  const out: Record<string, SlotAttendance> = {};
  for (const slot of slots) {
    const key = `d${slot.day}-s${slot.slot}`;
    const att = await readSlotAttendance(zip as any, slot.day, slot.slot);
    out[key] = att!;
  }
  return out;
}

async function computeSummary(
  zipInstance: JSZip,
  zipSlots: DutySlot[],
  roles: RenumerationRoleEntry[],
  facultyList: Faculty[],
  staffList: AdditionalStaff[],
  slotWiseAssignments: Record<string, Array<SlotWiseAssignmentEntry>>,
  nonSlotAssignments: Record<string, Array<NonSlotWiseAssignmentEntry>>,
  roleNameToIdMap: Record<string, string>
): Promise<RenumerationSummary> {
  const personList = getPersonOptions(facultyList, staffList);
  const personMap: Record<string, Person> = {};
  for (const p of personList) {
    personMap[p.refId] = p;
  }

  const roleMap: Record<string, RenumerationRoleEntry> = {};
  for (const r of roles) {
    roleMap[r.id] = r;
  }
  // Load attendance data for all slots
  const attendanceBySlot = await loadAttendanceBySlot(zipInstance, zipSlots);

  // debug log all variables
  // console.log('Computing summary with:');
  // console.log('Roles:', roles);
  // console.log('Faculty List:', facultyList);
  // console.log('Staff List:', staffList);
  // console.log('Slot-wise Assignments:', slotWiseAssignments);
  // console.log('Non-slot-wise Assignments:', nonSlotAssignments);
  // console.log('Role Name to ID Map:', roleNameToIdMap);
  // console.log('Attendance by slot:', attendanceBySlot);
  // console.log('Role Map:', roleMap);

  // Setup summary data structure
  var slotWiseSummary: Record<string, SlotSummary> = {};
  var personWiseSummary: Record<string, PersonSummary> = {};

  // Loop over zipSlots
  for (const slot of zipSlots) {
    const slotKey = `d${slot.day}-s${slot.slot}`;
    const attendance: SlotAttendance = attendanceBySlot[slotKey];

    // Initialize slot summary
    slotWiseSummary[slotKey] = {
      key: slotKey,
      slot,
      assignmentCount: 0,
      assignmentCost: 0,
      attendancePresent: 0,
      attendanceReplacement: 0,
      attendanceAbsent: 0,
    };

    // Process attendance for this slot
    for (const att of attendance.entries) {
      var personStats: PersonSummary = personWiseSummary[att.facultyId];
      if (!personStats) {
        const contextPerson = personMap[att.facultyId];
        personStats = {
          refId: att.facultyId,
          staffId: att.facultyId,
          name: contextPerson.name,
          source: 'faculty', // default as this is imported from attendance
          slotWiseCount: 0,
          slotWiseCost: 0,
          nonSlotCount: 0,
          nonSlotCost: 0,
          attendancePresent: 0,
          attendanceAbsent: 0,
          attendanceReplacement: 0,
          attendanceCost: 0,
          totalCost: 0,
          subjectsCovered: [],
        };
      }
      // Update basic stats
      if (att.status === 'present') {
        slotWiseSummary[slotKey].attendancePresent += 1;
        personStats.attendancePresent += 1;
      } else if (att.status === 'replacement') {
        slotWiseSummary[slotKey].attendanceReplacement += 1;
        personStats.attendanceReplacement += 1;
      } else if (att.status === 'absent') {
        slotWiseSummary[slotKey].attendanceAbsent += 1;
        personStats.attendanceAbsent += 1;
        // Update person and break
        personWiseSummary[att.facultyId] = personStats;
        continue;
      }
      slotWiseSummary[slotKey].assignmentCount += 1;

      // If role is "attendance-override", find who they replaced and use that role instead
      let roleName = att.role;
      if (roleName === 'attendance-override') {
        const replacedAtt = attendance.entries.find(
          (e) => e.facultyId === att.replacementFrom
        );
        // Guaranteed to exist
        roleName = replacedAtt!.role;
      }

      // Update subjects covered
      personStats.subjectsCovered.push(slot.subjectCode!);

      // Get role and its rate
      console.log(roleName, roleNameToIdMap[roleName], roleMap[roleNameToIdMap[roleName]]);
      const rate = roleMap[roleNameToIdMap[roleName]].rate;
      // Update costs
      slotWiseSummary[slotKey].assignmentCost += rate;
      personStats.attendanceCost += rate;
      personStats.totalCost += rate;

      // Update person stats based on attendance
      personWiseSummary[att.facultyId] = personStats;
    }
  }
  // Process manual non-slot-wise assignments

  // Process manual slot-wise assignments

  // Finalize summary
  const summary: RenumerationSummary = {
    slotSummaries: Object.values(slotWiseSummary),
    personSummaries: Object.values(personWiseSummary),
  };

  return summary;
}

export { getPersonOptions, loadAttendanceBySlot, computeSummary };
