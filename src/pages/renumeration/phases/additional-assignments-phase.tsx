import { useMemo } from 'react';

import type { AdditionalStaff, Faculty, RenumerationRoleEntry } from '@/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { Plus } from 'lucide-react';

interface AdditionalAssignmentsPhaseProps {
  roles: RenumerationRoleEntry[];
  facultyList: Faculty[];
  staffList: AdditionalStaff[];
  nonSlotAssignments: Record<
    string,
    Array<{ personId: string; name: string; source: string; count: number }>
  >;
  setNonSlotAssignments: (
    v: Record<
      string,
      Array<{ personId: string; name: string; source: string; count: number }>
    >
  ) => void;
}

export function AdditionalAssignmentsPhase({
  roles,
  facultyList,
  staffList,
  nonSlotAssignments,
  setNonSlotAssignments,
}: AdditionalAssignmentsPhaseProps) {
  const getEntries = (roleId: string) => nonSlotAssignments[roleId] || [];

  const personOptions = useMemo(() => {
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
                                    {role.imported ? '(imported)' : '(manual)'}
                                  </span>
                                </div>
                                <Badge variant="outline">
                                  {total} Assignments
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/10 hover:bg-muted/20">
                            <TableCell colSpan={6}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-2 text-xs"
                              >
                                <Plus className="size-3" />
                                Add Duty
                              </Button>
                            </TableCell>
                          </TableRow>
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
