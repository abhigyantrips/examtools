import type JSZip from 'jszip';

import { useEffect, useState } from 'react';

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
  const [summary, setSummary] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!zipInstance || !zipSlots) return;

    (async () => {
      try {
        const res = await computeSummary(
          zipInstance,
          zipSlots,
          roles,
          facultyList,
          staffList,
          slotWiseAssignments,
          nonSlotAssignments,
          roleNameToIdMap
        );
        setSummary(res as any);
      } catch (err) {
        setSummary({ error: String(err) });
      }
    })();
  }, [
    zipInstance,
    zipSlots,
    roles,
    facultyList,
    staffList,
    slotWiseAssignments,
    nonSlotAssignments,
    roleNameToIdMap,
  ]);

  return (
    <>
      <h3>Review Phase (WIP)</h3>
      <pre style={{ whiteSpace: 'pre-wrap' }}>
        {summary ? JSON.stringify(summary, null, 2) : 'Loading summary...'}
      </pre>
    </>
  );
}
