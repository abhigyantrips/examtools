import type { DutySlot } from '@/types';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SlotSelectionProps {
  slots: DutySlot[];
  selected: { day: number; slot: number } | null;
  onSelect: (day: number, slot: number) => void;
  // map key is `${day}-${slot}` -> true when attendance exists in zip
  markedMap?: Record<string, boolean>;
}

interface DayColumn {
  dayIndex: number;
  date: Date;
  slots: DutySlot[];
}

export function SlotSelectionPhase({
  slots,
  selected,
  onSelect,
  markedMap,
}: SlotSelectionProps) {
  // Group slots by day
  const days = slots.reduce((acc: Map<number, any[]>, s) => {
    const day = Number(s.day || 0);
    if (!acc.has(day)) acc.set(day, []);
    acc.get(day)!.push(s);
    return acc;
  }, new Map<number, any[]>());

  // Convert to sorted array of day groups
  const dayGroups = Array.from(days.entries())
    .map(([day, sl]) => ({
      day,
      slots: sl.sort((a, b) => (a.slot || 0) - (b.slot || 0)),
    }))
    .sort((a, b) => a.day - b.day);

  // Build dayColumns for the calendar-style table
  const dayColumns: DayColumn[] = dayGroups.map((dg) => ({
    dayIndex: dg.day,
    date: dg.slots[0] ? new Date(dg.slots[0].date) : new Date(),
    slots: dg.slots,
  }));

  // determine maximum number of slots per day (use highest slot index)
  const maxSlotIndex =
    slots.length > 0 ? Math.max(...slots.map((s) => s.slot || 0)) : -1;
  const maxSlotsPerDay = maxSlotIndex + 1;

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-24 px-6 py-4">Slot</TableHead>
            {dayColumns.map((dayCol) => (
              <TableHead
                key={dayCol.dayIndex}
                className="min-w-[280px] px-4 py-4 text-center"
              >
                <div className="space-y-2">
                  <div className="font-semibold">Day {dayCol.dayIndex + 1}</div>
                  <div className="text-muted-foreground text-sm">
                    {dayCol.date.toLocaleDateString()}
                  </div>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {Array.from(
            { length: Math.max(1, maxSlotsPerDay) },
            (_, slotIndex) => (
              <TableRow key={slotIndex}>
                <TableCell className="bg-muted/30 px-6 py-4 text-center font-medium">
                  Slot {slotIndex + 1}
                </TableCell>

                {dayColumns.map((dayCol) => {
                  const slot = dayCol.slots.find((s) => s.slot === slotIndex);
                  const key = `${dayCol.dayIndex}-${slotIndex}`;
                  const isSelected =
                    selected &&
                    selected.day === dayCol.dayIndex &&
                    selected.slot === slotIndex;
                  const isMarked = !!(markedMap && markedMap[key]);
                  return (
                    <TableCell
                      key={`${dayCol.dayIndex}-${slotIndex}`}
                      className={`cursor-pointer p-2 align-top ${isSelected ? 'ring-primary/40 bg-blue-50 ring-2' : ''}`}
                      onClick={() =>
                        slot && onSelect(dayCol.dayIndex, slotIndex)
                      }
                    >
                      {slot ? (
                        <div className="flex flex-col gap-2 text-center">
                          <div className="text-sm font-medium">
                            {slot.startTime} - {slot.endTime}
                          </div>
                          <div>
                            {isSelected ? (
                              <div className="rounded-lg bg-blue-50 p-2 text-center">
                                <div className="font-medium text-blue-700">
                                  Selected
                                </div>
                              </div>
                            ) : isMarked ? (
                              <div className="rounded-lg bg-green-50 p-2 text-center">
                                <div className="font-medium text-green-700">
                                  Marked
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg bg-orange-50 p-2 text-center">
                                <div className="font-medium text-orange-700">
                                  Unmarked
                                </div>
                              </div>
                            )}
                          </div>

                          {/*                                                     
                          <div className="grid grid-cols-2 gap-1 text-sm">
                          <div className="rounded-lg bg-blue-50 p-2 text-center">
                            <div className="font-medium text-blue-700">{slot.regularDuties ?? 0}</div>
                            <div className="text-xs text-blue-600">Regular</div>
                          </div>
                          <div className="rounded-lg bg-green-50 p-2 text-center">
                            <div className="font-medium text-green-700">{slot.relieverDuties ?? 0}</div>
                            <div className="text-xs text-green-600">Reliever</div>
                          </div>
                          <div className="rounded-lg bg-purple-50 p-2 text-center">
                            <div className="font-medium text-purple-700">{slot.squadDuties ?? 0}</div>
                            <div className="text-xs text-purple-600">Squad</div>
                          </div>
                          <div className="rounded-lg bg-orange-50 p-2 text-center">
                            <div className="font-medium text-orange-700">{slot.bufferDuties ?? 0}</div>
                            <div className="text-xs text-orange-600">Buffer</div>
                          </div>

                          <div className="bg-muted/50 col-span-2 rounded-lg p-2 text-center">
                            <div className="text-foreground font-semibold">
                              {(slot.regularDuties ?? 0) + (slot.relieverDuties ?? 0) + (slot.squadDuties ?? 0) + (slot.bufferDuties ?? 0)}
                            </div>
                            <div className="text-muted-foreground text-xs">Total Duties</div>
                          </div>
                        </div>
                        */}
                        </div>
                      ) : (
                        <div className="text-muted-foreground flex h-32 items-center justify-center">
                          <div className="text-center text-sm italic">
                            No slot
                          </div>
                        </div>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
    </div>
  );
}
