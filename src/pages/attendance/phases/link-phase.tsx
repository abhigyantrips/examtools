import type { Assignment, Faculty, SlotAttendance } from '@/types';
import { Button } from '@/components/ui/button';

interface LinkPhaseProps {
  attendance: SlotAttendance | null;
  assignedList: Array<Pick<Assignment, 'facultyId' | 'role'>>;
  examFaculty: Array<Faculty>;
  onSetAttendance: (next: SlotAttendance) => void;
}

export function LinkPhase({
  attendance,
  assignedList,
  examFaculty,
  onSetAttendance,
}: LinkPhaseProps) {
  if (!attendance) return null;

  // Count number of absentees where role isnt Buffer
  const absentCount = attendance.entries.filter(
    (e) => e.status === 'absent' && e.role !== 'buffer'
  ).length;

  if (absentCount === 0) {
    return (
      <div>
        <h3 className="font-semibold">Link Phase</h3>
        <p className="text-muted-foreground text-sm">
          No absentees recorded. All assigned faculty are present.
        </p>
      </div>
    );
  }

  const unAssignedFaculty = examFaculty.filter((f) =>
    !assignedList.some((a) => a.facultyId === f.facultyId)
  );

  return (
    <div>
      <h3 className="font-semibold">Link Phase</h3>
      <p className="text-muted-foreground text-sm">
        There are {absentCount} absent faculty. You can link Buffer duty faculty
        to cover these absences.
      </p>
      <div className="mt-3 space-y-4">
        {attendance.entries
          .filter((e) => e.status === 'absent' && e.role !== 'buffer')
          .map((absent) => {
            // available buffers are assignedList entries with role 'buffer'
            const bufferCandidates = assignedList
              .filter((a) => a.role === 'buffer')
              .map((b) => b.facultyId);

            // current mapping: find buffer who has replacementFrom === absent.facultyId
            const currentBuffer = attendance.entries.find(
              (en) => en.status === 'replacement' && en.replacementFrom === absent.facultyId
            );

            return (
              <div key={absent.facultyId} className="rounded border p-3">
                <div className="mb-2 font-medium">Absent: {absent.facultyId}</div>
                <div className="flex items-center gap-3">
                  <select
                    className="rounded border px-2 py-1"
                    value={currentBuffer?.facultyId || ''}
                    onChange={(ev) => {
                      const sel = ev.target.value; // buffer facultyId or ''
                      const next: SlotAttendance = {
                        ...attendance,
                        entries: attendance.entries ? attendance.entries.slice() : [],
                      };

                      // remove any buffer that was replacing this absent
                      next.entries = next.entries.map((en) => {
                        if (en.status === 'replacement' && en.replacementFrom === absent.facultyId) {
                          return { ...en, status: 'absent', replacementFrom: undefined };
                        }
                        return en;
                      });

                      if (sel === '') {
                        // clearing mapping
                        next.updatedAt = new Date().toISOString();
                        onSetAttendance(next);
                        return;
                      }

                      // ensure selected buffer has an entry; set it to replacement
                      const bufIdx = next.entries.findIndex((en) => en.facultyId === sel);
                      if (bufIdx === -1) {
                        next.entries.push({ facultyId: sel, role: 'buffer', status: 'replacement', replacementFrom: absent.facultyId });
                      } else {
                        // Prevent buffer from replacing multiple: clear any other replacementFrom on this buffer
                        next.entries = next.entries.map((en) => (en.facultyId === sel ? { ...en, status: 'replacement', replacementFrom: absent.facultyId } : en));
                      }

                      next.updatedAt = new Date().toISOString();
                      onSetAttendance(next);
                    }}
                  >
                    <option value="">— Select buffer —</option>
                    {bufferCandidates.map((bId) => {
                      const bufUsedElsewhere = attendance.entries.some(
                        (en) => en.status === 'replacement' && en.facultyId === bId && en.replacementFrom !== absent.facultyId
                      );
                      const facultyName = examFaculty.find((f) => f.facultyId === bId)?.facultyName || bId;
                      return (
                        <option key={bId} value={bId} disabled={bufUsedElsewhere}>
                          {facultyName} ({bId}){bufUsedElsewhere ? ' — already used' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
