import type { Assignment, Faculty, SlotAttendance } from '@/types';

// Enable option to mark "No Replacement" for absent faculty
const ENABLE_NO_REPLACEMENT_OPTION = true;

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

  const unAssignedFaculty = examFaculty.filter(
    (f) => !assignedList.some((a) => a.facultyId === f.facultyId)
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
            // candidates: buffers assigned for this slot + any examFaculty not assigned any duty in this slot
            const bufferCandidates = assignedList
              .filter((a) => a.role === 'buffer')
              .map((b) => b.facultyId);
            const unassignedCandidates = unAssignedFaculty.map(
              (f) => f.facultyId
            );
            const facultyCandidates = Array.from(
              new Set([...bufferCandidates, ...unassignedCandidates])
            );

            const currentReplacement = attendance.entries.find(
              (en) =>
                en.status === 'replacement' &&
                en.replacementFrom === absent.facultyId
            );

            const replacementFacultyId = currentReplacement
              ? currentReplacement.facultyId.startsWith('no-replacement-for-')
                ? 'no-replacement'
                : currentReplacement.facultyId
              : '';

            const absentName =
              examFaculty.find((f) => f.facultyId === absent.facultyId)
                ?.facultyName || absent.facultyId;

            return (
              <div key={absent.facultyId} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    Absent: {absentName} ({absent.facultyId})
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      className="rounded border px-2 py-1"
                      value={replacementFacultyId}
                      onChange={(ev) => {
                        const sel = ev.target.value; // facultyId or ''
                        const next: SlotAttendance = {
                          ...attendance,
                          entries: attendance.entries
                            ? attendance.entries.slice()
                            : [],
                        };

                        // remove any replacement mapping for this absent
                        next.entries = next.entries.filter(
                          (en) =>
                            !(
                              en.status === 'replacement' &&
                              en.replacementFrom === absent.facultyId
                            )
                        );

                        if (sel === '') {
                          next.updatedAt = new Date().toISOString();
                          onSetAttendance(next);
                          return;
                        }

                        // prevent selecting a faculty already used as replacement for someone else
                        const usedElsewhere = next.entries.some(
                          (en) =>
                            en.status === 'replacement' && en.facultyId === sel
                        );
                        if (usedElsewhere) return;

                        // Special Case of "No Replacement"
                        if (sel === 'no-replacement') {
                          // Add a replacement entry with dummy facultyId
                          next.entries.push({
                            facultyId: `no-replacement-for-${absent.facultyId}`,
                            role: 'attendance-override',
                            status: 'replacement',
                            replacementFrom: absent.facultyId,
                          });
                        } else {
                          const idx = next.entries.findIndex(
                            (en) => en.facultyId === sel
                          );
                          if (idx === -1) {
                            // prefer to keep role as 'buffer' for assigned buffers, otherwise keep existing role if present
                            const isBuffer = bufferCandidates.includes(sel);
                            next.entries.push({
                              facultyId: sel,
                              role: isBuffer ? 'buffer' : 'attendance-override',
                              status: 'replacement',
                              replacementFrom: absent.facultyId,
                            });
                          } else {
                            next.entries[idx] = {
                              ...next.entries[idx],
                              status: 'replacement',
                              replacementFrom: absent.facultyId,
                            };
                          }
                        }

                        next.updatedAt = new Date().toISOString();
                        onSetAttendance(next);
                      }}
                    >
                      <option value="">— Select replacement —</option>
                      {ENABLE_NO_REPLACEMENT_OPTION && (
                        <option value="no-replacement">— Not Replaced —</option>
                      )}
                      {facultyCandidates.map((bId) => {
                        const bufUsedElsewhere = attendance.entries.some(
                          (en) =>
                            en.status === 'replacement' &&
                            en.facultyId === bId &&
                            en.replacementFrom !== absent.facultyId
                        );
                        const facultyName =
                          examFaculty.find((f) => f.facultyId === bId)
                            ?.facultyName || bId;
                        const isBuffer = bufferCandidates.includes(bId);
                        return (
                          <option
                            key={bId}
                            value={bId}
                            disabled={bufUsedElsewhere}
                          >
                            {facultyName} ({bId}){isBuffer ? ' • Buffer' : ''}
                            {bufUsedElsewhere ? ' — already used' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
