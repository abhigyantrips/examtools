// ...existing code...

interface SlotSelectionProps {
  slots: Array<any>;
  selected: { day: number; slot: number } | null;
  onSelect: (day: number, slot: number) => void;
}

export function SlotSelectionPhase({
  slots,
  selected,
  onSelect,
}: SlotSelectionProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((s) => (
        <button
          key={`${s.day}-${s.slot}`}
          className={`rounded border p-2 ${selected && selected.day === s.day && selected.slot === s.slot ? 'bg-blue-100' : ''}`}
          onClick={() => onSelect(s.day, s.slot)}
        >
          Day {s.day + 1} - Slot {s.slot + 1}
          <div className="text-xs">{new Date(s.date).toLocaleDateString()}</div>
        </button>
      ))}
    </div>
  );
}
