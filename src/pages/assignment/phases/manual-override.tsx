import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  Info,
  Plus,
  Save,
  Search,
  Trash2,
  Undo2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { Assignment, DutySlot, ExamStructure, Faculty } from '@/types';

import { cn } from '@/lib/utils';
import {
  type ValidationResult,
  validateAssignmentAdd,
  validateAssignmentUpdate,
  validateSwap,
} from '@/lib/validation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  AddDutyDialog,
  DeleteConfirmDialog,
  SwapDialog,
  TransferDialog,
} from './manual-override-dialogs';

interface ManualOverrideProps {
  faculty: Faculty[];
  examStructure: ExamStructure;
  assignments: Assignment[];
  onAssignmentsUpdated: (assignments: Assignment[]) => void;
}

type ViewMode = 'faculty' | 'slot';

type AssignmentChange =
  | { type: 'add'; assignment: Assignment; id: string; timestamp: number }
  | { type: 'delete'; assignment: Assignment; id: string; timestamp: number }
  | {
      type: 'update';
      old: Assignment;
      new: Assignment;
      id: string;
      timestamp: number;
    }
  | {
      type: 'swap';
      assignmentA: Assignment;
      assignmentB: Assignment;
      id: string;
      timestamp: number;
    };

export function ManualOverride({
  faculty,
  examStructure,
  assignments,
  onAssignmentsUpdated,
}: ManualOverrideProps) {
  const [view, setView] = useState<ViewMode>('faculty');
  const [searchQuery, setSearchQuery] = useState('');
  const [changes, setChanges] = useState<AssignmentChange[]>([]);
  const [draftAssignments, setDraftAssignments] =
    useState<Assignment[]>(assignments);

  // Sync draft with props when no changes
  useEffect(() => {
    if (changes.length === 0) {
      setDraftAssignments(assignments);
    }
  }, [assignments, changes.length]);

  // Helper to get faculty details
  const getFaculty = useCallback(
    (id: string) => faculty.find((f) => f.facultyId === id),
    [faculty]
  );

  // Helper to get slot details
  const getSlot = useCallback(
    (day: number, slot: number) =>
      examStructure.dutySlots.find((s) => s.day === day && s.slot === slot),
    [examStructure.dutySlots]
  );

  // Filtered data based on search
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase();

    if (view === 'faculty') {
      return faculty.filter(
        (f) =>
          f.facultyName.toLowerCase().includes(query) ||
          f.facultyId.toLowerCase().includes(query) ||
          f.designation.toLowerCase().includes(query)
      );
    } else {
      if (!query) return examStructure.dutySlots;

      return examStructure.dutySlots.filter((s) => {
        const slotAssignments = draftAssignments.filter(
          (a) => a.day === s.day && a.slot === s.slot
        );
        const hasMatchingFaculty = slotAssignments.some((a) => {
          const f = getFaculty(a.facultyId);
          return (
            f?.facultyName.toLowerCase().includes(query) ||
            f?.facultyId.toLowerCase().includes(query) ||
            f?.designation.toLowerCase().includes(query)
          );
        });
        return hasMatchingFaculty;
      });
    }
  }, [
    faculty,
    examStructure.dutySlots,
    draftAssignments,
    searchQuery,
    view,
    getFaculty,
  ]);

  // Actions
  const handleAdd = useCallback(
    (newAssignment: Assignment): ValidationResult => {
      const slot = getSlot(newAssignment.day, newAssignment.slot);
      if (!slot) {
        toast.error('Slot not found');
        return { valid: false, errors: ['Slot not found'], warnings: [] };
      }

      const validation = validateAssignmentAdd(
        newAssignment,
        draftAssignments,
        slot,
        faculty
      );

      if (!validation.valid) {
        return validation; // Return errors to dialog
      }

      const change: AssignmentChange = {
        type: 'add',
        assignment: newAssignment,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      setChanges((prev) => [...prev, change]);
      setDraftAssignments((prev) => [...prev, newAssignment]);

      if (validation.warnings.length > 0) {
        toast.warning(validation.warnings[0]);
      } else {
        toast.success('Assignment added');
      }

      return validation;
    },
    [draftAssignments, faculty, getSlot]
  );

  const handleDelete = useCallback((assignment: Assignment) => {
    const change: AssignmentChange = {
      type: 'delete',
      assignment,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    setChanges((prev) => [...prev, change]);
    setDraftAssignments((prev) =>
      prev.filter(
        (a) =>
          !(
            a.day === assignment.day &&
            a.slot === assignment.slot &&
            a.facultyId === assignment.facultyId &&
            a.role === assignment.role
          )
      )
    );

    toast.success('Assignment deleted');
  }, []);

  const handleUpdate = useCallback(
    (oldAssignment: Assignment, newAssignment: Assignment) => {
      const slot = getSlot(newAssignment.day, newAssignment.slot);
      if (!slot) {
        toast.error('Slot not found');
        return { valid: false, errors: ['Slot not found'], warnings: [] };
      }

      const validation = validateAssignmentUpdate(
        oldAssignment,
        newAssignment,
        draftAssignments,
        slot,
        faculty
      );

      if (!validation.valid) {
        return validation;
      }

      const change: AssignmentChange = {
        type: 'update',
        old: oldAssignment,
        new: newAssignment,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      setChanges((prev) => [...prev, change]);
      setDraftAssignments((prev) =>
        prev.map((a) =>
          a.day === oldAssignment.day &&
          a.slot === oldAssignment.slot &&
          a.facultyId === oldAssignment.facultyId &&
          a.role === oldAssignment.role
            ? newAssignment
            : a
        )
      );

      if (validation.warnings.length > 0) {
        toast.warning(validation.warnings[0]);
      } else {
        toast.success('Assignment updated');
      }

      return validation;
    },
    [draftAssignments, faculty, getSlot]
  );

  const handleSwap = useCallback(
    (assignmentA: Assignment, assignmentB: Assignment) => {
      const validation = validateSwap(
        assignmentA,
        assignmentB,
        draftAssignments
      );

      if (!validation.valid) {
        toast.error(validation.errors[0]);
        return;
      }

      const change: AssignmentChange = {
        type: 'swap',
        assignmentA,
        assignmentB,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      setChanges((prev) => [...prev, change]);
      setDraftAssignments((prev) =>
        prev.map((a) => {
          if (
            a.day === assignmentA.day &&
            a.slot === assignmentA.slot &&
            a.facultyId === assignmentA.facultyId &&
            a.role === assignmentA.role
          ) {
            return {
              ...assignmentB,
              facultyId: assignmentA.facultyId,
            };
          }
          if (
            a.day === assignmentB.day &&
            a.slot === assignmentB.slot &&
            a.facultyId === assignmentB.facultyId &&
            a.role === assignmentB.role
          ) {
            return {
              ...assignmentA,
              facultyId: assignmentB.facultyId,
            };
          }
          return a;
        })
      );

      if (validation.warnings.length > 0) {
        toast.warning(validation.warnings[0]);
      } else {
        toast.success('Duties swapped');
      }
    },
    [draftAssignments]
  );

  const handleTransfer = useCallback(
    (assignment: Assignment, targetFacultyId: string) => {
      const newAssignment = { ...assignment, facultyId: targetFacultyId };
      const slot = getSlot(assignment.day, assignment.slot);
      if (!slot) {
        toast.error('Slot not found');
        return { valid: false, errors: ['Slot not found'], warnings: [] };
      }

      // Remove old assignment from consideration
      const otherAssignments = draftAssignments.filter(
        (a) =>
          !(
            a.day === assignment.day &&
            a.slot === assignment.slot &&
            a.facultyId === assignment.facultyId &&
            a.role === assignment.role
          )
      );

      const validation = validateAssignmentAdd(
        newAssignment,
        otherAssignments,
        slot,
        faculty
      );

      if (!validation.valid) {
        return validation;
      }

      // Record as delete + add
      const deleteChange: AssignmentChange = {
        type: 'delete',
        assignment,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      const addChange: AssignmentChange = {
        type: 'add',
        assignment: newAssignment,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      setChanges((prev) => [...prev, deleteChange, addChange]);
      setDraftAssignments((prev) => [
        ...prev.filter(
          (a) =>
            !(
              a.day === assignment.day &&
              a.slot === assignment.slot &&
              a.facultyId === assignment.facultyId &&
              a.role === assignment.role
            )
        ),
        newAssignment,
      ]);

      const targetFaculty = getFaculty(targetFacultyId);
      if (validation.warnings.length > 0) {
        toast.warning(validation.warnings[0]);
      } else {
        toast.success(`Duty transferred to ${targetFaculty?.facultyName}`);
      }

      return validation;
    },
    [draftAssignments, faculty, getFaculty, getSlot]
  );

  const handleSave = useCallback(() => {
    onAssignmentsUpdated(draftAssignments);
    setChanges([]);
    toast.success(`Saved ${changes.length} change(s)`);
  }, [draftAssignments, changes.length, onAssignmentsUpdated]);

  const handleDiscardAll = useCallback(() => {
    setChanges([]);
    setDraftAssignments(assignments);
    toast.info('All changes discarded');
  }, [assignments]);

  const hasChanges = changes.length > 0;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>Manual Override</CardTitle>
          <CardDescription>
            Review and manually edit assignment data.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <>
              <ChangeSummary
                changes={changes}
                faculty={faculty}
                onDiscardAll={handleDiscardAll}
              />
              <Button onClick={handleSave} className="gap-2">
                <Save className="size-4" />
                Save Changes
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* View Tabs */}
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as ViewMode)}
            className="w-full sm:w-auto"
          >
            <TabsList>
              <TabsTrigger value="faculty">
                <Users className="size-3" />
                By Faculty
              </TabsTrigger>
              <TabsTrigger value="slot">
                <Info className="size-3" />
                By Slot
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="w-full sm:w-64">
            <InputGroup>
              <InputGroupInput
                placeholder="Search faculty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            {view === 'faculty' ? (
              <FacultyView
                data={filteredData as Faculty[]}
                assignments={draftAssignments}
                examStructure={examStructure}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onAdd={handleAdd}
                onSwap={handleSwap}
                onTransfer={handleTransfer}
                getSlot={getSlot}
                allFaculty={faculty}
              />
            ) : (
              <SlotView
                data={filteredData as DutySlot[]}
                assignments={draftAssignments}
                faculty={faculty}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onAdd={handleAdd}
                onSwap={handleSwap}
                onTransfer={handleTransfer}
                getFaculty={getFaculty}
              />
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ========== Change Summary ========== */

interface ChangeSummaryProps {
  changes: AssignmentChange[];
  faculty: Faculty[];
  onDiscardAll: () => void;
}

function ChangeSummary({ changes, faculty, onDiscardAll }: ChangeSummaryProps) {
  const summary = useMemo(() => {
    const adds = changes.filter((c) => c.type === 'add').length;
    const deletes = changes.filter((c) => c.type === 'delete').length;
    const updates = changes.filter((c) => c.type === 'update').length;
    const swaps = changes.filter((c) => c.type === 'swap').length;
    return { adds, deletes, updates, swaps };
  }, [changes]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <AlertCircle className="size-4" />
          {changes.length} Change{changes.length !== 1 ? 's' : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Pending Changes</h4>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-8 gap-2"
              onClick={onDiscardAll}
            >
              <Undo2 className="size-3" />
              Discard All
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {summary.adds > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-2 dark:bg-green-900/20">
                <Plus className="size-4 text-green-600 dark:text-green-400" />
                <span className="font-medium">{summary.adds} Added</span>
              </div>
            )}
            {summary.deletes > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 dark:bg-red-900/20">
                <Trash2 className="size-4 text-red-600 dark:text-red-400" />
                <span className="font-medium">{summary.deletes} Deleted</span>
              </div>
            )}
            {summary.updates > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-2 dark:bg-blue-900/20">
                <Check className="size-4 text-blue-600 dark:text-blue-400" />
                <span className="font-medium">{summary.updates} Updated</span>
              </div>
            )}
            {summary.swaps > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-purple-50 p-2 dark:bg-purple-900/20">
                <ArrowRightLeft className="size-4 text-purple-600 dark:text-purple-400" />
                <span className="font-medium">{summary.swaps} Swapped</span>
              </div>
            )}
          </div>

          <Separator />

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {changes.map((change) => (
              <ChangeItem key={change.id} change={change} faculty={faculty} />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChangeItem({
  change,
  faculty,
}: {
  change: AssignmentChange;
  faculty: Faculty[];
}) {
  const getFacultyName = (id: string) =>
    faculty.find((f) => f.facultyId === id)?.facultyName || id;

  if (change.type === 'add') {
    return (
      <div className="text-muted-foreground flex items-start gap-2 rounded border p-2 text-xs">
        <Plus className="mt-0.5 size-3 shrink-0 text-green-600 dark:text-green-400" />
        <div>
          <div className="font-medium">
            {getFacultyName(change.assignment.facultyId)}
          </div>
          <div>
            Day {change.assignment.day + 1}, Slot {change.assignment.slot + 1} •{' '}
            {change.assignment.role.toUpperCase()}
            {change.assignment.roomNumber &&
              ` • ${change.assignment.roomNumber}`}
          </div>
        </div>
      </div>
    );
  }

  if (change.type === 'delete') {
    return (
      <div className="text-muted-foreground flex items-start gap-2 rounded border p-2 text-xs">
        <Trash2 className="mt-0.5 size-3 shrink-0 text-red-600 dark:text-red-400" />
        <div>
          <div className="font-medium">
            {getFacultyName(change.assignment.facultyId)}
          </div>
          <div>
            Day {change.assignment.day + 1}, Slot {change.assignment.slot + 1} •{' '}
            {change.assignment.role.toUpperCase()}
          </div>
        </div>
      </div>
    );
  }

  if (change.type === 'update') {
    return (
      <div className="text-muted-foreground flex items-start gap-2 rounded border p-2 text-xs">
        <Check className="mt-0.5 size-3 shrink-0 text-blue-600 dark:text-blue-400" />
        <div>
          <div className="font-medium">
            {getFacultyName(change.old.facultyId)}
          </div>
          <div>
            Day {change.old.day + 1}, Slot {change.old.slot + 1} • Updated{' '}
            {change.old.role !== change.new.role && 'role'}
            {change.old.roomNumber !== change.new.roomNumber && 'room'}
          </div>
        </div>
      </div>
    );
  }

  if (change.type === 'swap') {
    return (
      <div className="text-muted-foreground flex items-start gap-2 rounded border p-2 text-xs">
        <ArrowRightLeft className="mt-0.5 size-3 shrink-0 text-purple-600 dark:text-purple-400" />
        <div>
          <div className="font-medium">Swapped duties</div>
          <div>
            {getFacultyName(change.assignmentA.facultyId)} ↔{' '}
            {getFacultyName(change.assignmentB.facultyId)}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/* ========== Faculty View ========== */

interface FacultyViewProps {
  data: Faculty[];
  assignments: Assignment[];
  examStructure: ExamStructure;
  onDelete: (a: Assignment) => void;
  onUpdate: (
    old: Assignment,
    newA: Assignment
  ) => { valid: boolean; errors: string[]; warnings: string[] };
  onAdd: (a: Assignment) => {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  onSwap: (a: Assignment, b: Assignment) => void;
  onTransfer: (
    a: Assignment,
    targetId: string
  ) => { valid: boolean; errors: string[]; warnings: string[] };
  getSlot: (d: number, s: number) => DutySlot | undefined;
  allFaculty: Faculty[];
}

function FacultyView({
  data,
  assignments,
  examStructure,
  onDelete,
  onUpdate,
  onAdd,
  onSwap,
  onTransfer,
  getSlot,
  allFaculty,
}: FacultyViewProps) {
  return (
    <TableBody>
      {data.map((faculty) => {
        const facultyAssignments = assignments.filter(
          (a) => a.facultyId === faculty.facultyId
        );

        return (
          <div key={faculty.facultyId} className="contents">
            {/* Faculty Header Row */}
            <TableRow className="bg-muted/30 hover:bg-muted/50 border-t">
              <TableCell colSpan={6} className="font-medium">
                <div className="flex items-center justify-between pl-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      {faculty.facultyName} ({faculty.facultyId})
                    </span>
                    <span className="text-muted-foreground">
                      {faculty.designation}
                    </span>
                  </div>
                  <Badge variant="outline">
                    {facultyAssignments.length} Duties
                  </Badge>
                </div>
              </TableCell>
            </TableRow>

            {/* Add Duty Button Row */}
            <TableRow>
              <TableCell colSpan={6} className="pl-8">
                <AddDutyDialog
                  faculty={allFaculty}
                  examStructure={examStructure}
                  onAdd={onAdd}
                  prefilledFaculty={faculty}
                />
              </TableCell>
            </TableRow>

            {/* Assignments Rows */}
            {facultyAssignments.map((assignment, idx) => (
              <FacultyAssignmentRow
                key={`${assignment.day}-${assignment.slot}-${assignment.role}-${idx}`}
                assignment={assignment}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onSwap={onSwap}
                onTransfer={onTransfer}
                allFaculty={allFaculty}
                allAssignments={assignments}
                slot={getSlot(assignment.day, assignment.slot)}
              />
            ))}
          </div>
        );
      })}
    </TableBody>
  );
}

interface FacultyAssignmentRowProps {
  assignment: Assignment;
  onUpdate: (
    old: Assignment,
    newA: Assignment
  ) => { valid: boolean; errors: string[]; warnings: string[] };
  onDelete: (a: Assignment) => void;
  onSwap: (a: Assignment, b: Assignment) => void;
  onTransfer: (
    a: Assignment,
    targetId: string
  ) => { valid: boolean; errors: string[]; warnings: string[] };
  allFaculty: Faculty[];
  allAssignments: Assignment[];
  slot: DutySlot | undefined;
}

const FacultyAssignmentRow = React.memo(
  ({
    assignment,
    onDelete,
    onSwap,
    onTransfer,
    allFaculty,
    allAssignments,
    slot,
  }: FacultyAssignmentRowProps) => {
    const [showTransfer, setShowTransfer] = useState(false);
    const [showSwap, setShowSwap] = useState(false);
    const [showDelete, setShowDelete] = useState(false);

    return (
      <TableRow className="group hover:bg-muted/50 transition-colors">
        <TableCell className="w-[200px] pl-8">
          <div className="text-sm">
            Day {assignment.day + 1}, Slot {assignment.slot + 1}
          </div>
          <div className="text-muted-foreground text-xs">
            {slot?.date ? new Date(slot.date).toLocaleDateString() : ''}{' '}
            {slot?.startTime}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="secondary">{assignment.role.toUpperCase()}</Badge>
        </TableCell>
        <TableCell
          className={cn(assignment.roomNumber ? '' : 'text-muted-foreground')}
        >
          {assignment.roomNumber || 'N/A'}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <TransferDialog
              open={showTransfer}
              onOpenChange={setShowTransfer}
              assignment={assignment}
              allFaculty={allFaculty}
              onTransfer={onTransfer}
            />
            <SwapDialog
              open={showSwap}
              onOpenChange={setShowSwap}
              assignment={assignment}
              allFaculty={allFaculty}
              allAssignments={allAssignments}
              onSwap={onSwap}
            />
            <DeleteConfirmDialog
              open={showDelete}
              onOpenChange={setShowDelete}
              assignment={assignment}
              faculty={allFaculty.find(
                (f) => f.facultyId === assignment.facultyId
              )}
              slot={slot}
              onDelete={onDelete}
            />
          </div>
        </TableCell>
      </TableRow>
    );
  }
);

/* ========== Slot View ========== */

interface SlotViewProps {
  data: DutySlot[];
  assignments: Assignment[];
  faculty: Faculty[];
  onDelete: (a: Assignment) => void;
  onUpdate: (
    old: Assignment,
    newA: Assignment
  ) => { valid: boolean; errors: string[]; warnings: string[] };
  onAdd: (a: Assignment) => {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  onSwap: (a: Assignment, b: Assignment) => void;
  onTransfer: (
    a: Assignment,
    targetId: string
  ) => { valid: boolean; errors: string[]; warnings: string[] };
  getFaculty: (id: string) => Faculty | undefined;
}

function SlotView({
  data,
  assignments,
  faculty,
  onDelete,
  onUpdate,
  onAdd,
  onSwap,
  onTransfer,
  getFaculty,
}: SlotViewProps) {
  return (
    <TableBody>
      {data.map((slot) => {
        const slotAssignments = assignments.filter(
          (a) => a.day === slot.day && a.slot === slot.slot
        );

        return (
          <div key={`${slot.day}-${slot.slot}`} className="contents">
            {/* Slot Header Row */}
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
                    {slotAssignments.length} Assigned
                  </Badge>
                </div>
              </TableCell>
            </TableRow>

            {/* Add Duty Button Row */}
            <TableRow>
              <TableCell colSpan={6} className="pl-8">
                <AddDutyDialog
                  faculty={faculty}
                  examStructure={{
                    days: 0,
                    dutySlots: [slot],
                    designationDutyCounts: {},
                  }}
                  onAdd={onAdd}
                  prefilledSlot={slot}
                />
              </TableCell>
            </TableRow>

            {/* Faculty Assignments for this Slot */}
            {slotAssignments.map((assignment, idx) => (
              <SlotAssignmentRow
                key={`${assignment.facultyId}-${assignment.role}-${idx}`}
                assignment={assignment}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onSwap={onSwap}
                onTransfer={onTransfer}
                allFaculty={faculty}
                allAssignments={assignments}
                facultyMember={getFaculty(assignment.facultyId)}
                slot={slot}
              />
            ))}
          </div>
        );
      })}
    </TableBody>
  );
}

interface SlotAssignmentRowProps {
  assignment: Assignment;
  onUpdate: (
    old: Assignment,
    newA: Assignment
  ) => { valid: boolean; errors: string[]; warnings: string[] };
  onDelete: (a: Assignment) => void;
  onSwap: (a: Assignment, b: Assignment) => void;
  onTransfer: (
    a: Assignment,
    targetId: string
  ) => { valid: boolean; errors: string[]; warnings: string[] };
  allFaculty: Faculty[];
  allAssignments: Assignment[];
  facultyMember: Faculty | undefined;
  slot: DutySlot;
}

const SlotAssignmentRow = React.memo(
  ({
    assignment,
    onDelete,
    onSwap,
    onTransfer,
    allFaculty,
    allAssignments,
    facultyMember,
    slot,
  }: SlotAssignmentRowProps) => {
    const [showTransfer, setShowTransfer] = useState(false);
    const [showSwap, setShowSwap] = useState(false);
    const [showDelete, setShowDelete] = useState(false);

    return (
      <TableRow className="group hover:bg-muted/50 transition-colors">
        <TableCell className="w-[250px] pl-8">
          <div className="font-medium">
            {facultyMember?.facultyName || assignment.facultyId}
          </div>
          <div className="text-muted-foreground text-xs">
            {facultyMember?.facultyId}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="secondary">{assignment.role.toUpperCase()}</Badge>
        </TableCell>
        <TableCell>{assignment.roomNumber || '-'}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <TransferDialog
              open={showTransfer}
              onOpenChange={setShowTransfer}
              assignment={assignment}
              allFaculty={allFaculty}
              onTransfer={onTransfer}
            />
            <SwapDialog
              open={showSwap}
              onOpenChange={setShowSwap}
              assignment={assignment}
              allFaculty={allFaculty}
              allAssignments={allAssignments}
              onSwap={onSwap}
            />
            <DeleteConfirmDialog
              open={showDelete}
              onOpenChange={setShowDelete}
              assignment={assignment}
              faculty={facultyMember}
              slot={slot}
              onDelete={onDelete}
            />
          </div>
        </TableCell>
      </TableRow>
    );
  }
);
