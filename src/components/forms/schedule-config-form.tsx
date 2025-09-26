import { format } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useCallback, useMemo, useState } from 'react';

import type { DutySlot, ExamStructure, ExcelParseResult } from '@/types';

import { parseRoomsExcel } from '@/lib/excel';

import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ScheduleConfigFormProps {
  examStructure: ExamStructure;
  onExamStructureUpdated: (structure: ExamStructure) => void;
}

interface RoomUploadState {
  [key: string]: ExcelParseResult<string> | null;
}

interface DaySlots {
  day: number;
  date: Date;
  slots: DutySlot[];
}

export function ScheduleConfigForm({
  examStructure,
  onExamStructureUpdated,
}: ScheduleConfigFormProps) {
  const [days, setDays] = useState(examStructure.days || 3);
  const [roomUploadResults, setRoomUploadResults] = useState<RoomUploadState>(
    {}
  );

  // Time options for dropdowns
  const timeOptions = useMemo(
    () => [
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
    ],
    []
  );

  // Organize duty slots by day
  const daySlots = useMemo((): DaySlots[] => {
    const organized: DaySlots[] = [];

    for (let dayIndex = 0; dayIndex < days; dayIndex++) {
      const daySlots = examStructure.dutySlots
        .filter((slot) => slot.day === dayIndex)
        .sort((a, b) => a.slot - b.slot);

      organized.push({
        day: dayIndex,
        date: daySlots[0]?.date || new Date(),
        slots: daySlots,
      });
    }

    return organized;
  }, [days, examStructure.dutySlots]);

  // Initialize days when count changes
  const initializeDays = useCallback(() => {
    const existingSlots = examStructure.dutySlots.filter(
      (slot) => slot.day < days
    );

    const updatedStructure: ExamStructure = {
      ...examStructure,
      days,
      dutySlots: existingSlots,
    };

    onExamStructureUpdated(updatedStructure);
    toast.success(`Initialized ${days} days schedule.`);
  }, [days, examStructure, onExamStructureUpdated]);

  // Add a new slot to a specific day
  const addSlot = useCallback(
    (dayIndex: number) => {
      const daySlots = examStructure.dutySlots.filter(
        (slot) => slot.day === dayIndex
      );
      const nextSlotNumber = daySlots.length;
      const dayDate = daySlots[0]?.date || new Date();

      const newSlot: DutySlot = {
        day: dayIndex,
        slot: nextSlotNumber,
        date: dayDate,
        startTime: nextSlotNumber === 0 ? '9:00 AM' : '2:00 PM',
        endTime: nextSlotNumber === 0 ? '12:00 PM' : '5:00 PM',
        regularDuties: 10,
        bufferDuties: 2,
        rooms: [],
      };

      const updatedStructure: ExamStructure = {
        ...examStructure,
        dutySlots: [...examStructure.dutySlots, newSlot],
      };

      onExamStructureUpdated(updatedStructure);
      toast.success(`Added new slot to Day ${dayIndex + 1}.`);
    },
    [examStructure, onExamStructureUpdated]
  );

  // Remove a slot from a specific day
  const removeSlot = useCallback(
    (dayIndex: number, slotIndex: number) => {
      const updatedSlots = examStructure.dutySlots
        .filter((slot) => !(slot.day === dayIndex && slot.slot === slotIndex))
        .map((slot) => {
          // Reindex slots for the affected day
          if (slot.day === dayIndex && slot.slot > slotIndex) {
            return { ...slot, slot: slot.slot - 1 };
          }
          return slot;
        });

      const updatedStructure: ExamStructure = {
        ...examStructure,
        dutySlots: updatedSlots,
      };

      onExamStructureUpdated(updatedStructure);

      // Clear room upload results for removed slot
      const uploadKey = `${dayIndex}-${slotIndex}`;
      setRoomUploadResults((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [uploadKey]: removed, ...rest } = prev;
        return rest;
      });

      toast.success(`Removed slot from Day ${dayIndex + 1}.`);
    },
    [examStructure, onExamStructureUpdated]
  );

  // Update day date (affects all slots in that day)
  const updateDayDate = useCallback(
    (dayIndex: number, date: Date) => {
      const updatedSlots = examStructure.dutySlots.map((slot) =>
        slot.day === dayIndex ? { ...slot, date } : slot
      );

      const updatedStructure: ExamStructure = {
        ...examStructure,
        dutySlots: updatedSlots,
      };

      onExamStructureUpdated(updatedStructure);
    },
    [examStructure, onExamStructureUpdated]
  );

  // Update individual slot properties
  const updateSlot = useCallback(
    (dayIndex: number, slotIndex: number, updates: Partial<DutySlot>) => {
      const updatedSlots = examStructure.dutySlots.map((slot) =>
        slot.day === dayIndex && slot.slot === slotIndex
          ? { ...slot, ...updates }
          : slot
      );

      const updatedStructure: ExamStructure = {
        ...examStructure,
        dutySlots: updatedSlots,
      };

      onExamStructureUpdated(updatedStructure);
    },
    [examStructure, onExamStructureUpdated]
  );

  // Handle room upload
  const handleRoomUpload = useCallback(
    async (dayIndex: number, slotIndex: number, file: File) => {
      const key = `${dayIndex}-${slotIndex}`;

      setRoomUploadResults((prev) => ({
        ...prev,
        [key]: { data: [], errors: ['Uploading...'], warnings: [] },
      }));

      try {
        const result = await parseRoomsExcel(file);
        setRoomUploadResults((prev) => ({
          ...prev,
          [key]: result,
        }));

        if (result.data.length > 0) {
          updateSlot(dayIndex, slotIndex, { rooms: result.data });
          toast.success(
            `Uploaded ${result.data.length} rooms for Day ${dayIndex + 1} Slot ${slotIndex + 1}.`
          );
        }
      } catch (error) {
        setRoomUploadResults((prev) => ({
          ...prev,
          [key]: {
            data: [],
            errors: [
              `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ],
            warnings: [],
          },
        }));
      }
    },
    [updateSlot]
  );

  const clearRoomUploadResult = useCallback(
    (dayIndex: number, slotIndex: number) => {
      const key = `${dayIndex}-${slotIndex}`;
      setRoomUploadResults((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [key]: removed, ...rest } = prev;
        return rest;
      });
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* Days Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Exam Days</CardTitle>
          <CardDescription>
            Set the number of examination days, then configure slots for each
            day
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="max-w-xs flex-1">
              <label className="mb-2 block text-sm font-medium">
                Number of Days
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={days}
                onChange={(e) =>
                  setDays(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-full rounded-md border px-3 py-2"
              />
            </div>
            <Button onClick={initializeDays} variant="outline" className="mt-7">
              Initialize {days} Days
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Days and Slots */}
      {daySlots.length > 0 && (
        <div className="space-y-6">
          {daySlots.map((dayData) => (
            <Card key={dayData.day}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Day {dayData.day + 1}</CardTitle>
                    <CardDescription>
                      Configure slots and timing for this examination day
                    </CardDescription>
                  </div>

                  {/* Date Picker for this day */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="min-w-[160px]">
                        <Calendar className="mr-2 size-4" />
                        {format(dayData.date, 'MMM dd, yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={dayData.date}
                        onSelect={(date) =>
                          date && updateDayDate(dayData.day, date)
                        }
                        required
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Slots for this day */}
                {dayData.slots.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    <Clock className="mx-auto mb-3 size-12 opacity-50" />
                    <p>No slots configured for this day</p>
                    <p className="text-sm">
                      Click "Add Slot" to create the first slot
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dayData.slots.map((slot) => {
                      const uploadKey = `${dayData.day}-${slot.slot}`;
                      const uploadResult = roomUploadResults[uploadKey];

                      return (
                        <div
                          key={slot.slot}
                          className="space-y-4 rounded-lg border p-4"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">
                              Slot {slot.slot + 1}
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSlot(dayData.day, slot.slot)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {/* Start Time */}
                            <div>
                              <label className="mb-1 block text-sm font-medium">
                                Start Time
                              </label>
                              <select
                                value={slot.startTime}
                                onChange={(e) =>
                                  updateSlot(dayData.day, slot.slot, {
                                    startTime: e.target.value,
                                  })
                                }
                                className="w-full rounded-md border px-3 py-2 text-sm"
                              >
                                {timeOptions.map((time) => (
                                  <option key={time} value={time}>
                                    {time}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* End Time */}
                            <div>
                              <label className="mb-1 block text-sm font-medium">
                                End Time
                              </label>
                              <select
                                value={slot.endTime}
                                onChange={(e) =>
                                  updateSlot(dayData.day, slot.slot, {
                                    endTime: e.target.value,
                                  })
                                }
                                className="w-full rounded-md border px-3 py-2 text-sm"
                              >
                                {timeOptions.map((time) => (
                                  <option key={time} value={time}>
                                    {time}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Regular Duties */}
                            <div>
                              <label className="mb-1 block text-sm font-medium">
                                Regular Duties
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={slot.regularDuties}
                                onChange={(e) =>
                                  updateSlot(dayData.day, slot.slot, {
                                    regularDuties:
                                      parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-full rounded-md border px-3 py-2 text-sm"
                              />
                            </div>

                            {/* Buffer Duties */}
                            <div>
                              <label className="mb-1 block text-sm font-medium">
                                Buffer Duties
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={slot.regularDuties}
                                value={slot.bufferDuties}
                                onChange={(e) =>
                                  updateSlot(dayData.day, slot.slot, {
                                    bufferDuties: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-full rounded-md border px-3 py-2 text-sm"
                              />
                            </div>
                          </div>

                          {/* Room Upload */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-medium">
                                  Rooms ({slot.rooms.length})
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  Need {slot.regularDuties} rooms for regular
                                  duties
                                </div>
                              </div>

                              <div className="relative">
                                <input
                                  type="file"
                                  accept=".xlsx,.xls"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file)
                                      handleRoomUpload(
                                        dayData.day,
                                        slot.slot,
                                        file
                                      );
                                  }}
                                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                />
                                <Button variant="outline" size="sm">
                                  <Upload className="mr-2 size-3" />
                                  Upload Rooms
                                </Button>
                              </div>
                            </div>

                            {/* Room Upload Results */}
                            {uploadResult && (
                              <div className="bg-muted/30 space-y-2 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    Upload Result
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      clearRoomUploadResult(
                                        dayData.day,
                                        slot.slot
                                      )
                                    }
                                    className="size-6 p-0"
                                  >
                                    <X className="size-3" />
                                  </Button>
                                </div>

                                {uploadResult.data.length > 0 &&
                                  uploadResult.errors.length === 0 && (
                                    <div className="flex items-center gap-2 text-green-600">
                                      <CheckCircle className="size-4" />
                                      <span className="text-sm">
                                        Success: {uploadResult.data.length}{' '}
                                        rooms uploaded
                                      </span>
                                    </div>
                                  )}

                                {uploadResult.errors.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-red-600">
                                      <AlertCircle className="size-4" />
                                      <span className="text-sm font-medium">
                                        Errors
                                      </span>
                                    </div>
                                    <div className="space-y-1 text-sm text-red-600">
                                      {uploadResult.errors
                                        .slice(0, 3)
                                        .map((error, index) => (
                                          <div key={index}>• {error}</div>
                                        ))}
                                      {uploadResult.errors.length > 3 && (
                                        <div>
                                          ...and{' '}
                                          {uploadResult.errors.length - 3} more
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Slot Button */}
                <Button
                  variant="outline"
                  onClick={() => addSlot(dayData.day)}
                  className="w-full border-dashed"
                >
                  <Plus className="mr-2 size-4" />
                  Add Slot
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Overall Structure Grid */}
      {daySlots.length > 0 && daySlots.some((day) => day.slots.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule Overview</CardTitle>
            <CardDescription>
              Complete examination schedule structure across all days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              // Create a unified grid view
              const maxSlots = Math.max(
                ...daySlots.map((day) => day.slots.length)
              );

              if (maxSlots === 0) {
                return (
                  <div className="text-muted-foreground py-8 text-center">
                    No slots configured yet
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    {/* Header Row */}
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="min-w-[120px] border border-gray-300 p-3 text-left font-medium">
                          Time Slot
                        </th>
                        {daySlots.map((day) => (
                          <th
                            key={day.day}
                            className="min-w-[180px] border border-gray-300 p-3 text-center font-medium"
                          >
                            <div className="space-y-1">
                              <div className="font-semibold">
                                Day {day.day + 1}
                              </div>
                              <div className="text-muted-foreground text-sm font-normal">
                                {format(day.date, 'MMM dd, yyyy')}
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    {/* Body Rows */}
                    <tbody>
                      {Array.from({ length: maxSlots }, (_, slotIndex) => (
                        <tr key={slotIndex} className="hover:bg-muted/20">
                          <td className="bg-muted/30 border border-gray-300 p-3 font-medium">
                            Slot {slotIndex + 1}
                          </td>
                          {daySlots.map((day) => {
                            const slot = day.slots.find(
                              (s) => s.slot === slotIndex
                            );

                            return (
                              <td
                                key={`${day.day}-${slotIndex}`}
                                className="border border-gray-300 p-3"
                              >
                                {slot ? (
                                  <div className="space-y-2">
                                    {/* Time Range */}
                                    <div className="text-sm font-medium">
                                      {slot.startTime} - {slot.endTime}
                                    </div>

                                    {/* Duties Info */}
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                      <div className="rounded bg-blue-50 p-2 text-center">
                                        <div className="font-medium text-blue-700">
                                          {slot.regularDuties}
                                        </div>
                                        <div className="text-blue-600">
                                          Regular
                                        </div>
                                      </div>
                                      <div className="rounded bg-orange-50 p-2 text-center">
                                        <div className="font-medium text-orange-700">
                                          {slot.bufferDuties}
                                        </div>
                                        <div className="text-orange-600">
                                          Buffer
                                        </div>
                                      </div>
                                      <div className="rounded bg-green-50 p-2 text-center">
                                        <div className="font-medium text-green-700">
                                          {slot.rooms.length}
                                        </div>
                                        <div className="text-green-600">
                                          Rooms
                                        </div>
                                      </div>
                                    </div>

                                    {/* Total Duties */}
                                    <div className="rounded bg-gray-100 px-2 py-1 text-center text-xs font-medium text-gray-700">
                                      Total:{' '}
                                      {slot.regularDuties + slot.bufferDuties}
                                    </div>

                                    {/* Room Validation */}
                                    {slot.rooms.length !==
                                      slot.regularDuties && (
                                      <div className="rounded bg-red-50 px-2 py-1 text-center text-xs text-red-600">
                                        ⚠️ Room mismatch
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground py-4 text-center text-sm italic">
                                    No slot
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Summary Row */}
                      <tr className="bg-muted/30 border-t-2 border-gray-400">
                        <td className="border border-gray-300 p-3 font-semibold">
                          Day Totals
                        </td>
                        {daySlots.map((day) => {
                          const totalRegular = day.slots.reduce(
                            (sum, slot) => sum + slot.regularDuties,
                            0
                          );
                          const totalBuffer = day.slots.reduce(
                            (sum, slot) => sum + slot.bufferDuties,
                            0
                          );
                          const totalRooms = day.slots.reduce(
                            (sum, slot) => sum + slot.rooms.length,
                            0
                          );

                          return (
                            <td
                              key={`total-${day.day}`}
                              className="border border-gray-300 p-3"
                            >
                              <div className="space-y-2">
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div className="rounded bg-blue-100 p-2 text-center font-medium">
                                    <div className="text-blue-800">
                                      {totalRegular}
                                    </div>
                                    <div className="text-blue-600">Regular</div>
                                  </div>
                                  <div className="rounded bg-orange-100 p-2 text-center font-medium">
                                    <div className="text-orange-800">
                                      {totalBuffer}
                                    </div>
                                    <div className="text-orange-600">
                                      Buffer
                                    </div>
                                  </div>
                                  <div className="rounded bg-green-100 p-2 text-center font-medium">
                                    <div className="text-green-800">
                                      {totalRooms}
                                    </div>
                                    <div className="text-green-600">Rooms</div>
                                  </div>
                                </div>
                                <div className="rounded bg-gray-200 px-2 py-1 text-center text-sm font-bold text-gray-800">
                                  Total: {totalRegular + totalBuffer}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Overall Summary Stats */}
            <div className="bg-muted/30 mt-6 rounded-lg p-4">
              <h4 className="mb-3 font-semibold">Examination Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
                {(() => {
                  const allSlots = daySlots.flatMap((day) => day.slots);
                  const totalRegular = allSlots.reduce(
                    (sum, slot) => sum + slot.regularDuties,
                    0
                  );
                  const totalBuffer = allSlots.reduce(
                    (sum, slot) => sum + slot.bufferDuties,
                    0
                  );
                  const totalRooms = allSlots.reduce(
                    (sum, slot) => sum + slot.rooms.length,
                    0
                  );
                  const totalSlots = allSlots.length;

                  return (
                    <>
                      <div className="rounded-lg bg-blue-50 p-3">
                        <div className="text-2xl font-bold text-blue-700">
                          {totalRegular}
                        </div>
                        <div className="text-sm text-blue-600">
                          Regular Duties
                        </div>
                      </div>
                      <div className="rounded-lg bg-orange-50 p-3">
                        <div className="text-2xl font-bold text-orange-700">
                          {totalBuffer}
                        </div>
                        <div className="text-sm text-orange-600">
                          Buffer Duties
                        </div>
                      </div>
                      <div className="rounded-lg bg-green-50 p-3">
                        <div className="text-2xl font-bold text-green-700">
                          {totalRooms}
                        </div>
                        <div className="text-sm text-green-600">
                          Total Rooms
                        </div>
                      </div>
                      <div className="rounded-lg bg-purple-50 p-3">
                        <div className="text-2xl font-bold text-purple-700">
                          {totalSlots}
                        </div>
                        <div className="text-sm text-purple-600">
                          Total Slots
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Grand Total */}
              <div className="mt-4 rounded-lg border-2 border-gray-300 bg-gray-100 p-3 text-center">
                <div className="text-3xl font-bold text-gray-800">
                  {daySlots
                    .flatMap((day) => day.slots)
                    .reduce(
                      (sum, slot) =>
                        sum + slot.regularDuties + slot.bufferDuties,
                      0
                    )}
                </div>
                <div className="text-sm font-medium text-gray-600">
                  Total Duties Needed
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      {daySlots.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              toast.success('Schedule configuration saved successfully.');
            }}
            size="lg"
          >
            Save Configuration
          </Button>
        </div>
      )}
    </div>
  );
}
