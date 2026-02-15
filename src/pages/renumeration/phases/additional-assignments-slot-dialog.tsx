import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { useState } from 'react';

import type { Person, RenumerationRoleEntry, SlotWiseAssignmentEntry } from '@/types';

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

interface SlotDialogProps {
  roles: RenumerationRoleEntry[];
  staff: Person[];
  unavailablePersonIds: string[];
  onAdd: (entry: SlotWiseAssignmentEntry) => void;
}

export function AdditionalAssignmentsSlotDialog({
  roles,
  staff,
  unavailablePersonIds,
  onAdd,
}: SlotDialogProps) {
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState('');
  const [source, setSource] = useState<'faculty' | 'staff'>();
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  const handleFacultyChange = (value: string) => {
    setPersonId(value);
    const selectedPerson = staff.find((s) => s.id === value);
    setSource(selectedPerson!.source);
  };

  const handleSubmit = () => {
    if (!selectedRoleId || !personId || !source) {
      toast.error('Please fill all required fields');
      return;
    }

    const activeRole = roles.find((r) => r.id === selectedRoleId);
    if (!activeRole) {
      toast.error('Invalid role selected');
      return;
    }

    const entry: SlotWiseAssignmentEntry = {
      roleId: selectedRoleId,
      personId: personId,
      source: source,
    };
    onAdd(entry);

    setOpen(false);
    setPersonId('');
    setSource(undefined);
    setSelectedRoleId('');
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
          <DialogTitle>Add Slot-wise Duty</DialogTitle>
          <DialogDescription>Add a faculty and role for this slot.</DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Role</FieldLabel>
            <FieldContent>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Slot-wise Roles</SelectLabel>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>Faculty</FieldLabel>
            <FieldContent>
              <Select value={personId} onValueChange={handleFacultyChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select faculty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>
                      Staff ({staff.filter((s) => s.source === 'staff').length})
                    </SelectLabel>
                    {staff
                      .filter((s) => s.source === 'staff')
                      .map((s) => (
                        <SelectItem
                          key={s.id}
                          value={s.id}
                          disabled={unavailablePersonIds.includes(s.id)}
                        >
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>

                  <SelectSeparator />

                  <SelectGroup>
                    <SelectLabel>
                      Faculty ({staff.filter((s) => s.source === 'faculty').length})
                    </SelectLabel>
                    {staff
                      .filter((s) => s.source === 'faculty')
                      .map((s) => (
                        <SelectItem
                          key={s.id}
                          value={s.id}
                          disabled={unavailablePersonIds.includes(s.id)}
                        >
                          {s.name} ({s.id})
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
