import { GripVertical } from 'lucide-react';

import React, { useMemo } from 'react';

import type { RenumerationRoleEntry } from '@/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
        slotWiseAssignment: true,
        nonSlotWiseSubjectInfo: null,
      },
    ]);
  };

  const updateRole = (id: string, patch: Partial<RenumerationRoleEntry>) => {
    setRoles((r: any[]) =>
      r.map((x) => (x.id === id ? { ...x, ...patch } : x))
    );
  };

  const removeRole = (id: string) => {
    setRoles((r) => r.filter((x) => x.id !== id));
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

  const [editingRoleId, setEditingRoleId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [tempSubjectCode, setTempSubjectCode] = React.useState('');

  const openSubjectDialogFor = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    setTempSubjectCode(role?.nonSlotWiseSubjectInfo ?? '');
    setEditingRoleId(roleId);
    setDialogOpen(true);
  };

  const confirmSubjectDialog = () => {
    if (!editingRoleId) {
      setDialogOpen(false);
      return;
    }
    updateRole(editingRoleId, {
      nonSlotWiseSubjectInfo: tempSubjectCode,
      slotWiseAssignment: false,
    });
    setDialogOpen(false);
    setEditingRoleId(null);
    setTempSubjectCode('');
  };

  const cancelSubjectDialog = () => {
    setDialogOpen(false);
    setEditingRoleId(null);
    setTempSubjectCode('');
  };

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
              <div className="text-muted-foreground text-sm">
                No roles defined yet.
              </div>
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
                          onChange={(e) =>
                            updateRole(role.id, { name: e.target.value })
                          }
                          placeholder="e.g. Invigilator, Head Examiner"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={String(role.rate)}
                          onChange={(e) =>
                            updateRole(role.id, {
                              rate: Number(e.target.value || 0),
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm">Actions</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {role.imported ? (
                              <DropdownMenuItem disabled>
                                Imported role
                              </DropdownMenuItem>
                            ) : (
                              <>
                                {role.slotWiseAssignment ? (
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      openSubjectDialogFor(role.id)
                                    }
                                  >
                                    Disable slot-wise (set subject code)
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      updateRole(role.id, {
                                        slotWiseAssignment: true,
                                        nonSlotWiseSubjectInfo: null,
                                      })
                                    }
                                  >
                                    Enable slot-wise
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => removeRole(role.id)}
                                >
                                  Remove role
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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

          {/* Subject code dialog for enabling non-slot-wise subject info */}
          <Dialog
            open={dialogOpen}
            onOpenChange={(v) =>
              v ? setDialogOpen(true) : cancelSubjectDialog()
            }
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Non-slot-wise Subject Code</DialogTitle>
                <DialogDescription>
                  Enter the subject code to use for this role when it is not
                  assigned slot-wise.
                </DialogDescription>
              </DialogHeader>

              <div>
                <Input
                  value={tempSubjectCode}
                  onChange={(e) => setTempSubjectCode(e.target.value)}
                  placeholder="e.g. CS101"
                />
              </div>

              <DialogFooter>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={cancelSubjectDialog}>
                    Cancel
                  </Button>
                  <Button onClick={confirmSubjectDialog}>Confirm</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
