import { Trash2 } from 'lucide-react';

import { useMemo } from 'react';

import type {
  AdditionalStaff,
  DutySlot,
  Faculty,
  NonSlotWiseAssignmentEntry,
  Person,
  RenumerationRoleEntry,
  SlotWiseAssignmentEntry,
} from '@/types';

import { getPersonOptions } from '@/lib/renumeration';

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

import { AdditionalAssignmentsDialog } from './additional-assignments-dialog';
import { AdditionalAssignmentsSlotDialog } from './additional-assignments-slot-dialog';

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
  zipSlots: DutySlot[];
}

export function AdditionalAssignmentsPhase({
  roles,
  facultyList,
  staffList,
  nonSlotAssignments,
  setNonSlotAssignments,
  slotWiseAssignments,
  setSlotWiseAssignments,
  zipSlots,
}: AdditionalAssignmentsPhaseProps) {
  const getEntries = (roleId: string) => nonSlotAssignments[roleId] || [];

  const personOptions: Person[] = useMemo(() => {
    return getPersonOptions(facultyList, staffList);
  }, [facultyList, staffList]);

  const slotWiseRoles = roles.filter(
    (r) => r.slotWiseAssignment && !r.imported
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Assign Slot-wise Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {slotWiseRoles.length === 0 ? (
              <div className="text-muted-foreground">
                No slot-wise roles defined.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Name</TableHead>
                    <TableHead className="w-[150px]">ID</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[200px]">Role</TableHead>
                    <TableHead className="w-[80px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zipSlots.map((slot) => {
                    const key = `d${slot.day}-s${slot.slot}`;
                    const entries = slotWiseAssignments[key] || [];

                    // Sort entries by role name
                    const sortedEntries = [...entries].sort((a, b) => {
                      const roleA =
                        roles.find((r) => r.id === a.roleId)?.name || '';
                      const roleB =
                        roles.find((r) => r.id === b.roleId)?.name || '';
                      return roleA.localeCompare(roleB);
                    });

                    return (
                      <>
                        <TableRow className="bg-muted/30 hover:bg-muted/50 border-t">
                          <TableCell colSpan={6} className="font-medium">
                            <div className="flex items-center justify-between pl-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold">
                                  Day {slot.day + 1}, Slot {slot.slot + 1}
                                </span>
                                <span className="text-muted-foreground">
                                  {new Date(slot.date).toLocaleDateString()} •{' '}
                                  {slot.startTime} - {slot.endTime}
                                </span>
                              </div>
                              <Badge variant="outline">
                                {entries.length} Assignments
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>

                        <TableRow className="bg-muted/10 hover:bg-muted/20">
                          <TableCell colSpan={6} className="pl-8">
                            <AdditionalAssignmentsSlotDialog
                              roles={slotWiseRoles}
                              staff={personOptions}
                              unavailablePersonIds={entries.map(
                                (e) => e.personId
                              )}
                              onAdd={(sEntry) => {
                                const current = slotWiseAssignments[key] || [];
                                const updated = {
                                  ...slotWiseAssignments,
                                  [key]: [...current, sEntry],
                                };
                                setSlotWiseAssignments(updated);
                              }}
                            />
                          </TableCell>
                        </TableRow>

                        {sortedEntries.map((entry, idx) => {
                          const person = personOptions.find(
                            (p) => p.refId === entry.personId
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
                                {person?.staffId || entry.personId}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {entry.source === 'faculty'
                                    ? 'Faculty'
                                    : 'Staff'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {roles.find((r) => r.id === entry.roleId)
                                  ?.name || 'Unknown Role'}
                              </TableCell>
                              <TableCell className="text-right">
                                <button
                                  className="hover:bg-destructive/10 text-destructive rounded p-1"
                                  onClick={() => {
                                    const current =
                                      slotWiseAssignments[key] || [];
                                    const updatedEntries = current.filter(
                                      (e) =>
                                        !(
                                          e.personId === entry.personId &&
                                          e.source === entry.source &&
                                          e.roleId === entry.roleId
                                        )
                                    );
                                    const updated = {
                                      ...slotWiseAssignments,
                                      [key]: updatedEntries,
                                    };
                                    setSlotWiseAssignments(updated);
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
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Name</TableHead>
                    <TableHead className="w-[150px]">ID</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[200px]">Count</TableHead>
                    <TableHead className="w-[80px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
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
                            <TableCell colSpan={5} className="font-medium">
                              <div className="flex items-center justify-between pl-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{role.name}</span>
                                  <span className="text-muted-foreground">{`Assigning - ${role.nonSlotWiseSubjectInfo}`}</span>
                                </div>
                                <Badge variant="outline">
                                  {total} Assignments
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>

                          <TableRow className="bg-muted/10 hover:bg-muted/20">
                            <TableCell colSpan={5} className="pl-8">
                              <AdditionalAssignmentsDialog
                                role={role}
                                staff={personOptions}
                                unavailablePersonIds={unavailableIds}
                                onAdd={(entry) => {
                                  const nEntry =
                                    entry as NonSlotWiseAssignmentEntry;
                                  const current = getEntries(role.id);
                                  const updated = {
                                    ...nonSlotAssignments,
                                    [role.id]: [...current, nEntry],
                                  };
                                  setNonSlotAssignments(updated);
                                }}
                              />
                            </TableCell>
                          </TableRow>

                          {entries.map((entry, idx) => {
                            const person = personOptions.find(
                              (p) => p.refId === entry.personId
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
                                  {person?.staffId || entry.personId}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {entry.source === 'faculty'
                                      ? 'Faculty'
                                      : 'Staff'}
                                  </Badge>
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
