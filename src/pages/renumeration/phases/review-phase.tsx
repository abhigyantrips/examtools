import type JSZip from 'jszip';

import { useEffect } from 'react';

import type {
  AdditionalStaff,
  DutySlot,
  Faculty,
  NonSlotWiseAssignmentEntry,
  RenumerationRoleEntry,
  SlotWiseAssignmentEntry,
} from '@/types';

import { computeSummary } from '@/lib/renumeration';

interface ReviewPhaseProps {
  zipInstance: JSZip | null;
  zipSlots: DutySlot[] | null;
  roles: RenumerationRoleEntry[];
  facultyList: Faculty[];
  staffList: AdditionalStaff[];
  slotWiseAssignments: Record<string, Array<SlotWiseAssignmentEntry>>;
  nonSlotAssignments: Record<string, Array<NonSlotWiseAssignmentEntry>>;
  roleNameToIdMap: Record<string, string>;
}

export function ReviewPhase({
  zipInstance,
  zipSlots,
  roles,
  facultyList,
  staffList,
  slotWiseAssignments,
  nonSlotAssignments,
  roleNameToIdMap,
}: ReviewPhaseProps) {
  useEffect(() => {
    if (zipInstance && zipSlots) {
      computeSummary(
        zipInstance,
        zipSlots,
        roles,
        facultyList,
        staffList,
        slotWiseAssignments,
        nonSlotAssignments,
        roleNameToIdMap
      );
    }
  }, [
    zipInstance,
    zipSlots,
    roles,
    facultyList,
    staffList,
    slotWiseAssignments,
    nonSlotAssignments,
  ]);

  return <>Review Phase (WIP)</>;
}
