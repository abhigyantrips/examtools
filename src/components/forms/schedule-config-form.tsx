import { format } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  FlaskConical,
  Plus,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { useCallback, useMemo, useState } from 'react';

import type {
  DutySlot,
  ExamStructure,
  ExcelParseResult,
  Faculty,
} from '@/types';

import { parseRoomsExcel } from '@/lib/excel';
import {
  calculateTotalDuties,
  generateRandomTestConfiguration,
  validateTestConfiguration,
} from '@/lib/test-data';

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
  faculty: Faculty[];
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
  faculty,
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

  // Generate test data for the given faculty distribution
  const generateTestData = useCallback(
    async (totalDuties: number) => {
      try {
        toast.loading('Generating random test configuration...', {
          id: 'test-data',
        });

        // Generate random configuration
        const randomStructure = generateRandomTestConfiguration(totalDuties);

        // Preserve existing designation counts
        const updatedStructure: ExamStructure = {
          ...randomStructure,
          designationDutyCounts: examStructure.designationDutyCounts,
        };

        // Validate the generated data
        const validation = validateTestConfiguration(
          updatedStructure,
          totalDuties
        );

        if (!validation.isValid) {
          toast.error(`Test data generation failed: ${validation.errors[0]}`, {
            id: 'test-data',
          });
          return;
        }

        // Update the exam structure
        onExamStructureUpdated(updatedStructure);

        // Show success message with summary
        const { summary } = validation;
        toast.success(
          `Test configuration generated! ${summary.regularDuties}R + ${summary.relieverDuties}V + ${summary.squadDuties}S + ${summary.bufferDuties}B = ${summary.actualTotal} total duties across ${updatedStructure.days} days.`,
          {
            id: 'test-data',
            duration: 6000, // Longer duration for more details
          }
        );

        console.log('🧪 Generated test configuration:', {
          days: updatedStructure.days,
          totalSlots: updatedStructure.dutySlots.length,
          summary,
          structure: updatedStructure.dutySlots.map((slot) => ({
            day: slot.day + 1,
            slot: slot.slot + 1,
            regular: slot.regularDuties,
            reliever: slot.relieverDuties,
            squad: slot.squadDuties,
            buffer: slot.bufferDuties,
            rooms: slot.rooms.length,
          })),
        });
      } catch (error) {
        toast.error(
          `Test data generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { id: 'test-data' }
        );
        console.error('Test data generation error:', error);
      }
    },
    [examStructure, onExamStructureUpdated]
  );

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
        relieverDuties: 0,
        squadDuties: 0,
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

      {/* Test Data Generation */}
      {faculty.length > 0 &&
        Object.keys(examStructure.designationDutyCounts).length > 0 && (
          <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="size-5 text-purple-600 dark:text-purple-500" />
                Testing Data Framework
              </CardTitle>
              <CardDescription>
                Generate random schedule configurations for testing the
                assignment system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const totalDuties = calculateTotalDuties(
                  // You'll need to pass faculty data to this component
                  faculty, // Add faculty as prop
                  examStructure.designationDutyCounts
                );

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-lg border bg-white p-3 text-center dark:bg-purple-900/50">
                        <div className="text-2xl font-bold text-purple-700 dark:text-white">
                          {faculty.length}
                        </div>
                        <div className="text-sm text-purple-600 dark:text-white">
                          Faculty Members
                        </div>
                      </div>
                      <div className="rounded-lg border bg-white p-3 text-center dark:bg-purple-900/50">
                        <div className="text-2xl font-bold text-purple-700 dark:text-white">
                          {totalDuties}
                        </div>
                        <div className="text-sm text-purple-600 dark:text-white">
                          Total Duties Needed
                        </div>
                      </div>
                      <div className="rounded-lg border bg-white p-3 text-center dark:bg-purple-900/50">
                        <div className="text-2xl font-bold text-purple-700 dark:text-white">
                          {examStructure.dutySlots.length}
                        </div>
                        <div className="text-sm text-purple-600 dark:text-white">
                          Current Slots
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => generateTestData(totalDuties)}
                      className="w-full"
                      variant="outline"
                      size="lg"
                    >
                      <Zap className="mr-2 size-4" />
                      Generate Random Test Configuration
                    </Button>

                    <div className="text-xs text-purple-600">
                      This will create a random schedule with {totalDuties}{' '}
                      duties spread across 2-6 days with 1-4 slots per day. The
                      configuration will replace your current schedule.
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

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
                          className="border-border bg-card dark:border-border dark:bg-card space-y-4 rounded-lg border p-4"
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

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
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

                            {/* Reliever Duties */}
                            <div>
                              <label className="mb-1 block text-sm font-medium">
                                Reliever Duties
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={slot.relieverDuties || 0}
                                onChange={(e) =>
                                  updateSlot(dayData.day, slot.slot, {
                                    relieverDuties:
                                      parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-full rounded-md border px-3 py-2 text-sm"
                              />
                            </div>

                            {/* Squad Duties */}
                            <div>
                              <label className="mb-1 block text-sm font-medium">
                                Squad Duties
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={slot.squadDuties || 0}
                                onChange={(e) =>
                                  updateSlot(dayData.day, slot.slot, {
                                    squadDuties: parseInt(e.target.value) || 0,
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
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="rounded bg-blue-50 p-2 text-center dark:bg-blue-900/30">
                                        <div className="font-medium text-blue-700 dark:text-blue-300">
                                          {slot.regularDuties}
                                        </div>
                                        <div className="text-blue-600 dark:text-blue-400">
                                          Regular
                                        </div>
                                      </div>
                                      <div className="rounded bg-green-50 p-2 text-center dark:bg-green-900/30">
                                        <div className="font-medium text-green-700 dark:text-green-300">
                                          {slot.relieverDuties || 0}
                                        </div>
                                        <div className="text-green-600 dark:text-green-400">
                                          Reliever
                                        </div>
                                      </div>
                                      <div className="rounded bg-purple-50 p-2 text-center dark:bg-purple-900/30">
                                        <div className="font-medium text-purple-700 dark:text-purple-300">
                                          {slot.squadDuties || 0}
                                        </div>
                                        <div className="text-purple-600 dark:text-purple-400">
                                          Squad
                                        </div>
                                      </div>
                                      <div className="rounded bg-orange-50 p-2 text-center dark:bg-orange-900/30">
                                        <div className="font-medium text-orange-700 dark:text-orange-300">
                                          {slot.bufferDuties}
                                        </div>
                                        <div className="text-orange-600 dark:text-orange-400">
                                          Buffer
                                        </div>
                                      </div>
                                      <div className="rounded bg-gray-100 p-2 text-center dark:bg-gray-800">
                                        <div className="font-medium text-gray-700 dark:text-gray-300">
                                          {slot.rooms.length}
                                        </div>
                                        <div className="text-gray-600 dark:text-gray-400">
                                          Rooms
                                        </div>
                                      </div>
                                      <div className="rounded bg-gray-100 p-2 text-center dark:bg-gray-800">
                                        <div className="font-medium text-gray-700 dark:text-gray-300">
                                          {slot.regularDuties +
                                            (slot.relieverDuties || 0) +
                                            (slot.squadDuties || 0) +
                                            (slot.bufferDuties || 0)}
                                        </div>
                                        <div className="text-gray-600 dark:text-gray-400">
                                          Duties
                                        </div>
                                      </div>
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
                          const totalReliever = day.slots.reduce(
                            (sum, slot) => sum + (slot.relieverDuties || 0),
                            0
                          );
                          const totalSquad = day.slots.reduce(
                            (sum, slot) => sum + (slot.squadDuties || 0),
                            0
                          );
                          const totalBuffer = day.slots.reduce(
                            (sum, slot) => sum + (slot.bufferDuties || 0),
                            0
                          );

                          return (
                            <td
                              key={`total-${day.day}`}
                              className="border border-gray-300 p-3"
                            >
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="rounded bg-blue-100 p-2 text-center font-medium dark:bg-blue-900/40">
                                    <div className="text-blue-800 dark:text-blue-200">
                                      {totalRegular}
                                    </div>
                                    <div className="text-blue-600 dark:text-blue-300">
                                      Regular
                                    </div>
                                  </div>
                                  <div className="rounded bg-green-100 p-2 text-center font-medium dark:bg-green-900/40">
                                    <div className="text-green-800 dark:text-green-200">
                                      {totalReliever}
                                    </div>
                                    <div className="text-green-600 dark:text-green-300">
                                      Reliever
                                    </div>
                                  </div>
                                  <div className="rounded bg-purple-100 p-2 text-center font-medium dark:bg-purple-900/40">
                                    <div className="text-purple-800 dark:text-purple-200">
                                      {totalSquad}
                                    </div>
                                    <div className="text-purple-600 dark:text-purple-300">
                                      Squad
                                    </div>
                                  </div>
                                  <div className="rounded bg-orange-100 p-2 text-center font-medium dark:bg-orange-900/40">
                                    <div className="text-orange-800 dark:text-orange-200">
                                      {totalBuffer}
                                    </div>
                                    <div className="text-orange-600 dark:text-orange-300">
                                      Buffer
                                    </div>
                                  </div>

                                  <div className="col-span-2 rounded bg-gray-100 p-2 text-center dark:bg-gray-800">
                                    <div className="font-semibold text-gray-700 dark:text-gray-300">
                                      {totalRegular +
                                        totalReliever +
                                        totalSquad +
                                        totalBuffer}{' '}
                                      Total Duties
                                    </div>
                                  </div>
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
                      <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/30">
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                          {totalRegular}
                        </div>
                        <div className="text-sm text-blue-600 dark:text-blue-400">
                          Regular Duties
                        </div>
                      </div>
                      <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-900/30">
                        <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                          {totalBuffer}
                        </div>
                        <div className="text-sm text-orange-600 dark:text-orange-400">
                          Buffer Duties
                        </div>
                      </div>
                      <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/30">
                        <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                          {totalRooms}
                        </div>
                        <div className="text-sm text-green-600 dark:text-green-400">
                          Total Rooms
                        </div>
                      </div>
                      <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-900/30">
                        <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                          {totalSlots}
                        </div>
                        <div className="text-sm text-purple-600 dark:text-purple-400">
                          Total Slots
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Grand Total */}
              <div className="mt-4 rounded-lg border-2 border-gray-300 bg-gray-100 p-3 text-center dark:border-gray-600 dark:bg-gray-800">
                <div className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                  {daySlots
                    .flatMap((day) => day.slots)
                    .reduce(
                      (sum, slot) =>
                        sum +
                        slot.regularDuties +
                        slot.relieverDuties +
                        slot.squadDuties +
                        slot.bufferDuties,
                      0
                    )}
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
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
