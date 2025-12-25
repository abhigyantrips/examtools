import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  ChevronDown,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

import { useMemo, useState } from 'react';

import type { Assignment, DutySlot, ExamStructure, Faculty } from '@/types';

import { cn } from '@/lib/utils';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* ========== Add Duty Dialog ========== */

interface AddDutyDialogProps {
  faculty: Faculty[];
  examStructure: ExamStructure;
  onAdd: (a: Assignment) => {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  prefilledFaculty?: Faculty;
  prefilledSlot?: DutySlot;
}

export function AddDutyDialog({
  faculty,
  examStructure,
  onAdd,
  prefilledFaculty,
  prefilledSlot,
}: AddDutyDialogProps) {
  const [open, setOpen] = useState(false);
  const [facultyId, setFacultyId] = useState(prefilledFaculty?.facultyId || '');
  const [day, setDay] = useState(prefilledSlot?.day ?? -1);
  const [slot, setSlot] = useState(prefilledSlot?.slot ?? -1);
  const [role, setRole] = useState('regular');
  const [roomNumber, setRoomNumber] = useState('');

  // Get available rooms for selected slot
  const selectedSlot = useMemo(() => {
    if (day === -1 || slot === -1) return null;
    return examStructure.dutySlots.find(
      (s) => s.day === day && s.slot === slot
    );
  }, [examStructure.dutySlots, day, slot]);

  const handleSubmit = () => {
    if (!facultyId || day === -1 || slot === -1) {
      toast.error('Please fill all required fields');
      return;
    }

    const assignment: Assignment = {
      day,
      slot,
      facultyId,
      role: role as 'regular' | 'reliever' | 'squad' | 'buffer',
      roomNumber: role === 'regular' ? roomNumber : undefined,
    };

    const result = onAdd(assignment);

    if (!result.valid) {
      result.errors.forEach((error) => {
        toast.error(error);
      });
      return;
    }

    setOpen(false);
    setFacultyId(prefilledFaculty?.facultyId || '');
    setDay(prefilledSlot?.day ?? -1);
    setSlot(prefilledSlot?.slot ?? -1);
    setRole('regular');
    setRoomNumber('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs">
          <Plus className="size-3" />
          Add Duty
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Duty Assignment</DialogTitle>
          <DialogDescription>
            Add a new duty assignment. All fields are required.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {/* Faculty Selection */}
          <Field>
            <FieldLabel>Faculty</FieldLabel>
            <FieldContent>
              <FacultyCombobox
                faculty={faculty}
                value={facultyId}
                onValueChange={setFacultyId}
                disabled={!!prefilledFaculty}
              />
            </FieldContent>
          </Field>

          {/* Slot Selection */}
          {!prefilledSlot && (
            <Field>
              <FieldLabel>Slot</FieldLabel>
              <FieldContent>
                <Select
                  value={day !== -1 ? `${day}-${slot}` : undefined}
                  onValueChange={(val) => {
                    const [d, s] = val.split('-').map(Number);
                    setDay(d);
                    setSlot(s);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {examStructure.dutySlots.map((s) => (
                      <SelectItem
                        key={`${s.day}-${s.slot}`}
                        value={`${s.day}-${s.slot}`}
                      >
                        Day {s.day + 1}, Slot {s.slot + 1} (
                        {new Date(s.date).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          )}

          {/* Role Selection */}
          <Field>
            <FieldLabel>Role</FieldLabel>
            <FieldContent>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="reliever">Reliever</SelectItem>
                  <SelectItem value="squad">Squad</SelectItem>
                  <SelectItem value="buffer">Buffer</SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          {/* Room Number (only for regular) */}
          {role === 'regular' && selectedSlot && (
            <Field>
              <FieldLabel>Room Number</FieldLabel>
              <FieldContent>
                <Select value={roomNumber} onValueChange={setRoomNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSlot.rooms.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          )}
        </FieldGroup>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit}>
            Add Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========== Transfer Dialog ========== */

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment;
  allFaculty: Faculty[];
  onTransfer: (
    a: Assignment,
    targetId: string
  ) => { valid: boolean; errors: string[]; warnings: string[] };
}

export function TransferDialog({
  open,
  onOpenChange,
  assignment,
  allFaculty,
  onTransfer,
}: TransferDialogProps) {
  const [selectedFaculty, setSelectedFaculty] = useState('');

  const handleTransfer = () => {
    if (!selectedFaculty) return;

    const result = onTransfer(assignment, selectedFaculty);

    if (!result.valid) {
      result.errors.forEach((error) => toast.error(error));
      return;
    }

    onOpenChange(false);
    setSelectedFaculty('');
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onOpenChange(true)}
      >
        <UserPlus className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Duty</DialogTitle>
            <DialogDescription>
              Transfer this duty assignment to another faculty member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">
              <div className="font-medium">Current Assignment</div>
              <div className="text-muted-foreground">
                Day {assignment.day + 1}, Slot {assignment.slot + 1} •{' '}
                {assignment.role.toUpperCase()}
                {assignment.roomNumber && ` • Room ${assignment.roomNumber}`}
              </div>
            </div>
            <FacultyCombobox
              faculty={allFaculty}
              value={selectedFaculty}
              onValueChange={setSelectedFaculty}
              placeholder="Select target faculty"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={!selectedFaculty}>
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ========== Swap Dialog ========== */

interface SwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment;
  allFaculty: Faculty[];
  allAssignments: Assignment[];
  onSwap: (a: Assignment, b: Assignment) => void;
}

export function SwapDialog({
  open,
  onOpenChange,
  assignment,
  allFaculty,
  allAssignments,
  onSwap,
}: SwapDialogProps) {
  const [selectedAssignment, setSelectedAssignment] = useState<string>('');

  // Group assignments by faculty (only same slot)
  const facultyWithDuties = useMemo(() => {
    const sameSlotAssignments = allAssignments.filter(
      (a) => a.day === assignment.day && a.slot === assignment.slot
    );

    const grouped = new Map<string, Assignment[]>();
    sameSlotAssignments.forEach((a) => {
      if (a.facultyId === assignment.facultyId) return; // Skip self
      if (!grouped.has(a.facultyId)) grouped.set(a.facultyId, []);
      grouped.get(a.facultyId)!.push(a);
    });

    return Array.from(grouped.entries()).map(([facultyId, duties]) => {
      const fac = allFaculty.find((f) => f.facultyId === facultyId);
      return { faculty: fac, duties };
    });
  }, [allAssignments, assignment, allFaculty]);

  const handleSwap = () => {
    if (!selectedAssignment) return;

    const targetAssignment = allAssignments.find(
      (a) => `${a.facultyId}-${a.role}` === selectedAssignment
    );

    if (!targetAssignment) {
      toast.error('Target assignment not found');
      return;
    }

    onSwap(assignment, targetAssignment);
    onOpenChange(false);
    setSelectedAssignment('');
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onOpenChange(true)}
      >
        <ArrowRightLeft className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Swap Duty</DialogTitle>
            <DialogDescription>
              Select a faculty member from the same slot to swap duties with.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">
              <div className="font-medium">Current Assignment</div>
              <div className="text-muted-foreground">
                Day {assignment.day + 1}, Slot {assignment.slot + 1} •{' '}
                {assignment.role.toUpperCase()}
                {assignment.roomNumber && ` • Room ${assignment.roomNumber}`}
              </div>
            </div>

            {facultyWithDuties.length === 0 ? (
              <div className="text-muted-foreground text-center text-sm">
                No other faculty assigned to this slot
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {facultyWithDuties.map(({ faculty: fac, duties }) => (
                  <Collapsible key={fac?.facultyId}>
                    <CollapsibleTrigger className="hover:bg-muted flex w-full items-center justify-between rounded-lg border p-3 text-left">
                      <div>
                        <div className="font-medium">
                          {fac?.facultyName || 'Unknown'}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {fac?.facultyId}
                        </div>
                      </div>
                      <ChevronDown className="size-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 pt-2">
                      {duties.map((duty) => (
                        <button
                          key={`${duty.facultyId}-${duty.role}`}
                          className={cn(
                            'hover:bg-muted flex w-full items-center justify-between rounded-lg border p-2 text-left text-sm transition-colors',
                            selectedAssignment ===
                              `${duty.facultyId}-${duty.role}` &&
                              'bg-primary/10 border-primary'
                          )}
                          onClick={() =>
                            setSelectedAssignment(
                              `${duty.facultyId}-${duty.role}`
                            )
                          }
                        >
                          <div>
                            <Badge variant="outline" className="text-xs">
                              {duty.role.toUpperCase()}
                            </Badge>
                            {duty.roomNumber && (
                              <span className="text-muted-foreground ml-2 text-xs">
                                Room {duty.roomNumber}
                              </span>
                            )}
                          </div>
                          {selectedAssignment ===
                            `${duty.facultyId}-${duty.role}` && (
                            <Check className="text-primary size-4" />
                          )}
                        </button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSwap} disabled={!selectedAssignment}>
              Swap Duties
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ========== Delete Confirm Dialog ========== */

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment;
  faculty: Faculty | undefined;
  slot: DutySlot | undefined;
  onDelete: (a: Assignment) => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  assignment,
  faculty,
  slot,
  onDelete,
}: DeleteConfirmDialogProps) {
  const handleDelete = () => {
    onDelete(assignment);
    onOpenChange(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive h-8 w-8"
        onClick={() => onOpenChange(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive size-5" />
              Delete Assignment?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The following assignment will be
              permanently removed:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted/50 rounded-lg border p-4">
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Faculty:</span>{' '}
                <span className="font-medium">
                  {faculty?.facultyName || assignment.facultyId}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Slot:</span> Day{' '}
                {assignment.day + 1}, Slot {assignment.slot + 1}
              </div>
              {slot && (
                <div>
                  <span className="text-muted-foreground">Time:</span>{' '}
                  {new Date(slot.date).toLocaleDateString()} • {slot.startTime}{' '}
                  - {slot.endTime}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Role:</span>{' '}
                <Badge variant="outline">{assignment.role.toUpperCase()}</Badge>
              </div>
              {assignment.roomNumber && (
                <div>
                  <span className="text-muted-foreground">Room:</span>{' '}
                  {assignment.roomNumber}
                </div>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ========== Faculty Combobox Component ========== */

interface FacultyComboboxProps {
  faculty: Faculty[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function FacultyCombobox({
  faculty,
  value,
  onValueChange,
  disabled,
  placeholder = 'Select faculty',
}: FacultyComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedFaculty = faculty.find((f) => f.facultyId === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedFaculty ? (
            <span>
              {selectedFaculty.facultyName} ({selectedFaculty.facultyId})
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search faculty..." />
          <CommandList>
            <CommandEmpty>No faculty found.</CommandEmpty>
            <CommandGroup>
              {faculty.map((f) => (
                <CommandItem
                  key={f.facultyId}
                  value={`${f.facultyName} ${f.facultyId} ${f.designation}`}
                  onSelect={() => {
                    onValueChange(f.facultyId);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      value === f.facultyId ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{f.facultyName}</span>
                    <span className="text-muted-foreground text-xs">
                      {f.facultyId} • {f.designation}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
