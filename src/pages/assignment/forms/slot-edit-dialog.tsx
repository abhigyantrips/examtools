import {
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

export function SlotEditDialog({
  isOpen,
  onClose,
  slot,
  dayNumber,
  slotNumber,
  onSave,
}: SlotEditDialogProps) {
  const [formData, setFormData] = useState<DutySlot>(slot);
  const [roomUploadResult, setRoomUploadResult] =
    useState<ExcelParseResult<string> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Reset form when slot changes
  useEffect(() => {
    setFormData(slot);
    setRoomUploadResult(null);
    setErrors([]);
  }, [slot]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (formData.regularDuties <= 0) {
      newErrors.push('Regular duties must be greater than 0');
    }

    if (formData.regularDuties !== formData.rooms.length) {
      newErrors.push(
        `Regular duties (${formData.regularDuties}) must match number of rooms (${formData.rooms.length})`
      );
    }

    if (formData.startTime === formData.endTime) {
      newErrors.push('Start time and end time cannot be the same');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Handle room upload
  const handleRoomUpload = async (file: File) => {
    setUploading(true);
    setRoomUploadResult({ data: [], errors: ['Uploading...'], warnings: [] });

    try {
      const result = await parseRoomsExcel(file);
      setRoomUploadResult(result);

      if (result.data.length > 0 && result.errors.length === 0) {
        setFormData((prev) => ({ ...prev, rooms: result.data }));
        toast.success(`Uploaded ${result.data.length} rooms.`);
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

  // Handle save
  const handleSave = () => {
    if (!validateForm()) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }

    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-5" />
            Edit Day {dayNumber} - Slot {slotNumber}
          </DialogTitle>
          <DialogDescription>
            Configure timing, duty requirements, and room assignments for this
            examination slot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Timing Configuration */}
          <div className="space-y-4">
            <h4 className="font-medium">Slot Timing</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <select
                  id="startTime"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      startTime: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="endTime">End Time</Label>
                <select
                  id="endTime"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      endTime: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border px-3 py-2"
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Duty Requirements */}
          <div className="space-y-4">
            <h4 className="font-medium">Duty Requirements</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="regularDuties">Regular Duties</Label>
                <Input
                  id="regularDuties"
                  type="number"
                  min="1"
                  value={formData.regularDuties}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      regularDuties: parseInt(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="relieverDuties">Reliever Duties</Label>
                <Input
                  id="relieverDuties"
                  type="number"
                  min="0"
                  value={formData.relieverDuties || 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      relieverDuties: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="squadDuties">Squad Duties</Label>
                <Input
                  id="squadDuties"
                  type="number"
                  min="0"
                  value={formData.squadDuties || 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      squadDuties: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="bufferDuties">Buffer Duties</Label>
                <Input
                  id="bufferDuties"
                  type="number"
                  min="0"
                  value={formData.bufferDuties}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      bufferDuties: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            {/* Total Duties Display */}
            <div className="bg-muted rounded-lg p-3">
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {formData.regularDuties +
                    (formData.relieverDuties || 0) +
                    (formData.squadDuties || 0) +
                    formData.bufferDuties}
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
                Room Assignments ({formData.rooms.length})
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
            {formData.rooms.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded border p-2">
                <div className="flex flex-wrap gap-1">
                  {formData.rooms.map((room, index) => (
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

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/30">
              <div className="mb-2 flex items-center gap-2 text-red-600">
                <AlertCircle className="size-4" />
                <span className="text-sm font-medium">Validation Errors</span>
              </div>
              <ul className="space-y-1 text-sm text-red-600">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={errors.length > 0}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
