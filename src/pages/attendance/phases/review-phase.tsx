import { format } from 'date-fns';
import type JSZip from 'jszip';

import type { Assignment, Faculty, SlotAttendance } from '@/types';

import { generateZipBlob, saveSlotAttendance } from '@/lib/attendance';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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

  const cleanRoleName = (role: string) => {
    switch (role) {
      case 'regular':
        return 'Regular Duty';
      case 'reliever':
        return 'Reliever Duty';
      case 'squad':
        return 'Squad Duty';
      case 'buffer':
        return 'Buffer Duty';
      case 'attendance-override':
        return 'Manual Assignment';
      default:
        return role;
    }
  };

  const assignedCount = assignedList.length;
  const bufferDutyCount = assignedList.filter(
    (a) => a.role === 'buffer'
  ).length;
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
  const overrideCount = attendance.entries.filter(
    (e) => e.role === 'attendance-override'
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
    <Card>
      <CardHeader>
        <CardTitle>Review & Export</CardTitle>
        <CardDescription>
          <p>
            Attendance for Day {attendance.day + 1} (
            {format(attendance.date, 'MMM dd, yyyy')}) · Slot{' '}
            {attendance.slot + 1} ({attendance.time})
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded border p-3">
            <div className="text-muted-foreground text-sm">Required duties</div>
            <div className="text-xl font-medium">
              {assignedCount - bufferDutyCount}
            </div>
          </div>
          <div className="rounded border p-3">
            <div className="text-muted-foreground text-sm">
              Present (without replacements)
            </div>
            <div className="text-xl font-medium">
              {presentCount - replacementsCount}
            </div>
          </div>
          <div className="rounded border p-3">
            <div className="text-muted-foreground text-sm">
              Buffers used / Assigned
            </div>
            <div className="text-xl font-medium">
              {buffersUsedCount} / {bufferDutyCount}
            </div>
          </div>
          <div className="rounded border p-3">
            <div className="text-muted-foreground text-sm">
              Attendance overrides
            </div>
            <div className="text-xl font-medium">{overrideCount}</div>
          </div>
        </div>

        {replacementsCount > 0 && (
          <div className="mt-4">
            <h4 className="font-medium">Absentees & Replacements</h4>
            <div className="mt-2 space-y-2">
              {absentees.map((abs) => {
                const rep = attendance.entries.find(
                  (en) =>
                    en.status === 'replacement' &&
                    en.replacementFrom === abs.facultyId &&
                    !en.facultyId.startsWith('no-replacement-for')
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
                        {abs.facultyId} • {cleanRoleName(abs.role)}
                      </div>
                    </div>
                    <div className="text-right">
                      {rep ? (
                        <div>
                          <div className="font-medium">
                            Covered by {getFacultyName(rep.facultyId)}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {rep.facultyId} • {cleanRoleName(rep.role)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-red-600 dark:text-red-400">
                          Not covered
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-muted-foreground mt-3 text-sm">
          <p>Created: {format(attendance.createdAt, 'dd-MM-yyyy HH:mm:ss')}</p>
          <p>Updated: {format(attendance.updatedAt, 'dd-MM-yyyy HH:mm:ss')}</p>
        </div>

        <div>
          <Button onClick={handleExport}>Export ZIP with Attendance</Button>
        </div>
      </CardFooter>
    </Card>
  );
}
