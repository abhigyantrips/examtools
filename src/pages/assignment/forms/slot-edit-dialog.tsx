import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  Upload,
  X,
} from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';

import { useEffect, useState } from 'react';

import type { DutySlot, ExcelParseResult } from '@/types';

import { parseRoomsExcel } from '@/lib/excel';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SlotEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  slot: DutySlot;
  dayNumber: number;
  slotNumber: number;
  onSave: (slot: DutySlot) => void;
}

const timeOptions = [
  '8:00 AM',
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
  '6:00 PM',
];

const formSchema = z
  .object({
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
    subjectCode: z.string().optional(),
    subjectNames: z.string().optional(),
    regularDuties: z.number().min(1, 'Regular duties must be at least 1'),
    relieverDuties: z.number().min(0, 'Reliever duties cannot be negative'),
    squadDuties: z.number().min(0, 'Squad duties cannot be negative'),
    bufferDuties: z.number().min(0, 'Buffer duties cannot be negative'),
  })
  .refine((data) => data.startTime !== data.endTime, {
    message: 'Start time and end time cannot be the same',
    path: ['endTime'],
  });

type FormData = z.infer<typeof formSchema>;

export function SlotEditDialog({
  isOpen,
  onClose,
  slot,
  dayNumber,
  slotNumber,
  onSave,
}: SlotEditDialogProps) {
  const [rooms, setRooms] = useState<string[]>(slot.rooms);
  const [roomUploadResult, setRoomUploadResult] =
    useState<ExcelParseResult<string> | null>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startTime: slot.startTime,
      endTime: slot.endTime,
      subjectCode: slot.subjectCode || '',
      subjectNames: slot.subjectNames || '',
      regularDuties: slot.regularDuties,
      relieverDuties: slot.relieverDuties || 0,
      squadDuties: slot.squadDuties || 0,
      bufferDuties: slot.bufferDuties,
    },
  });

  // Watch regular duties to validate against room count
  const regularDuties = form.watch('regularDuties');

  // Reset form when slot changes
  useEffect(() => {
    form.reset({
      startTime: slot.startTime,
      endTime: slot.endTime,
      subjectCode: slot.subjectCode || '',
      subjectNames: slot.subjectNames || '',
      regularDuties: slot.regularDuties,
      relieverDuties: slot.relieverDuties || 0,
      squadDuties: slot.squadDuties || 0,
      bufferDuties: slot.bufferDuties,
    });
    setRooms(slot.rooms);
    setRoomUploadResult(null);
  }, [slot, form]);

  // Validate room count whenever regularDuties or rooms change
  useEffect(() => {
    const hasRoomMismatch = rooms.length !== regularDuties;

    if (hasRoomMismatch) {
      form.setError('regularDuties', {
        type: 'manual',
        message: `Regular duties (${regularDuties}) must match number of rooms (${rooms.length})`,
      });
    } else {
      form.clearErrors('regularDuties');
      // Force form state update
      form.trigger('regularDuties');
    }
  }, [regularDuties, rooms.length, form]);

  // Handle room upload
  const handleRoomUpload = async (file: File) => {
    setUploading(true);
    setRoomUploadResult({ data: [], errors: ['Uploading...'], warnings: [] });

    try {
      const result = await parseRoomsExcel(file);
      setRoomUploadResult(result);

      if (result.data.length > 0 && result.errors.length === 0) {
        setRooms(result.data);
        toast.success(`Uploaded ${result.data.length} rooms.`);

        // Clear errors and trigger revalidation
        form.clearErrors('regularDuties');
        setTimeout(() => {
          form.trigger(); // Trigger all field validation
        }, 100);
      } else if (result.errors.length > 0) {
        toast.error(`Room upload failed: ${result.errors[0]}`);
      }
    } catch (error) {
      const errorResult = {
        data: [],
        errors: [
          `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        warnings: [],
      };
      setRoomUploadResult(errorResult);
      toast.error('Room upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // Check if form is valid for submission
  const formErrors = form.formState.errors;
  const hasErrors = Object.keys(formErrors).length > 0;
  const hasRoomMismatch = rooms.length !== regularDuties;
  const isFormValid = !hasErrors && !hasRoomMismatch;

  // Handle save
  const onSubmit = (data: FormData) => {
    const updatedSlot: DutySlot = {
      ...slot,
      startTime: data.startTime,
      subjectCode: data.subjectCode,
      subjectNames: data.subjectNames,
      endTime: data.endTime,
      regularDuties: data.regularDuties,
      relieverDuties: data.relieverDuties,
      squadDuties: data.squadDuties,
      bufferDuties: data.bufferDuties,
      rooms: rooms,
    };

    onSave(updatedSlot);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] min-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Clock className="size-6" />
            Edit Day {dayNumber} - Slot {slotNumber}
          </DialogTitle>
          <DialogDescription>
            Configure timing, duty requirements, and room assignments for this
            examination slot.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Timing Configuration */}
          <div className="space-y-4">
            <h4 className="font-medium">Slot Details</h4>
            <div className="grid grid-cols-3 gap-4">
              <Controller
                control={form.control}
                name="startTime"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Start Time</FieldLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      name={field.name}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Select start time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="endTime"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>End Time</FieldLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      name={field.name}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                      >
                        <SelectValue placeholder="Select end time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="subjectCode"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Subject Code</FieldLabel>
                    <Input
                      {...field}
                      placeholder="e.g. CSE_1010"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            <div className="mt-2">
              <Controller
                control={form.control}
                name="subjectNames"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Subject Names</FieldLabel>
                    <Input
                      {...field}
                      placeholder="e.g. Data Structures, Algorithms"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
          </div>

          {/* Duty Requirements */}
          <div className="space-y-4">
            <h4 className="font-medium">Duty Requirements</h4>
            <div className="grid grid-cols-4 gap-4">
              <Controller
                control={form.control}
                name="regularDuties"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Regular Duties</FieldLabel>
                    <Input
                      type="number"
                      min="1"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 1)
                      }
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="relieverDuties"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Reliever Duties</FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="squadDuties"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Squad Duties</FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="bufferDuties"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Buffer Duties</FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            {/* Total Duties Display */}
            <div className="bg-muted rounded-lg p-3">
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {regularDuties +
                    form.watch('relieverDuties') +
                    form.watch('squadDuties') +
                    form.watch('bufferDuties')}
                </div>
                <div className="text-muted-foreground text-sm">
                  Total Duties Required
                </div>
              </div>
            </div>
          </div>

          {/* Room Upload */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 font-medium">
                <MapPin className="size-4" />
                Room Assignments ({rooms.length})
              </h4>

              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleRoomUpload(file);
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  disabled={uploading}
                />
                <Button variant="outline" size="sm" disabled={uploading}>
                  <Upload className="mr-2 size-3" />
                  {uploading ? 'Uploading...' : 'Upload Rooms'}
                </Button>
              </div>
            </div>

            {/* Room Upload Result */}
            {roomUploadResult && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Upload Result</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRoomUploadResult(null)}
                    className="size-6 p-0"
                  >
                    <X className="size-3" />
                  </Button>
                </div>

                {roomUploadResult.data.length > 0 &&
                  roomUploadResult.errors.length === 0 && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="size-4" />
                      <span className="text-sm">
                        Success: {roomUploadResult.data.length} rooms uploaded
                      </span>
                    </div>
                  )}

                {roomUploadResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="size-4" />
                      <span className="text-sm font-medium">Errors</span>
                    </div>
                    <div className="space-y-1 text-sm text-red-600">
                      {roomUploadResult.errors
                        .slice(0, 3)
                        .map((error, index) => (
                          <div key={index}>• {error}</div>
                        ))}
                      {roomUploadResult.errors.length > 3 && (
                        <div>
                          ...and {roomUploadResult.errors.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Current Rooms Display */}
            {rooms.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded border p-2">
                <div className="flex flex-wrap gap-1">
                  {rooms.map((room, index) => (
                    <span
                      key={index}
                      className="bg-muted rounded px-2 py-1 font-mono text-xs"
                    >
                      {room}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isFormValid}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
