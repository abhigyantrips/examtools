import { format } from 'date-fns';
import { CheckCheck } from 'lucide-react';

import type {
  Assignment,
  AttendanceEntry,
  Faculty,
  SlotAttendance,
} from '@/types';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const rows: Array<{
    facultyId: string;
    role: Assignment['role'];
    status?: AttendanceEntry['status'];
  }> = assignedList.map((a) => {
    const existing = attendance.entries.find(
      (e) => e.facultyId === a.facultyId
    );
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
  const otherRoles = Array.from(groups.keys()).filter(
    (k) => !preferred.includes(k)
  );
  const orderedRoles = [
    ...preferred.filter((r) => groups.has(r)),
    ...otherRoles,
  ];

  // List of faculties who aren't assigned any duty for this slot and hence will be available as overrides in the dropdown
  const unassignedFaculty = examFaculty.filter(
    (f) => !assignedList.some((a) => a.facultyId === f.facultyId)
  );

  // Hide Buffer role as its used to cover absent duties
  const hiddenRoles = ['buffer'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Attendance for Day {attendance.day + 1} (
          {format(attendance.date, 'MMM dd, yyyy')}) · Slot{' '}
          {attendance.slot + 1} ({attendance.time})
        </CardTitle>
        <CardDescription>
          Mark presence or absence for assigned faculty and apply replacements.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mt-2 space-y-6">
          {orderedRoles
            .filter((r) => !hiddenRoles.includes(r))
            .map((role) => {
              const members = groups.get(role) || [];
              return (
                <Card className="my-2 gap-2 px-2 py-0" key={`card-${role}`}>
                  <div className="flex items-center py-2">
                    <div className="text-sm font-medium">
                      {String(role).toUpperCase()}
                    </div>
                    <div className="ml-auto">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="bg-green-50 text-sm hover:bg-green-100 dark:bg-green-900/30 dark:text-green-200 dark:hover:bg-green-800/30"
                        onClick={() => {
                          const next: SlotAttendance = {
                            ...attendance,
                            entries: attendance.entries
                              ? attendance.entries.slice()
                              : [],
                          };
                          const members = groups.get(role) || [];
                          members.forEach((m) => {
                            const idx = next.entries.findIndex(
                              (e) => e.facultyId === m.facultyId
                            );
                            if (idx === -1) {
                              next.entries.push({
                                facultyId: m.facultyId,
                                role: (m.role as any) || role,
                                status: 'present',
                              });
                            } else {
                              // Check is previously marked as absent and remove replacement entry
                              const existing = next.entries[idx];
                              // console.log('Existing entry:', existing);
                              if (existing.status === 'absent') {
                                // Remove any replacement entries linked to this faculty
                                next.entries = next.entries.filter(
                                  (en) =>
                                    !(
                                      en.status === 'replacement' &&
                                      en.replacementFrom === m.facultyId
                                    )
                                );
                              }

                              // Update to present
                              next.entries[idx] = {
                                ...next.entries[idx],
                                status: 'present',
                              };
                            }
                          });
                          next.updatedAt = new Date().toISOString();
                          onSetAttendance(next);
                        }}
                      >
                        Mark All Present <CheckCheck />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {members.map((row) => {
                      const currentStatus =
                        attendance.entries.find(
                          (en) => en.facultyId === row.facultyId
                        )?.status || 'absent';
                      const facultyName =
                        examFaculty.find(
                          (f: any) => f.facultyId === row.facultyId
                        )?.facultyName || row.facultyId;
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
                          <div className="flex items-center gap-2">
                            {/* Replacement selector: only visible when marked absent */}
                            {currentStatus === 'absent' && (
                              <Select
                                value={
                                  attendance.entries.find(
                                    (en) =>
                                      en.status === 'replacement' &&
                                      en.replacementFrom === row.facultyId
                                  )
                                    ? attendance.entries
                                        .find(
                                          (en) =>
                                            en.status === 'replacement' &&
                                            en.replacementFrom === row.facultyId
                                        )!
                                        .facultyId.startsWith(
                                          'no-replacement-for-'
                                        )
                                      ? 'no-replacement'
                                      : attendance.entries.find(
                                          (en) =>
                                            en.status === 'replacement' &&
                                            en.replacementFrom === row.facultyId
                                        )!.facultyId
                                    : ''
                                }
                                onValueChange={(sel) => {
                                  const next: SlotAttendance = {
                                    ...attendance,
                                    entries: attendance.entries
                                      ? attendance.entries.slice()
                                      : [],
                                  };

                                  // remove existing replacement for this absent
                                  next.entries = next.entries.filter(
                                    (en) =>
                                      !(
                                        en.status === 'replacement' &&
                                        en.replacementFrom === row.facultyId
                                      )
                                  );

                                  if (sel === 'no-option') {
                                    next.updatedAt = new Date().toISOString();
                                    onSetAttendance(next);
                                    return;
                                  }

                                  // compute candidates
                                  const bufferCandidates = assignedList
                                    .filter((a) => a.role === 'buffer')
                                    .map((b) => b.facultyId);

                                  // prevent selecting someone already used elsewhere as replacement
                                  const usedElsewhere = next.entries.some(
                                    (en) =>
                                      en.status === 'replacement' &&
                                      en.facultyId === sel
                                  );
                                  if (usedElsewhere) return;

                                  if (sel === 'no-replacement') {
                                    next.entries.push({
                                      facultyId: `no-replacement-for-${row.facultyId}`,
                                      role: 'attendance-override',
                                      status: 'replacement',
                                      replacementFrom: row.facultyId,
                                    });
                                  } else {
                                    const isBuffer =
                                      bufferCandidates.includes(sel);
                                    next.entries.push({
                                      facultyId: sel,
                                      role: isBuffer
                                        ? 'buffer'
                                        : 'attendance-override',
                                      status: 'replacement',
                                      replacementFrom: row.facultyId,
                                    });
                                  }

                                  next.updatedAt = new Date().toISOString();
                                  onSetAttendance(next);
                                }}
                              >
                                <SelectTrigger className="w-56">
                                  <SelectValue placeholder="— Select replacement —" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectLabel>Options</SelectLabel>
                                    <SelectItem value="no-option">
                                      — Pending Selection —
                                    </SelectItem>
                                    <SelectItem value="no-replacement">
                                      Duty not Covered
                                    </SelectItem>
                                  </SelectGroup>

                                  <SelectSeparator />

                                  {assignedList.filter(
                                    (a) => a.role === 'buffer'
                                  ).length > 0 && (
                                    <SelectGroup>
                                      <SelectLabel>Buffer Duties</SelectLabel>
                                      {assignedList
                                        .filter((a) => a.role === 'buffer')
                                        .map((b) => {
                                          const bufUsedElsewhere =
                                            attendance.entries.some(
                                              (en) =>
                                                en.status === 'replacement' &&
                                                en.facultyId === b.facultyId &&
                                                en.replacementFrom !==
                                                  row.facultyId
                                            );
                                          const facultyName =
                                            examFaculty.find(
                                              (f) => f.facultyId === b.facultyId
                                            )?.facultyName || b.facultyId;
                                          return (
                                            <SelectItem
                                              key={`buf-${b.facultyId}`}
                                              value={b.facultyId}
                                              disabled={bufUsedElsewhere}
                                            >
                                              {facultyName} ({b.facultyId})
                                              {bufUsedElsewhere
                                                ? ' — already used'
                                                : ''}
                                            </SelectItem>
                                          );
                                        })}
                                    </SelectGroup>
                                  )}
                                  {unassignedFaculty.length > 0 && (
                                    <SelectGroup>
                                      <SelectLabel>
                                        Unassigned Faculty
                                      </SelectLabel>
                                      {unassignedFaculty.map((f) => {
                                        const usedElsewhere =
                                          attendance.entries.some(
                                            (en) =>
                                              en.status === 'replacement' &&
                                              en.facultyId === f.facultyId &&
                                              en.replacementFrom !==
                                                row.facultyId
                                          );
                                        return (
                                          <SelectItem
                                            key={`un-${f.facultyId}`}
                                            value={f.facultyId}
                                            disabled={usedElsewhere}
                                          >
                                            {f.facultyName} ({f.facultyId})
                                            {usedElsewhere
                                              ? ' — already used'
                                              : ''}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectGroup>
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className={`dark:hover:bg-green-700/50 ${currentStatus === 'present' ? 'bg-green-100 dark:bg-green-800/50' : ''}`}
                              onClick={() => {
                                // create an immutable copy of attendance and its entries
                                const next: SlotAttendance = {
                                  ...attendance,
                                  entries: attendance.entries
                                    ? attendance.entries.slice()
                                    : [],
                                };
                                const idx = next.entries.findIndex(
                                  (e) => e.facultyId === row.facultyId
                                );
                                if (idx === -1) {
                                  next.entries.push({
                                    facultyId: row.facultyId,
                                    role: row.role,
                                    status: 'present',
                                  });
                                } else {
                                  // Check is previously marked as absent and remove replacement entry
                                  const existing = next.entries[idx];
                                  // console.log('Existing entry:', existing);
                                  if (existing.status === 'absent') {
                                    // Remove any replacement entries linked to this faculty
                                    next.entries = next.entries.filter(
                                      (en) =>
                                        !(
                                          en.status === 'replacement' &&
                                          en.replacementFrom === row.facultyId
                                        )
                                    );
                                  }

                                  // Update to present
                                  next.entries[idx] = {
                                    ...next.entries[idx],
                                    status: 'present',
                                  };
                                }
                                next.updatedAt = new Date().toISOString();
                                onSetAttendance(next);
                              }}
                            >
                              Present
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className={`dark:hover:bg-yellow-700/50 ${currentStatus === 'absent' ? 'bg-yellow-100 dark:bg-yellow-800/50' : ''}`}
                              onClick={() => {
                                const next: SlotAttendance = {
                                  ...attendance,
                                  entries: attendance.entries
                                    ? attendance.entries.slice()
                                    : [],
                                };
                                const idx = next.entries.findIndex(
                                  (e) => e.facultyId === row.facultyId
                                );
                                if (idx === -1) {
                                  next.entries.push({
                                    facultyId: row.facultyId,
                                    role: row.role,
                                    status: 'absent',
                                  });
                                } else {
                                  next.entries[idx] = {
                                    ...next.entries[idx],
                                    status: 'absent',
                                  };
                                }
                                next.updatedAt = new Date().toISOString();
                                onSetAttendance(next);
                              }}
                            >
                              Absent
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
