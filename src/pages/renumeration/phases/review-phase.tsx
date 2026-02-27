import type JSZip from 'jszip';

import { useEffect, useState } from 'react';

import type {
  AdditionalStaff,
  DutySlot,
  Faculty,
  NonSlotWiseAssignmentEntry,
  PersonSummary,
  RenumerationRoleEntry,
  SlotSummary,
  SlotWiseAssignmentEntry,
} from '@/types';

import { computeSummary } from '@/lib/renumeration';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

  if (!summary) {
    return (
      <div className="text-muted-foreground text-sm">
        Preparing summary from ZIP data...
      </div>
    );
  }

  if (summary.error) {
    return (
      <div className="text-destructive text-sm">
        Error computing summary: {summary.error}
      </div>
    );
  }

  const slotSummaries: SlotSummary[] = summary.slotSummaries || [];
  const personSummaries: PersonSummary[] = summary.personSummaries || [];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Slot Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.slotSummaries.length === 0 ? (
            <div className="text-muted-foreground">No slot data found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Slot</TableHead>
                  <TableHead className="w-[140px]">Assignments</TableHead>
                  <TableHead className="w-[140px]">Cost</TableHead>
                  <TableHead className="w-[220px]">
                    Assigned Duties (P/A/R)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slotSummaries.map((s: SlotSummary) => (
                  <TableRow key={s.key}>
                    <TableCell>
                      <div className="font-medium">
                        Day {s.slot.day + 1}, Slot {s.slot.slot + 1}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {new Date(s.slot.date).toLocaleDateString()} •{' '}
                        {s.slot.startTime} - {s.slot.endTime}
                      </div>
                    </TableCell>
                    <TableCell>{s.assignmentCount}</TableCell>
                    <TableCell>{s.assignmentCost.toFixed(2)}</TableCell>
                    <TableCell>
                      {s.attendancePresent}/{s.attendanceAbsent}/
                      {s.attendanceReplacement}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faculty & Staff Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {personSummaries.length === 0 ? (
            <div className="text-muted-foreground">No assignments found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[240px]">Name</TableHead>
                  <TableHead className="w-[140px]">ID</TableHead>
                  <TableHead className="w-[90px]">Type</TableHead>
                  <TableHead className="w-[130px]">Slot-wise</TableHead>
                  <TableHead className="w-[130px]">Non-slot</TableHead>
                  <TableHead className="w-[160px]">
                    Assigned Duties (P/A/R)
                  </TableHead>
                  <TableHead className="w-[120px] text-right">
                    Total Cost
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personSummaries.map((p: PersonSummary) => (
                  <TableRow key={p.refId}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                    </TableCell>
                    <TableCell>{p.staffId}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {p.source === 'faculty' ? 'Faculty' : 'Staff'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.slotWiseCount} • {p.slotWiseCost}
                    </TableCell>
                    <TableCell>
                      {p.nonSlotCount} • {p.nonSlotCost}
                    </TableCell>
                    <TableCell>
                      {p.attendancePresent}/{p.attendanceAbsent}/
                      {p.attendanceReplacement} • {p.attendanceCost}
                    </TableCell>
                    <TableCell className="text-right">{p.totalCost}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
