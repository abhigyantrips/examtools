import { format } from 'date-fns';
import { Calendar, Clock, Edit2, MapPin, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useMemo, useState } from 'react';

import type { DutySlot, ExamStructure } from '@/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { SlotEditDialog } from '@/pages/assignment/forms/slot-edit-dialog';

interface ConfigurationPhaseProps {
  examStructure: ExamStructure;
  onExamStructureUpdated: (structure: ExamStructure) => void;
}

interface DayColumn {
  dayIndex: number;
  date: Date;
  slots: DutySlot[];
}

export function ConfigurationPhase({
  examStructure,
  onExamStructureUpdated,
}: ConfigurationPhaseProps) {
  const [days, setDays] = useState(examStructure.days || 3);
  const [editingSlot, setEditingSlot] = useState<{
    day: number;
    slot: number;
    data: DutySlot;
  } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Organize slots by day
  const dayColumns = useMemo((): DayColumn[] => {
    const columns: DayColumn[] = [];

    for (let dayIndex = 0; dayIndex < days; dayIndex++) {
      const daySlots = examStructure.dutySlots
        .filter((slot) => slot.day === dayIndex)
        .sort((a, b) => a.slot - b.slot);

      const date =
        daySlots[0]?.date ||
        new Date(Date.now() + dayIndex * 24 * 60 * 60 * 1000);

      columns.push({
        dayIndex,
        date,
        slots: daySlots,
      });
    }

    return columns;
  }, [days, examStructure.dutySlots]);

  // Calculate max slots across all days for table rows
  const maxSlotsPerDay = Math.max(
    ...dayColumns.map((day) => day.slots.length),
    1
  );

  // Initialize days structure
  const initializeDays = () => {
    const existingSlots = examStructure.dutySlots.filter(
      (slot) => slot.day < days
    );

    onExamStructureUpdated({
      ...examStructure,
      days,
      dutySlots: existingSlots,
    });

    toast.success(`Initialized ${days} examination days.`);
  };

  // Update day date
  const updateDayDate = (dayIndex: number, date: Date) => {
    const updatedSlots = examStructure.dutySlots.map((slot) =>
      slot.day === dayIndex ? { ...slot, date } : slot
    );

    onExamStructureUpdated({
      ...examStructure,
      dutySlots: updatedSlots,
    });
  };

  // Add new slot to a day
  const addSlot = (dayIndex: number) => {
    const existingSlotsForDay = examStructure.dutySlots.filter(
      (slot) => slot.day === dayIndex
    );
    const newSlotIndex = existingSlotsForDay.length;
    const dayDate =
      dayColumns.find((d) => d.dayIndex === dayIndex)?.date || new Date();

    const newSlot: DutySlot = {
      day: dayIndex,
      slot: newSlotIndex,
      date: dayDate,
      startTime: newSlotIndex === 0 ? '9:00 AM' : '2:00 PM',
      endTime: newSlotIndex === 0 ? '12:00 PM' : '5:00 PM',
      regularDuties: 10,
      relieverDuties: 2,
      squadDuties: 2,
      bufferDuties: 2,
      rooms: [],
    };

    onExamStructureUpdated({
      ...examStructure,
      dutySlots: [...examStructure.dutySlots, newSlot],
    });

    toast.success(`Added new slot to Day ${dayIndex + 1}.`);
  };

  // Delete slot
  const deleteSlot = (dayIndex: number, slotIndex: number) => {
    const updatedSlots = examStructure.dutySlots
      .filter((slot) => !(slot.day === dayIndex && slot.slot === slotIndex))
      .map((slot) => {
        // Reindex slots for the affected day
        if (slot.day === dayIndex && slot.slot > slotIndex) {
          return { ...slot, slot: slot.slot - 1 };
        }
        return slot;
      });

    onExamStructureUpdated({
      ...examStructure,
      dutySlots: updatedSlots,
    });

    toast.success(`Removed slot from Day ${dayIndex + 1}.`);
  };

  // Open edit dialog
  const openEditDialog = (dayIndex: number, slotIndex: number) => {
    const slot = examStructure.dutySlots.find(
      (s) => s.day === dayIndex && s.slot === slotIndex
    );

    if (slot) {
      setEditingSlot({
        day: dayIndex,
        slot: slotIndex,
        data: slot,
      });
      setIsDialogOpen(true);
    }
  };

  // Save slot from dialog
  const saveSlot = (updatedSlot: DutySlot) => {
    if (!editingSlot) return;

    const updatedSlots = examStructure.dutySlots.map((slot) =>
      slot.day === editingSlot.day && slot.slot === editingSlot.slot
        ? updatedSlot
        : slot
    );

    onExamStructureUpdated({
      ...examStructure,
      dutySlots: updatedSlots,
    });

    setIsDialogOpen(false);
    setEditingSlot(null);
    toast.success('Slot updated successfully.');
  };

  // Calculate totals
  const totals = useMemo(() => {
    return examStructure.dutySlots.reduce(
      (acc, slot) => ({
        regular: acc.regular + slot.regularDuties,
        reliever: acc.reliever + (slot.relieverDuties || 0),
        squad: acc.squad + (slot.squadDuties || 0),
        buffer: acc.buffer + slot.bufferDuties,
        total:
          acc.total +
          slot.regularDuties +
          (slot.relieverDuties || 0) +
          (slot.squadDuties || 0) +
          slot.bufferDuties,
        rooms: acc.rooms + slot.rooms.length,
      }),
      { regular: 0, reliever: 0, squad: 0, buffer: 0, total: 0, rooms: 0 }
    );
  }, [examStructure.dutySlots]);

  return (
    <div className="space-y-6">
      {/* Days Setup */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5" />
                Examination Schedule Configuration
              </CardTitle>
              <CardDescription>
                Configure examination days and time slots. Each slot can have
                different duty requirements.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Days:</label>
                <Input
                  type="number"
                  min="1"
                  max="15"
                  value={days}
                  onChange={(e) =>
                    setDays(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-20"
                />
              </div>
              <Button onClick={initializeDays}>Initialize {days} Days</Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Schedule Table */}
      {dayColumns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule Overview</CardTitle>
            <CardDescription>
              Click "Edit" to configure slot details, times, and room
              assignments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-24">Slot</TableHead>
                    {dayColumns.map((dayColumn) => (
                      <TableHead
                        key={dayColumn.dayIndex}
                        className="min-w-[280px] text-center"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-semibold">
                              Day {dayColumn.dayIndex + 1}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addSlot(dayColumn.dayIndex)}
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>

                          {/* Date Picker */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                              >
                                {format(dayColumn.date, 'MMM dd, yyyy')}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent
                                mode="single"
                                selected={dayColumn.date}
                                onSelect={(date) =>
                                  date &&
                                  updateDayDate(dayColumn.dayIndex, date)
                                }
                                required
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {Array.from({ length: maxSlotsPerDay }, (_, slotIndex) => (
                    <TableRow key={slotIndex}>
                      <TableCell className="bg-muted/30 text-center font-medium">
                        Slot {slotIndex + 1}
                      </TableCell>

                      {dayColumns.map((dayColumn) => {
                        const slot = dayColumn.slots.find(
                          (s) => s.slot === slotIndex
                        );

                        return (
                          <TableCell
                            key={`${dayColumn.dayIndex}-${slotIndex}`}
                            className="p-2"
                          >
                            {slot ? (
                              <div className="space-y-3">
                                {/* Time Display */}
                                <div className="flex items-center justify-center gap-1 text-sm font-medium">
                                  <Clock className="size-3" />
                                  {slot.startTime} - {slot.endTime}
                                </div>

                                {/* Duties Grid */}
                                <div className="grid grid-cols-2 gap-1 text-xs">
                                  <div className="rounded bg-blue-50 p-1 text-center dark:bg-blue-900/30">
                                    <div className="font-medium text-blue-700 dark:text-blue-300">
                                      {slot.regularDuties}
                                    </div>
                                    <div className="text-blue-600 dark:text-blue-400">
                                      Regular
                                    </div>
                                  </div>
                                  <div className="rounded bg-green-50 p-1 text-center dark:bg-green-900/30">
                                    <div className="font-medium text-green-700 dark:text-green-300">
                                      {slot.relieverDuties || 0}
                                    </div>
                                    <div className="text-green-600 dark:text-green-400">
                                      Reliever
                                    </div>
                                  </div>
                                  <div className="rounded bg-purple-50 p-1 text-center dark:bg-purple-900/30">
                                    <div className="font-medium text-purple-700 dark:text-purple-300">
                                      {slot.squadDuties || 0}
                                    </div>
                                    <div className="text-purple-600 dark:text-purple-400">
                                      Squad
                                    </div>
                                  </div>
                                  <div className="rounded bg-orange-50 p-1 text-center dark:bg-orange-900/30">
                                    <div className="font-medium text-orange-700 dark:text-orange-300">
                                      {slot.bufferDuties}
                                    </div>
                                    <div className="text-orange-600 dark:text-orange-400">
                                      Buffer
                                    </div>
                                  </div>
                                </div>

                                {/* Total & Rooms */}
                                <div className="space-y-1 text-center">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {slot.regularDuties +
                                      (slot.relieverDuties || 0) +
                                      (slot.squadDuties || 0) +
                                      slot.bufferDuties}{' '}
                                    Total Duties
                                  </Badge>
                                  <div className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
                                    <MapPin className="size-3" />
                                    {slot.rooms.length} rooms
                                  </div>
                                </div>

                                {/* Room validation warning */}
                                {slot.rooms.length !== slot.regularDuties && (
                                  <Badge
                                    variant="destructive"
                                    className="text-xs"
                                  >
                                    ⚠️ Room mismatch
                                  </Badge>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 flex-1 text-xs"
                                    onClick={() =>
                                      openEditDialog(
                                        dayColumn.dayIndex,
                                        slotIndex
                                      )
                                    }
                                  >
                                    <Edit2 className="mr-1 size-3" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() =>
                                      deleteSlot(dayColumn.dayIndex, slotIndex)
                                    }
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-muted-foreground flex h-32 items-center justify-center">
                                <div className="text-center text-xs">
                                  <div className="mb-2 opacity-50">No slot</div>
                                </div>
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Summary */}
      {examStructure.dutySlots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration Summary</CardTitle>
            <CardDescription>
              Total duties and resources required across all examination slots
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
              <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-900/30">
                <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {totals.regular}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  Regular
                </div>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-900/30">
                <div className="text-xl font-bold text-green-700 dark:text-green-300">
                  {totals.reliever}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Reliever
                </div>
              </div>
              <div className="rounded-lg bg-purple-50 p-3 text-center dark:bg-purple-900/30">
                <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
                  {totals.squad}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">
                  Squad
                </div>
              </div>
              <div className="rounded-lg bg-orange-50 p-3 text-center dark:bg-orange-900/30">
                <div className="text-xl font-bold text-orange-700 dark:text-orange-300">
                  {totals.buffer}
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400">
                  Buffer
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800">
                <div className="text-xl font-bold text-gray-700 dark:text-gray-300">
                  {totals.rooms}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Rooms
                </div>
              </div>
              <div className="rounded-lg bg-gray-100 p-3 text-center dark:bg-gray-900">
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  {totals.total}
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Duties
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Slot Edit Dialog */}
      {editingSlot && (
        <SlotEditDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setEditingSlot(null);
          }}
          slot={editingSlot.data}
          dayNumber={editingSlot.day + 1}
          slotNumber={editingSlot.slot + 1}
          onSave={saveSlot}
        />
      )}
    </div>
  );
}
