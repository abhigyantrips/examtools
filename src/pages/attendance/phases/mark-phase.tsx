// ...existing code...
import type { SlotAttendance } from '@/types';

interface MarkPhaseProps {
  attendance: SlotAttendance | null;
  assignedList: Array<{ facultyId: string; role: string }>;
  examFaculty: Array<any>;
  onSetAttendance: (next: SlotAttendance) => void;
}

export function MarkPhase({
  attendance,
  assignedList,
  examFaculty,
  onSetAttendance,
}: MarkPhaseProps) {
  if (!attendance) return null;

  const rows =
    attendance.entries.length === 0
      ? assignedList
      : attendance.entries.map((e) => ({
          facultyId: e.facultyId,
          role: e.role,
          status: e.status,
        }));

  return (
    <div>
      <h3 className="font-semibold">
        Attendance for Day {attendance.day + 1} Slot {attendance.slot + 1}
      </h3>
      <div className="mt-2 space-y-1">
        {rows.map((row) => {
          const currentStatus =
            attendance.entries.find((en) => en.facultyId === row.facultyId)
              ?.status || 'unmarked';
          const facultyName =
            examFaculty.find((f: any) => f.facultyId === row.facultyId)
              ?.facultyName || row.facultyId;
          return (
            <div
              key={row.facultyId}
              className="flex items-center justify-between rounded border p-2"
            >
              <div>
                <div className="font-medium">{facultyName}</div>
                <div className="text-muted-foreground text-xs">
                  {row.facultyId} • {String(row.role).toUpperCase()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className={`rounded border px-2 py-1 ${currentStatus === 'present' ? 'bg-green-100' : ''}`}
                  onClick={() => {
                    const next = { ...attendance };
                    const idx = next.entries.findIndex(
                      (e) => e.facultyId === row.facultyId
                    );
                    if (idx === -1)
                      next.entries.push({
                        facultyId: row.facultyId,
                        role: row.role,
                        status: 'present',
                      } as any);
                    else next.entries[idx].status = 'present';
                    next.updatedAt = new Date().toISOString();
                    onSetAttendance(next);
                  }}
                >
                  Present
                </button>
                <button
                  className={`rounded border px-2 py-1 ${currentStatus === 'absent' ? 'bg-yellow-100' : ''}`}
                  onClick={() => {
                    const next = { ...attendance };
                    const idx = next.entries.findIndex(
                      (e) => e.facultyId === row.facultyId
                    );
                    if (idx === -1)
                      next.entries.push({
                        facultyId: row.facultyId,
                        role: row.role,
                        status: 'absent',
                      } as any);
                    else next.entries[idx].status = 'absent';
                    next.updatedAt = new Date().toISOString();
                    onSetAttendance(next);
                  }}
                >
                  Absent
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
