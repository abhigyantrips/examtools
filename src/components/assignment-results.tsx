import { format } from 'date-fns';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  User,
} from 'lucide-react';

import { useMemo, useState } from 'react';

import type { Assignment, AssignmentResult, DutySlot, Faculty } from '@/types';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AssignmentResultsProps {
  result: AssignmentResult;
  faculty: Faculty[];
  dutySlots: DutySlot[];
}

interface FacultyWorkload {
  faculty: Faculty;
  regularDuties: number;
  relieverDuties: number;
  squadDuties: number;
  bufferDuties: number;
  totalDuties: number;
  assignments: Assignment[];
}

interface ParsedWarning {
  originalMessage: string;
  facultyId?: string;
  facultyName?: string;
  type: 'faculty' | 'general';
}

export function AssignmentResults({
  result,
  faculty,
  dutySlots,
}: AssignmentResultsProps) {
  const [warningsExpanded, setWarningsExpanded] = useState(false);

  // Parse warnings to extract faculty information
  const parsedWarnings = useMemo((): ParsedWarning[] => {
    return result.warnings.map((warning) => {
      // Look for faculty ID patterns in the warning message
      const facultyIdMatch = warning.match(/Faculty (\w+)/);

      if (facultyIdMatch) {
        const facultyId = facultyIdMatch[1];
        const facultyMember = faculty.find((f) => f.facultyId === facultyId);

        return {
          originalMessage: warning,
          facultyId,
          facultyName: facultyMember?.facultyName,
          type: 'faculty',
        };
      }

      return {
        originalMessage: warning,
        type: 'general',
      };
    });
  }, [result.warnings, faculty]);

  // Calculate faculty workload breakdown
  const facultyWorkloads = useMemo((): FacultyWorkload[] => {
    const workloadMap = new Map<string, FacultyWorkload>();

    // Initialize all faculty
    faculty.forEach((f) => {
      workloadMap.set(f.facultyId, {
        faculty: f,
        regularDuties: 0,
        relieverDuties: 0,
        squadDuties: 0,
        bufferDuties: 0,
        totalDuties: 0,
        assignments: [],
      });
    });

    // Count assignments
    result.assignments.forEach((assignment) => {
      const workload = workloadMap.get(assignment.facultyId);
      if (workload) {
        workload.assignments.push(assignment);
        workload.totalDuties++;
        switch (assignment.role) {
          case 'regular':
            workload.regularDuties++;
            break;
          case 'reliever':
            workload.relieverDuties++;
            break;
          case 'squad':
            workload.squadDuties++;
            break;
          case 'buffer':
            workload.bufferDuties++;
            break;
        }
      }
    });

    return Array.from(workloadMap.values())
      .filter((w) => w.totalDuties > 0)
      .sort((a, b) => b.totalDuties - a.totalDuties);
  }, [result.assignments, faculty]);

  // Group assignments by slot for detailed view
  const assignmentsBySlot = useMemo(() => {
    const grouped = new Map<string, Assignment[]>();

    result.assignments.forEach((assignment) => {
      const key = `${assignment.day}-${assignment.slot}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(assignment);
    });

    return grouped;
  }, [result.assignments]);

  if (!result.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Assignment Failed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {result.errors.map((error, index) => (
              <div key={index} className="flex items-start gap-2 text-red-600">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {result.assignments.filter((a) => a.role === 'regular').length}
            </div>
            <div className="text-muted-foreground text-sm">Regular Duties</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {result.assignments.filter((a) => a.role === 'reliever').length}
            </div>
            <div className="text-muted-foreground text-sm">Reliever Duties</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {result.assignments.filter((a) => a.role === 'squad').length}
            </div>
            <div className="text-muted-foreground text-sm">Squad Duties</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {result.assignments.filter((a) => a.role === 'buffer').length}
            </div>
            <div className="text-muted-foreground text-sm">Buffer Duties</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{facultyWorkloads.length}</div>
            <div className="text-muted-foreground text-sm">
              Faculty Assigned
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collapsible Warnings */}
      {parsedWarnings.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-yellow-600 dark:text-yellow-400" />
                <CardTitle className="text-yellow-800 dark:text-yellow-300">
                  Assignment Warnings ({parsedWarnings.length})
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWarningsExpanded(!warningsExpanded)}
                className="text-yellow-700 hover:bg-yellow-100 hover:text-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-800/50 dark:hover:text-yellow-200"
              >
                {warningsExpanded ? (
                  <>
                    Hide <ChevronUp className="ml-1 size-4" />
                  </>
                ) : (
                  <>
                    Show Details <ChevronDown className="ml-1 size-4" />
                  </>
                )}
              </Button>
            </div>
            {!warningsExpanded && (
              <CardDescription className="text-yellow-700 dark:text-yellow-400">
                Some assignments may not be optimal. Click to view details.
              </CardDescription>
            )}
          </CardHeader>

          {warningsExpanded && (
            <CardContent className="pt-0">
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {parsedWarnings.map((warning, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-lg bg-yellow-100 p-3 dark:bg-yellow-900/40"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                    <div className="min-w-0 flex-1">
                      {warning.type === 'faculty' && warning.facultyName ? (
                        <div>
                          <div className="font-medium text-yellow-800 dark:text-yellow-200">
                            {warning.facultyName} ({warning.facultyId})
                          </div>
                          <div className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                            {warning.originalMessage}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-yellow-700 dark:text-yellow-300">
                          {warning.originalMessage}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Faculty Workload Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Faculty Workload Summary</CardTitle>
          <CardDescription>
            Duty distribution across all faculty members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {facultyWorkloads.map((workload) => (
              <div
                key={workload.faculty.facultyId}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <User className="text-muted-foreground size-4" />
                  <div>
                    <div className="font-medium">
                      {workload.faculty.facultyName}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {workload.faculty.facultyId} •{' '}
                      {workload.faculty.designation}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="text-center">
                    <div className="font-medium">{workload.regularDuties}</div>
                    <div className="text-muted-foreground">Regular</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{workload.relieverDuties}</div>
                    <div className="text-muted-foreground">Reliever</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{workload.squadDuties}</div>
                    <div className="text-muted-foreground">Squad</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{workload.bufferDuties}</div>
                    <div className="text-muted-foreground">Buffer</div>
                  </div>
                  <div className="text-center">
                    <div className="text-primary font-bold">
                      {workload.totalDuties}
                    </div>
                    <div className="text-muted-foreground">Total</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Assignments by Slot */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Slot Assignments</CardTitle>
          <CardDescription>
            Faculty assignments for each examination slot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {dutySlots
              .sort((a, b) => a.day - b.day || a.slot - b.slot)
              .map((dutySlot) => {
                const key = `${dutySlot.day}-${dutySlot.slot}`;
                const slotAssignments = assignmentsBySlot.get(key) || [];
                const regularAssignments = slotAssignments.filter(
                  (a) => a.role === 'regular'
                );
                const relieverAssignments = slotAssignments.filter(
                  (a) => a.role === 'reliever'
                );
                const squadAssignments = slotAssignments.filter(
                  (a) => a.role === 'squad'
                );
                const bufferAssignments = slotAssignments.filter(
                  (a) => a.role === 'buffer'
                );

                return (
                  <div key={key} className="rounded-lg border p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="text-muted-foreground size-4" />
                        <div>
                          <div className="font-medium">
                            Day {dutySlot.day + 1} - Slot {dutySlot.slot + 1}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {format(dutySlot.date, 'MMM dd, yyyy')} •{' '}
                            {dutySlot.startTime} - {dutySlot.endTime}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="size-4 text-green-600" />
                        <span>
                          {slotAssignments.length}/
                          {dutySlot.regularDuties +
                            dutySlot.relieverDuties +
                            dutySlot.squadDuties +
                            dutySlot.bufferDuties}{' '}
                          assigned
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                      {/* Regular Duties */}
                      <div>
                        <h5 className="mb-2 flex items-center gap-2 font-medium">
                          <MapPin className="size-4" />
                          Regular Duties ({regularAssignments.length})
                        </h5>
                        <div className="max-h-48 space-y-2 overflow-y-auto">
                          {regularAssignments.map((assignment, index) => {
                            const assignedFaculty = faculty.find(
                              (f) => f.facultyId === assignment.facultyId
                            );
                            return (
                              <div
                                key={index}
                                className="bg-muted/30 rounded p-2"
                              >
                                <div className="text-sm font-medium">
                                  {assignedFaculty?.facultyName}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {assignedFaculty?.facultyId}
                                </div>
                                <div className="bg-background mt-1 inline-block rounded px-2 py-1 font-mono text-sm">
                                  {assignment.roomNumber}
                                </div>
                              </div>
                            );
                          })}
                          {regularAssignments.length === 0 && (
                            <div className="text-muted-foreground text-sm italic">
                              No regular duties assigned
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reliever Duties */}
                      <div>
                        <h5 className="mb-2 flex items-center gap-2 font-medium">
                          <User className="size-4" />
                          Reliever Duties ({relieverAssignments.length})
                        </h5>
                        <div className="max-h-48 space-y-2 overflow-y-auto">
                          {relieverAssignments.map((assignment, index) => {
                            const assignedFaculty = faculty.find(
                              (f) => f.facultyId === assignment.facultyId
                            );
                            return (
                              <div
                                key={index}
                                className="rounded bg-blue-50 p-2 dark:bg-blue-900/30"
                              >
                                <div className="text-sm font-medium">
                                  {assignedFaculty?.facultyName}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {assignedFaculty?.facultyId}
                                </div>
                              </div>
                            );
                          })}
                          {relieverAssignments.length === 0 && (
                            <div className="text-muted-foreground text-sm italic">
                              No reliever duties assigned
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Squad Duties */}
                      <div>
                        <h5 className="mb-2 flex items-center gap-2 font-medium">
                          <User className="size-4" />
                          Squad Duties ({squadAssignments.length})
                        </h5>
                        <div className="max-h-48 space-y-2 overflow-y-auto">
                          {squadAssignments.map((assignment, index) => {
                            const assignedFaculty = faculty.find(
                              (f) => f.facultyId === assignment.facultyId
                            );
                            return (
                              <div
                                key={index}
                                className="rounded bg-green-50 p-2 dark:bg-green-900/30"
                              >
                                <div className="text-sm font-medium">
                                  {assignedFaculty?.facultyName}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {assignedFaculty?.facultyId}
                                </div>
                              </div>
                            );
                          })}
                          {squadAssignments.length === 0 && (
                            <div className="text-muted-foreground text-sm italic">
                              No squad duties assigned
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Buffer Duties */}
                      <div>
                        <h5 className="mb-2 flex items-center gap-2 font-medium">
                          <User className="size-4" />
                          Buffer Duties ({bufferAssignments.length})
                        </h5>
                        <div className="max-h-48 space-y-2 overflow-y-auto">
                          {bufferAssignments.map((assignment, index) => {
                            const assignedFaculty = faculty.find(
                              (f) => f.facultyId === assignment.facultyId
                            );
                            return (
                              <div
                                key={index}
                                className="rounded bg-orange-50 p-2 dark:bg-orange-900/30"
                              >
                                <div className="text-sm font-medium">
                                  {assignedFaculty?.facultyName}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {assignedFaculty?.facultyId}
                                </div>
                              </div>
                            );
                          })}
                          {bufferAssignments.length === 0 && (
                            <div className="text-muted-foreground text-sm italic">
                              No buffer duties assigned
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
