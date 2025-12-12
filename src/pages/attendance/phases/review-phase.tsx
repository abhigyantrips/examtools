import type JSZip from 'jszip';

import type { Assignment, Faculty, SlotAttendance } from '@/types';

import { generateZipBlob, saveSlotAttendance } from '@/lib/attendance';

import { Button } from '@/components/ui/button';

interface ReviewPhaseProps {
  attendance: SlotAttendance | null;
  assignedList: Array<Pick<Assignment, 'facultyId' | 'role'>>;
  examFaculty: Array<Faculty>;
  zipInstance?: JSZip | null;
  zipFileName?: string | null;
}

export function ReviewPhase({
  attendance,
  assignedList,
  examFaculty,
  zipInstance,
  zipFileName,
}: ReviewPhaseProps) {
  if (!attendance) return <div />;

  const assignedCount = assignedList.length;
  const presentCount = attendance.entries.filter(
    (e) => e.status === 'present' || e.status === 'replacement'
  ).length;
  const replacementsCount = attendance.entries.filter(
    (e) => e.status === 'replacement'
  ).length;
  const buffersUsedCount = attendance.entries.filter(
    (e) =>
      e.role === 'buffer' &&
      (e.status === 'present' || e.status === 'replacement')
  ).length;

  const absentees = attendance.entries.filter(
    (e) => e.status === 'absent' && e.role !== 'buffer'
  );

  const getFacultyName = (id: string) =>
    examFaculty.find((f) => f.facultyId === id)?.facultyName || id;

  async function handleExport() {
    if (!attendance) return;
    try {
      // Use provided zipInstance or create a new one
      const JSZipLib = await import('jszip');
      const zip: JSZip = (zipInstance as any) ?? new JSZipLib.default();

      await saveSlotAttendance(zip as any, attendance);

      const blob = await generateZipBlob(zip as any);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const name =
        zipFileName ||
        `attendance-day${attendance!.day}-slot${attendance!.slot}.zip`;
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
      alert('Failed to export ZIP. See console for details.');
    }
  }

  return (
    <div>
      <h3 className="font-semibold">Review & Export</h3>
      <p className="text-muted-foreground text-sm">
        Created: {attendance.createdAt} • Updated: {attendance.updatedAt}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-4">
        <div className="rounded border p-3">
          <div className="text-muted-foreground text-sm">Assigned duties</div>
          <div className="text-xl font-medium">{assignedCount}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-muted-foreground text-sm">
            Present (incl. replacements)
          </div>
          <div className="text-xl font-medium">{presentCount}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-muted-foreground text-sm">
            Replacements / Buffers used
          </div>
          <div className="text-xl font-medium">
            {replacementsCount} / {buffersUsedCount}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="font-medium">Absentees & Replacements</h4>
        <div className="mt-2 space-y-2">
          {absentees.map((abs) => {
            const rep = attendance.entries.find(
              (en) =>
                en.status === 'replacement' &&
                en.replacementFrom === abs.facultyId
            );
            return (
              <div
                key={abs.facultyId}
                className="flex items-center justify-between rounded border p-2"
              >
                <div>
                  <div className="font-medium">
                    {getFacultyName(abs.facultyId)}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {abs.facultyId} • {abs.role}
                  </div>
                </div>
                <div className="text-right">
                  {rep ? (
                    <div>
                      <div className="font-medium">
                        Covered by {getFacultyName(rep.facultyId)}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {rep.facultyId} • {rep.role}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-red-600">Not covered</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <Button onClick={handleExport}>Export ZIP with Attendance</Button>
      </div>
    </div>
  );
}
