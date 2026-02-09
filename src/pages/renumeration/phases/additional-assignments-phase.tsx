import { Trash2 } from 'lucide-react';

import { useMemo } from 'react';

import type {
  AdditionalStaff,
  Faculty,
  NonSlotWiseAssignmentEntry,
  Person,
  RenumerationRoleEntry,
  SlotWiseAssignmentEntry,
} from '@/types';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

import { AdditionalAssignmentsDialog } from './additional-assignments-dialog';

interface AdditionalAssignmentsPhaseProps {
  roles: RenumerationRoleEntry[];
  facultyList: Faculty[];
  staffList: AdditionalStaff[];
  nonSlotAssignments: Record<string, Array<NonSlotWiseAssignmentEntry>>;
  setNonSlotAssignments: (
    v: Record<string, Array<NonSlotWiseAssignmentEntry>>
  ) => void;
  slotWiseAssignments: Record<string, Array<SlotWiseAssignmentEntry>>;
  setSlotWiseAssignments: (
    v: Record<string, Array<SlotWiseAssignmentEntry>>
  ) => void;
}

export function AdditionalAssignmentsPhase({
  roles,
  facultyList,
  staffList,
  nonSlotAssignments,
  setNonSlotAssignments,
  slotWiseAssignments,
  setSlotWiseAssignments,
}: AdditionalAssignmentsPhaseProps) {
  const getEntries = (roleId: string) => nonSlotAssignments[roleId] || [];

  const personOptions: Person[] = useMemo(() => {
    const f = (facultyList || []).map((x) => ({
      id: x.facultyId,
      name: x.facultyName,
      source: 'faculty' as const,
    }));
    const s = (staffList || []).map((x) => ({
      id: x.uuid,
      name: x.staffName,
      source: 'staff' as const,
    }));
    return [...f, ...s];
  }, [facultyList, staffList]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Assign Additional Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {roles.filter((r) => !r.slotWiseAssignment).length === 0 ? (
              <div className="text-muted-foreground">
                No non-slot-wise roles defined.
              </div>
            ) : (
              <Table>
                <TableBody>
                  {roles
                    .filter((r) => !r.slotWiseAssignment)
                    .map((role) => {
                      const entries = getEntries(role.id);
                      const unavailableIds = entries.map((e) => e.personId);
                      const total = entries.reduce(
                        (s, e) => s + Number(e.count || 0),
                        0
                      );
                      return (
                        <>
                          <TableRow className="bg-muted/30 hover:bg-muted/50 border-t">
                            <TableCell colSpan={6} className="font-medium">
                              <div className="flex items-center justify-between pl-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{role.name}</span>
                                  <span className="text-muted-foreground">
                                    {`Assigning - ${role.nonSlotWiseSubjectInfo}`}
                                  </span>
                                </div>
                                <Badge variant="outline">
                                  {total} Assignments
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/10 hover:bg-muted/20">
                            <TableCell colSpan={6} className="pl-8">
                              <AdditionalAssignmentsDialog
                                role={role}
                                staff={personOptions}
                                unavailablePersonIds={unavailableIds}
                                onAdd={(entry) => {
                                  const current = getEntries(role.id);
                                  const updated = {
                                    ...nonSlotAssignments,
                                    [role.id]: [...current, entry],
                                  };
                                  setNonSlotAssignments(updated);
                                }}
                              />
                            </TableCell>
                          </TableRow>
                          {entries.map((entry, idx) => {
                            const person = personOptions.find(
                              (p) => p.id === entry.personId
                            );
                            return (
                              <TableRow
                                key={idx}
                                className="bg-muted/10 hover:bg-muted/20"
                              >
                                <TableCell className="pl-8">
                                  {person?.name || entry.personId}
                                </TableCell>
                                <TableCell>
                                  {entry.source.charAt(0).toUpperCase() +
                                    entry.source.slice(1)}
                                </TableCell>
                                <TableCell>{entry.count}</TableCell>
                                <TableCell className="text-right">
                                  <button
                                    className="hover:bg-destructive/10 text-destructive rounded p-1"
                                    onClick={() => {
                                      const current = getEntries(role.id);
                                      const updatedEntries = current.filter(
                                        (e) =>
                                          !(
                                            e.personId === entry.personId &&
                                            e.source === entry.source
                                          )
                                      );
                                      const updated = {
                                        ...nonSlotAssignments,
                                        [role.id]: updatedEntries,
                                      };
                                      setNonSlotAssignments(updated);
                                    }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </>
                      );
                    })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
