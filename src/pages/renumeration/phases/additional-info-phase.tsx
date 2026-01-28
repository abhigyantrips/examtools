import React, { useMemo } from 'react';

import type { RenumerationRoleEntry } from '@/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { GripVertical } from 'lucide-react';

interface AdditionalInfoPhaseProps {
  roles: RenumerationRoleEntry[];
  setRoles: React.Dispatch<React.SetStateAction<RenumerationRoleEntry[]>>;
}

export function AdditionalInfoPhase({
  roles,
  setRoles,
}: AdditionalInfoPhaseProps) {
  const addRole = () => {
    setRoles((r) => [
      ...r,
      {
        id: Math.random().toString(36).substring(2, 9),
        name: '',
        rate: 0,
        order: r.length,
        imported: false,
      },
    ]);
  };

  const updateRole = (id: string, patch: Partial<RenumerationRoleEntry>) => {
    setRoles((r: any[]) =>
      r.map((x) => (x.id === id ? { ...x, ...patch } : x))
    );
  };

  const removeRole = (id: string) => {
    setRoles((r) => r.filter((x) => x.id !== id && !x.imported));
  };

  // drag and drop handlers
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('text/plain'));
    if (Number.isNaN(from)) return;
    setRoles((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(toIdx, 0, moved);
      // reassign order
      return next.map((x, i) => ({ ...x, order: i }));
    });
  };

  const totalRoles = useMemo(() => roles.length, [roles]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Additional Roles & Rates</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Define extra roles that faculty can be assigned for duties and the
            per-duty rate for each role.
          </p>

          <div className="space-y-3">
            {roles.length === 0 ? (
              <div className="text-muted-foreground text-sm">No roles defined yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-6" />
                    <TableHead>Role</TableHead>
                    <TableHead className="w-40">Rate (₹)</TableHead>
                    <TableHead className="w-36">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role, idx) => (
                    <TableRow
                      key={role.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, idx)}
                    >
                      <TableCell>
                        <div className="opacity-70">
                          <GripVertical className="size-4 cursor-grab" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={role.name}
                          onChange={(e) => updateRole(role.id, { name: e.target.value })}
                          placeholder="e.g. Invigilator, Head Examiner"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={String(role.rate)}
                          onChange={(e) => updateRole(role.id, { rate: Number(e.target.value || 0) })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="destructive" size="sm" onClick={() => removeRole(role.id)} disabled={!!role.imported}>
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="text-muted-foreground text-xs">
            Role order affects exported Excel column order.
          </div>

          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              Total roles: {totalRoles}
            </div>
            <div className="flex gap-2">
              <Button onClick={addRole}>Add role</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
