import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { useState } from 'react';

import type {
  NonSlotWiseAssignmentEntry,
  Person,
  RenumerationRoleEntry,
} from '@/types';

import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AdditionalAssignmentDialogProps {
  role: RenumerationRoleEntry;
  staff: Person[];
  unavailablePersonIds: string[];
  onAdd: (NonSlotWiseAssignmentEntry: NonSlotWiseAssignmentEntry) => void;
}

export function AdditionalAssignmentsDialog({
  role,
  staff,
  unavailablePersonIds,
  onAdd,
}: AdditionalAssignmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState('');
  const [source, setSource] = useState<'faculty' | 'staff'>();
  const [count, setCount] = useState(-1);

  const handleFacultyChange = (value: string) => {
    setPersonId(value);
    const selectedPerson = staff.find((s) => s.refId === value);
    setSource(selectedPerson!.source);
  };

  const handleSubmit = () => {
    if (!personId || !source || count <= 0) {
      toast.error('Please fill all required fields');
      return;
    }

    const NonSlotWiseAssignmentEntry: NonSlotWiseAssignmentEntry = {
      roleId: role.id,
      personId: personId,
      source: source,
      count: count,
    };

    onAdd(NonSlotWiseAssignmentEntry);
    setOpen(false);
    // Reset form
    setPersonId('');
    setSource(undefined);
    setCount(-1);
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
          <DialogTitle>Add Duty</DialogTitle>
          <DialogDescription>Add a new duty.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {/* Faculty Selection */}
          <Field>
            <FieldLabel>Faculty</FieldLabel>
            <FieldContent>
              <Select value={personId} onValueChange={handleFacultyChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select faculty" />
                </SelectTrigger>
                {/* Group the faculty by source */}

                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>
                      Staff ({staff.filter((s) => s.source === 'staff').length})
                    </SelectLabel>
                    {staff
                      .filter((s) => s.source === 'staff')
                      .map((s) => (
                        <SelectItem
                          key={s.refId}
                          value={s.refId}
                          disabled={unavailablePersonIds.includes(s.refId)}
                        >
                          {s.name} ({s.staffId})
                        </SelectItem>
                      ))}
                  </SelectGroup>

                  <SelectSeparator />

                  <SelectGroup>
                    <SelectLabel>
                      Faculty (
                      {staff.filter((s) => s.source === 'faculty').length})
                    </SelectLabel>
                    {staff
                      .filter((s) => s.source === 'faculty')
                      .map((s) => (
                        <SelectItem
                          key={s.refId}
                          value={s.refId}
                          disabled={unavailablePersonIds.includes(s.refId)}
                        >
                          {s.name} ({s.staffId})
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
          {/* Duty Count Assignment */}
          <Field>
            <FieldLabel>Duty Count</FieldLabel>
            <FieldContent>
              <input
                type="number"
                className="border-input focus:ring-primary w-full rounded-md border bg-transparent px-3 py-2 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                value={count === -1 ? '' : count}
                onChange={(e) => setCount(parseInt(e.target.value))}
                min={1}
              />
            </FieldContent>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit}>
            Add Duty
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
