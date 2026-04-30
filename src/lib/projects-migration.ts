import type {
  AdditionalStaff,
  NonSlotWiseAssignmentEntry,
  ProjectRenumerationData,
  RenumerationRoleEntry,
  SlotWiseAssignmentEntry,
} from '@/types';

import {
  createProject,
  hasRunLocalStorageMigration,
  markLocalStorageMigrationDone,
  putAttendance,
  putExamData,
  putRenumeration,
  setActiveProjectId,
} from './projects-db';
import {
  extractAttendanceFromZip,
  extractExamDataFromZip,
  loadZipFromDataUrl,
} from './project-zip';

const ATTENDANCE_KEYS = [
  'attendance:zip:dataUrl',
  'attendance:zip:name',
] as const;

const RENUMERATION_KEYS = [
  'renumeration:zip:dataUrl',
  'renumeration:zip:name',
  'renumeration:roles',
  'renumeration:staffList',
  'renumeration:slotWiseAssignments',
  'renumeration:nonSlotAssignments',
  'renumeration:roleNameToIdMap',
] as const;

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * One-time migration of legacy localStorage state (attendance + renumeration)
 * into a single "Recovered" project. Idempotent: runs at most once per browser
 * profile, gated by a flag in the `meta` store.
 *
 * The legacy IDB `examData/current` store is intentionally NOT migrated; it is
 * dropped during the v1 -> v2 schema upgrade.
 */
export async function migrateLegacyLocalStorageOnce(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (await hasRunLocalStorageMigration()) return;

  const attendanceDataUrl = localStorage.getItem('attendance:zip:dataUrl');
  const attendanceName = localStorage.getItem('attendance:zip:name');
  const renumerationDataUrl = localStorage.getItem('renumeration:zip:dataUrl');
  const renumerationName = localStorage.getItem('renumeration:zip:name');
  const rolesRaw = localStorage.getItem('renumeration:roles');
  const staffListRaw = localStorage.getItem('renumeration:staffList');
  const slotWiseRaw = localStorage.getItem('renumeration:slotWiseAssignments');
  const nonSlotRaw = localStorage.getItem('renumeration:nonSlotAssignments');
  const roleMapRaw = localStorage.getItem('renumeration:roleNameToIdMap');

  const hasAnything =
    attendanceDataUrl ||
    renumerationDataUrl ||
    rolesRaw ||
    staffListRaw ||
    slotWiseRaw ||
    nonSlotRaw ||
    roleMapRaw;

  if (!hasAnything) {
    await markLocalStorageMigrationDone();
    return;
  }

  try {
    const project = await createProject({
      title: 'Recovered Exam',
      semesterParity: 'even',
      notes:
        'Auto-recovered from legacy storage on schema upgrade. Rename or edit as needed.',
    });

    let examDataPopulated = false;

    // Attendance ZIP -> exam data + attendance slots.
    if (attendanceDataUrl) {
      try {
        const zip = await loadZipFromDataUrl(
          attendanceDataUrl,
          attendanceName || 'attendance.zip'
        );
        const examData = await extractExamDataFromZip(zip);
        if (examData) {
          await putExamData(project.id, examData);
          examDataPopulated = true;
        }
        const attendance = await extractAttendanceFromZip(zip);
        if (attendance) {
          await putAttendance(project.id, attendance);
        }
      } catch (err) {
        console.warn('Failed to recover attendance ZIP from localStorage', err);
      }
    }

    // Renumeration ZIP -> exam data (only if attendance didn't supply it),
    // plus we leave attendance untouched if attendance ZIP was preferred.
    if (renumerationDataUrl) {
      try {
        const zip = await loadZipFromDataUrl(
          renumerationDataUrl,
          renumerationName || 'renumeration.zip'
        );
        if (!examDataPopulated) {
          const examData = await extractExamDataFromZip(zip);
          if (examData) {
            await putExamData(project.id, examData);
            examDataPopulated = true;
          }
        }
        // Renumeration ZIPs may also embed attendance JSONs; only fold them in
        // if the attendance store is still empty.
        const renumerationAttendance = await extractAttendanceFromZip(zip);
        if (renumerationAttendance && !attendanceDataUrl) {
          await putAttendance(project.id, renumerationAttendance);
        }
      } catch (err) {
        console.warn(
          'Failed to recover renumeration ZIP from localStorage',
          err
        );
      }
    }

    // Renumeration JSON state.
    const roles = safeParseJson<RenumerationRoleEntry[]>(rolesRaw) ?? [];
    const staffList = safeParseJson<AdditionalStaff[]>(staffListRaw) ?? [];
    const slotWiseAssignments =
      safeParseJson<Record<string, SlotWiseAssignmentEntry[]>>(slotWiseRaw) ??
      {};
    const nonSlotAssignments =
      safeParseJson<Record<string, NonSlotWiseAssignmentEntry[]>>(
        nonSlotRaw
      ) ?? {};
    const roleNameToIdMap =
      safeParseJson<Record<string, string>>(roleMapRaw) ?? {};

    if (
      roles.length > 0 ||
      staffList.length > 0 ||
      Object.keys(slotWiseAssignments).length > 0 ||
      Object.keys(nonSlotAssignments).length > 0 ||
      Object.keys(roleNameToIdMap).length > 0
    ) {
      const renumerationData: ProjectRenumerationData = {
        roles,
        staffList,
        slotWiseAssignments,
        nonSlotAssignments,
        roleNameToIdMap,
        updatedAt: new Date(),
      };
      await putRenumeration(project.id, renumerationData);
    }

    await setActiveProjectId(project.id);

    // Clear legacy keys so they can never be re-imported.
    for (const k of [...ATTENDANCE_KEYS, ...RENUMERATION_KEYS]) {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.error('Legacy localStorage migration failed', err);
    // Don't mark as done; we'll retry on the next reload.
    return;
  }

  await markLocalStorageMigrationDone();
}
