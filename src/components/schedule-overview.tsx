import { useMemo } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { DutySlot, ExamStructure } from '../types';
import { format } from 'date-fns';

interface ScheduleOverviewProps {
  examStructure: ExamStructure;
}

interface DaySlots {
  day: number;
  date: Date;
  slots: DutySlot[];
}

export function ScheduleOverview({ examStructure }: ScheduleOverviewProps) {
  const daySlots = useMemo((): DaySlots[] => {
    const organized: DaySlots[] = [];

    for (let dayIndex = 0; dayIndex < examStructure.days; dayIndex++) {
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
  }, [examStructure.dutySlots]);

  if (!daySlots.length || !daySlots.some((day) => day.slots.length > 0)) {
    return null;
  }

  return (
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
          const maxSlots = Math.max(...daySlots.map((day) => day.slots.length));

          if (maxSlots === 0) {
            return (
              <div className="text-muted-foreground py-8 text-center">
                No slots configured yet
              </div>
            );
          }

          return (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[120px] px-4 py-3 text-left font-medium">
                      Time Slot
                    </TableHead>
                    {daySlots.map((day) => (
                      <TableHead
                        key={day.day}
                        className="min-w-[180px] px-4 py-3 text-center font-medium"
                      >
                        <div className="space-y-1">
                          <div className="font-semibold">Day {day.day + 1}</div>
                          <div className="text-muted-foreground text-sm font-normal">
                            {format(day.date, 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {Array.from({ length: maxSlots }, (_, slotIndex) => (
                    <TableRow key={slotIndex}>
                      <TableCell className="bg-muted/30 px-4 py-3 font-medium">
                        Slot {slotIndex + 1}
                      </TableCell>
                      {daySlots.map((day) => {
                        const slot = day.slots.find(
                          (s) => s.slot === slotIndex
                        );

                        return (
                          <TableCell key={`${day.day}-${slotIndex}`}>
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
                                {slot.rooms.length !== slot.regularDuties && (
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
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}

                  {/* Summary Row */}
                  <TableRow className="bg-muted/30 border-t-2">
                    <TableCell className="px-4 py-3 font-semibold">
                      Day Totals
                    </TableCell>
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
                        <TableCell key={`total-${day.day}`}>
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
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
