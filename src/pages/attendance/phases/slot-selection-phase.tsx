import type { DutySlot } from '@/types';

interface SlotSelectionProps {
  slots: DutySlot[];
  selected: { day: number; slot: number } | null;
  onSelect: (day: number, slot: number) => void;
  // map key is `${day}-${slot}` -> true when attendance exists in zip
  markedMap?: Record<string, boolean>;
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

  // console.log('Day groups for slot selection:', dayGroups);

  return (
    <div className="space-y-4">
      {dayGroups.map((dg) => {
        const displayDate = dg.slots[0]
          ? new Date(dg.slots[0].date)
          : new Date();
        return (
          <div key={`day-${dg.day}`}>
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium">Day {dg.day + 1}</div>
              <div className="text-muted-foreground text-sm">
                {displayDate.toLocaleDateString()}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {dg.slots.map((s) => (
                <button
                  key={`${s.day}-${s.slot}`}
                  onClick={() => onSelect(s.day, s.slot)}
                  className={`w-full rounded px-4 py-2 text-left ${
                    selected &&
                    selected.day === s.day &&
                    selected.slot === s.slot
                      ? 'bg-blue-100'
                      : markedMap && markedMap[`${s.day}-${s.slot}`]
                        ? 'bg-green-100'
                        : 'bg-red-50'
                  }`}
                >
                  Slot {s.slot + 1}
                  <div className="font-medium">{s.label}</div>
                  <div className="text-sm text-slate-500">
                    {s.startTime} - {s.endTime}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
