import {
  Check,
  CheckCircle,
  Edit2,
  GripVertical,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';

import React, { useMemo } from 'react';

import type { AdditionalStaff, RenumerationRoleEntry } from '@/types';

import { parseFacultyExcel } from '@/lib/excel';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  setRoles: (newRoles: RenumerationRoleEntry[]) => void;
  staffList: AdditionalStaff[];
  setStaffList: (newList: AdditionalStaff[]) => void;
}

export function AdditionalInfoPhase({
  roles,
  setRoles,
  staffList,
  setStaffList,
}: AdditionalInfoPhaseProps) {
  const addRole = () => {
    roles.push({
      id: Math.random().toString(36).substring(2, 9),
      name: '',
      rate: 0,
      order: roles.length,
      imported: false,
      slotWiseAssignment: true,
      nonSlotWiseSubjectInfo: null,
    });
    setRoles([...roles]);
  };

  const updateRole = (id: string, patch: Partial<RenumerationRoleEntry>) => {
    roles.forEach((x) => {
      if (x.id === id) {
        Object.assign(x, patch);
      }
    });
    setRoles([...roles]);
  };

  const removeRole = (id: string) => {
    const idx = roles.findIndex((x) => x.id === id);
    if (idx === -1) return;
    roles.splice(idx, 1);
    // reassign order after deletion
    setRoles(roles.map((x, i) => ({ ...x, order: i })));
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
    const updated = [...roles];
    const [moved] = updated.splice(from, 1);
    updated.splice(toIdx, 0, moved);
    // reassign order after rearranging
    setRoles(updated.map((x, i) => ({ ...x, order: i })));
  };

  const totalRoles = useMemo(() => roles.length, [roles]);

  const [editingRoleId, setEditingRoleId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [tempSubjectCode, setTempSubjectCode] = React.useState('');
  const [fileLoading, setFileLoading] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = React.useState(false);

  const openSubjectDialogFor = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    setTempSubjectCode(role?.nonSlotWiseSubjectInfo ?? '');
    setEditingRoleId(roleId);
    setDialogOpen(true);
  };

  const handleStaffFile = async (f: File | null) => {
    if (!f) return;
    setFileError(null);
    setFileLoading(true);
    try {
      const res = await parseFacultyExcel(f);
      if (!res || !Array.isArray(res.data)) {
        setFileError('No data parsed from file');
        return;
      }
      const list: AdditionalStaff[] = res.data.map((r) => ({
        uuid: Math.random().toString(36).slice(2, 9),
        staffName: String(r.facultyName || ''),
        staffId: String(r.facultyId || ''),
      }));
      setStaffList(list);
      setUploadSuccess(true);
    } catch (err) {
      console.error('Failed to parse staff Excel', err);
      setFileError(String(err instanceof Error ? err.message : err));
    } finally {
      setFileLoading(false);
    }
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
    <div className="space-y-6">
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
            <p className="text-muted-foreground text-xs">
              Note: a "slot-wise" role means the role is assigned per exam slot
              (requires explicit mapping of user and slot). Disabling slot-wise
              lets you set a fixed subject code for the role instead and
              manually assign duty counts per person.
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
                          <div className="flex items-center gap-2">
                            {role.imported ? (
                              <div className="text-muted-foreground flex items-center gap-2">
                                <Upload className="size-4" />
                                <span className="text-sm">Imported</span>
                              </div>
                            ) : (
                              <>
                                {/* Toggle slot-wise / set subject */}
                                {role.slotWiseAssignment ? (
                                  <button
                                    title="Set a fixed subject code for this role (non slot-wise)"
                                    className="hover:bg-muted/50 rounded p-1"
                                    onClick={() =>
                                      openSubjectDialogFor(role.id)
                                    }
                                  >
                                    <Edit2 className="size-4" />
                                  </button>
                                ) : (
                                  <button
                                    title="Enable slot-wise assignment for this role"
                                    className="hover:bg-muted/50 rounded p-1"
                                    onClick={() =>
                                      updateRole(role.id, {
                                        slotWiseAssignment: true,
                                        nonSlotWiseSubjectInfo: null,
                                      })
                                    }
                                  >
                                    <Check className="size-4" />
                                  </button>
                                )}

                                {/* Remove role */}
                                <button
                                  title="Remove role"
                                  className="rounded p-1 hover:bg-red-50"
                                  onClick={() => removeRole(role.id)}
                                >
                                  <Trash2 className="text-destructive size-4" />
                                </button>
                              </>
                            )}
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

      <Card>
        <CardHeader>
          <CardTitle>Additional Staff List Import</CardTitle>
          <CardDescription>
            Import list of additional staff from an Excel file for linking to
            extra duties.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div
              className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                /* highlight when dragging */
                'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
            >
              <input
                id="zipfile"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) =>
                  handleStaffFile(e.target.files ? e.target.files[0] : null)
                }
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />

              <div className="space-y-3">
                <Upload className="text-muted-foreground mx-auto size-12" />
                <div>
                  <p className="text-sm font-medium">
                    Drag and drop your Excel file here
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    or click to browse files (.xlsx, .xls)
                  </p>
                </div>
              </div>
              <div className="text-muted-foreground mt-3 text-xs">
                Required columns: S No, Faculty Name, Faculty ID
              </div>
            </div>
            {fileLoading && (
              <div className="text-muted-foreground text-sm">Parsing...</div>
            )}
            {fileError && (
              <div className="text-sm text-red-600">{fileError}</div>
            )}

            {/* Post-upload success + preview */}
            {staffList.length > 0 && (
              <>
                <Card>
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {uploadSuccess && (
                        <CheckCircle className="size-5 text-green-600" />
                      )}
                      <Users className="size-5" />
                      Imported Staff
                    </CardTitle>
                    <div className="text-muted-foreground text-sm">
                      Upload a new file to replace the current staff list.
                    </div>
                  </CardHeader>
                </Card>

                {/* Show the full list in the table for verification */}
                <Card>
                  <CardHeader>
                    <CardTitle>Imported Staff List</CardTitle>
                    <CardDescription>
                      Complete list of imported staff members
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-auto rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted/50 sticky top-0">
                          <TableRow>
                            <TableHead className="w-16">S. No.</TableHead>
                            <TableHead>Staff Name</TableHead>
                            <TableHead>Staff ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {staffList.map((s, index) => (
                            <TableRow key={s.uuid}>
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                {s.staffName}
                              </TableCell>
                              <TableCell>
                                <code className="text-xs">{s.staffId}</code>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            <div className="mt-2 flex items-center justify-between">
              <div className="text-muted-foreground text-sm">
                <div className="font-medium">
                  Imported staff entries: {staffList.length}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
