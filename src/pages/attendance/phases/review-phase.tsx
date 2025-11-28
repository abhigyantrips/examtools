import type { SlotAttendance } from '@/types';

interface ReviewPhaseProps {
  attendance: SlotAttendance | null;
}

export function ReviewPhase({ attendance }: ReviewPhaseProps) {
  if (!attendance) return <div />;
  return (
    <div>
      <h3 className="font-semibold">Review & Export</h3>
      <p className="text-muted-foreground text-sm">
        Created: {attendance.createdAt} • Updated: {attendance.updatedAt}
      </p>
      <div className="mt-3 space-y-2">
        {attendance.entries.map((e) => (
          <div key={e.facultyId} className="rounded border p-2">
            {e.facultyId} - {e.status} ({e.role})
          </div>
        ))}
      </div>
    </div>
  );
}
