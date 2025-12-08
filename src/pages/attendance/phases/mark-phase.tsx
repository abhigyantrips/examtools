import type { SlotAttendance, Assignment, Faculty, AttendanceEntry } from '@/types';

interface MarkPhaseProps {
  attendance: SlotAttendance | null;
  assignedList: Array<Pick<Assignment, 'facultyId' | 'role'>>;
  examFaculty: Array<Faculty>;
  onSetAttendance: (next: SlotAttendance) => void;
}

export function MarkPhase({
  attendance,
  assignedList,
  examFaculty,
  onSetAttendance,
}: MarkPhaseProps) {
  if (!attendance) return null;

  // Always show the assigned list. Merge existing attendance entries to show their status if present.
  const rows: Array<{ facultyId: string; role: Assignment['role']; status?: AttendanceEntry['status'] }> =
    assignedList.map((a) => {
      const existing = attendance.entries.find((e) => e.facultyId === a.facultyId);
      return { facultyId: a.facultyId, role: a.role, status: existing?.status };
    });
  // Group rows by role (duty type)
  const groups = rows.reduce((acc: Map<string, typeof rows>, r) => {
    const k = String(r.role || 'other');
    if (!acc.has(k)) acc.set(k, [] as typeof rows);
    acc.get(k)!.push(r);
    return acc;
  }, new Map<string, typeof rows>());

  // Preferred order for roles
  const preferred: string[] = ['regular', 'reliever', 'squad'];
  const otherRoles = Array.from(groups.keys()).filter((k) => !preferred.includes(k));
  const orderedRoles = [...preferred.filter((r) => groups.has(r)), ...otherRoles];

  return (
    <div>
      <h3 className="font-semibold">
        Attendance for Day {attendance.day + 1} Slot {attendance.slot + 1}
      </h3>
      <div className="mt-4 space-y-6">
        {orderedRoles.map((role) => {
          const members = groups.get(role) || [];
          return (
            <div key={`role-${role}`}>
              <div className="mb-2 text-sm font-medium">{String(role).toUpperCase()}</div>
              <div className="space-y-2">
                {members.map((row) => {
                  const currentStatus =
                    attendance.entries.find((en) => en.facultyId === row.facultyId)
                      ?.status || 'absent';
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
                            // create an immutable copy of attendance and its entries
                            const next: SlotAttendance = {
                              ...attendance,
                              entries: attendance.entries ? attendance.entries.slice() : [],
                            };
                            const idx = next.entries.findIndex((e) => e.facultyId === row.facultyId);
                            if (idx === -1) {
                              next.entries.push({ facultyId: row.facultyId, role: row.role, status: 'present' });
                            } else {
                              next.entries[idx] = { ...next.entries[idx], status: 'present' };
                            }
                            next.updatedAt = new Date().toISOString();
                            onSetAttendance(next);
                          }}
                        >
                          Present
                        </button>
                        <button
                          className={`rounded border px-2 py-1 ${currentStatus === 'absent' ? 'bg-yellow-100' : ''}`}
                          onClick={() => {
                            const next: SlotAttendance = {
                              ...attendance,
                              entries: attendance.entries ? attendance.entries.slice() : [],
                            };
                            const idx = next.entries.findIndex((e) => e.facultyId === row.facultyId);
                            if (idx === -1) {
                              next.entries.push({ facultyId: row.facultyId, role: row.role, status: 'absent' });
                            } else {
                              next.entries[idx] = { ...next.entries[idx], status: 'absent' };
                            }
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
        })}
      </div>
    </div>
  );
}
