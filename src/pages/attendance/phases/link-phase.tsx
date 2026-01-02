import type { Assignment, Faculty, SlotAttendance } from '@/types';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface LinkPhaseProps {
  attendance: SlotAttendance | null;
  assignedList: Array<Pick<Assignment, 'facultyId' | 'role'>>;
  examFaculty: Array<Faculty>;
  onSetAttendance: (next: SlotAttendance) => void;
}

export function LinkPhase({
  attendance,
  assignedList: _assignedList,
  examFaculty,
  onSetAttendance: _onSetAttendance,
}: LinkPhaseProps) {
  if (!attendance) return null;

  // Count number of absentees where role isnt Buffer
  const absentCount = attendance.entries.filter(
    (e) => e.status === 'absent' && e.role !== 'buffer'
  ).length;

  if (absentCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link Phase</CardTitle>
          <CardDescription>
            No absentees recorded. All assigned faculty are present.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    );
  }
  const absentList = attendance.entries.filter(
    (e) => e.status === 'absent' && e.role !== 'buffer'
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link Summary</CardTitle>
        <CardDescription>
          Replacements are set inline in the Mark phase. Use the Mark phase to
          assign buffer or unassigned faculty as replacements.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {absentList.map((absent) => {
            const currentReplacement = attendance.entries.find(
              (en) =>
                en.status === 'replacement' &&
                en.replacementFrom === absent.facultyId
            );
            const replacementLabel = currentReplacement
              ? currentReplacement.facultyId.startsWith('no-replacement-for-')
                ? 'Not covered'
                : `${
                    examFaculty.find((f) => f.facultyId === currentReplacement.facultyId)?.facultyName || currentReplacement.facultyId
                  } (${currentReplacement.facultyId})`
              : 'Pending';

            const absentName =
              examFaculty.find((f) => f.facultyId === absent.facultyId)
                ?.facultyName || absent.facultyId;

            return (
              <div key={absent.facultyId} className="flex items-center justify-between rounded border p-3">
                <div>
                  <div className="font-medium">{absentName} ({absent.facultyId})</div>
                  <div className="text-sm text-muted-foreground">Absent</div>
                </div>
                <div className="text-sm">Replacement: {replacementLabel}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
