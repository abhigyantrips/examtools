import { format } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileSpreadsheet,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';

import { useCallback, useMemo, useState } from 'react';

import type {
  Assignment,
  AssignmentResult,
  DutySlot,
  ExamStructure,
  Faculty,
  UnavailableFaculty,
} from '@/types';

import { assignDuties } from '@/lib/assignment';
import {
  exportAssignmentsOverview,
  exportBatchAssignments,
  exportDaySlotAssignments,
} from '@/lib/excel';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AssignmentsPhaseProps {
  faculty: Faculty[];
  examStructure: ExamStructure;
  unavailability: UnavailableFaculty[];
  assignments: Assignment[];
  onAssignmentsUpdated: (assignments: Assignment[]) => void;
}

interface DayColumn {
  dayIndex: number;
  date: Date;
  slots: DutySlot[];
}

export function AssignmentsPhase({
  faculty,
  examStructure,
  unavailability,
  assignments,
  onAssignmentsUpdated,
}: AssignmentsPhaseProps) {
  const [assignmentResult, setAssignmentResult] =
    useState<AssignmentResult | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());

  // Organize slots by day (same as configuration)
  const dayColumns = useMemo((): DayColumn[] => {
    const columns: DayColumn[] = [];

    for (let dayIndex = 0; dayIndex < examStructure.days; dayIndex++) {
      const daySlots = examStructure.dutySlots
        .filter((slot) => slot.day === dayIndex)
        .sort((a, b) => a.slot - b.slot);

      columns.push({
        dayIndex,
        date: daySlots[0]?.date || new Date(),
        slots: daySlots,
      });
    }

    return columns;
  }, [examStructure.days, examStructure.dutySlots]);

  const maxSlotsPerDay = Math.max(
    ...dayColumns.map((day) => day.slots.length),
    1
  );

  // Get assignments for a specific slot
  const getSlotAssignments = useCallback(
    (day: number, slot: number) => {
      return assignments.filter((a) => a.day === day && a.slot === slot);
    },
    [assignments]
  );

  // Get faculty details for assignments
  const getSlotAssignmentDetails = useCallback(
    (day: number, slot: number) => {
      const slotAssignments = getSlotAssignments(day, slot);

      return slotAssignments
        .map((assignment) => {
          const facultyMember = faculty.find(
            (f) => f.facultyId === assignment.facultyId
          );
          return {
            assignment,
            faculty: facultyMember,
          };
        })
        .sort((a, b) => {
          // Sort by role (regular first, then others), then by room number
          const roleOrder = { regular: 0, reliever: 1, squad: 2, buffer: 3 };
          const roleComparison =
            roleOrder[a.assignment.role] - roleOrder[b.assignment.role];

          if (roleComparison !== 0) return roleComparison;

          // If same role, sort by room number (regular duties) or faculty name
          if (
            a.assignment.role === 'regular' &&
            b.assignment.role === 'regular'
          ) {
            return (a.assignment.roomNumber || '').localeCompare(
              b.assignment.roomNumber || ''
            );
          }

          return (a.faculty?.facultyName || '').localeCompare(
            b.faculty?.facultyName || ''
          );
        });
    },
    [assignments, faculty, getSlotAssignments]
  );

  // Toggle slot expansion
  const toggleSlotExpansion = (day: number, slot: number) => {
    const key = `${day}-${slot}`;
    setExpandedSlots((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Generate assignments
  const runAssignment = useCallback(async () => {
    setAssigning(true);
    toast.loading('Generating duty assignments...', { id: 'assignment' });

    try {
      const result = assignDuties(faculty, examStructure, unavailability);
      setAssignmentResult(result);

      if (result.success) {
        await onAssignmentsUpdated(result.assignments);
        toast.success(
          `Successfully generated ${result.assignments.length} duty assignments.`,
          { id: 'assignment' }
        );
      } else {
        toast.error(`Assignment failed: ${result.errors[0]}`, {
          id: 'assignment',
        });
      }
    } catch (error) {
      const errorResult: AssignmentResult = {
        success: false,
        assignments: [],
        errors: [
          `Assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        warnings: [],
      };
      setAssignmentResult(errorResult);
      toast.error('Assignment generation failed!', { id: 'assignment' });
    } finally {
      setAssigning(false);
    }
  }, [faculty, examStructure, unavailability, onAssignmentsUpdated]);

  // Export functions
  const exportSlotAssignments = useCallback(
    (day: number, slot: number) => {
      const dutySlot = examStructure.dutySlots.find(
        (s) => s.day === day && s.slot === slot
      );
      const slotAssignments = getSlotAssignments(day, slot);

      if (!dutySlot) return;

      const exportData = slotAssignments.map((assignment, index) => {
        const facultyMember = faculty.find(
          (f) => f.facultyId === assignment.facultyId
        );
        return {
          sNo: index + 1,
          roomNumber: assignment.roomNumber || assignment.role.toUpperCase(),
          facultyId: assignment.facultyId,
          facultyName: facultyMember?.facultyName || 'Unknown',
          phoneNo: facultyMember?.phoneNo || 'N/A',
          role: assignment.role,
        };
      });

      exportDaySlotAssignments(
        dutySlot.date,
        `${dutySlot.startTime} - ${dutySlot.endTime}`,
        exportData
      );
      toast.success(`Day ${day + 1} Slot ${slot + 1} assignments exported.`);
    },
    [examStructure.dutySlots, faculty, getSlotAssignments]
  );

  const exportAllAssignments = useCallback(async () => {
    try {
      await exportBatchAssignments(
        examStructure.dutySlots,
        assignments,
        faculty
      );
      toast.success('All assignments exported successfully');
    } catch (error) {
      toast.error(
        'Export failed: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }, [examStructure.dutySlots, assignments, faculty]);

  const exportOverview = useCallback(() => {
    exportAssignmentsOverview(examStructure.dutySlots, assignments, faculty);
    toast.success('Overview exported successfully!');
  }, [examStructure.dutySlots, assignments, faculty]);

  // Calculate assignment statistics
  const assignmentStats = useMemo(() => {
    if (assignments.length === 0) return null;

    const stats = {
      regular: assignments.filter((a) => a.role === 'regular').length,
      reliever: assignments.filter((a) => a.role === 'reliever').length,
      squad: assignments.filter((a) => a.role === 'squad').length,
      buffer: assignments.filter((a) => a.role === 'buffer').length,
      totalFaculty: new Set(assignments.map((a) => a.facultyId)).size,
    };

    return {
      ...stats,
      total: stats.regular + stats.reliever + stats.squad + stats.buffer,
    };
  }, [assignments]);

  const hasAssignments = assignments.length > 0;

  return (
    <div className="space-y-6">
      {/* Assignment Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="size-5" />
            Generate Assignments
          </CardTitle>
          <CardDescription>
            Generate duty assignments based on your configuration and faculty
            availability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Button
              onClick={runAssignment}
              disabled={assigning || examStructure.dutySlots.length === 0}
              size="lg"
            >
              {assigning ? (
                <>
                  <Clock className="mr-2 size-4 animate-spin" />
                  Generating Assignments...
                </>
              ) : (
                <>
                  <Play className="mr-2 size-4" />
                  Generate Assignments
                </>
              )}
            </Button>
          </div>

          {/* Assignment Statistics */}
          {assignmentStats && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-900/30">
                <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {assignmentStats.regular}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">
                  Regular
                </div>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-900/30">
                <div className="text-xl font-bold text-green-700 dark:text-green-300">
                  {assignmentStats.reliever}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Reliever
                </div>
              </div>
              <div className="rounded-lg bg-purple-50 p-3 text-center dark:bg-purple-900/30">
                <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
                  {assignmentStats.squad}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">
                  Squad
                </div>
              </div>
              <div className="rounded-lg bg-orange-50 p-3 text-center dark:bg-orange-900/30">
                <div className="text-xl font-bold text-orange-700 dark:text-orange-300">
                  {assignmentStats.buffer}
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400">
                  Buffer
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800">
                <div className="text-xl font-bold text-gray-700 dark:text-gray-300">
                  {assignmentStats.totalFaculty}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Faculty
                </div>
              </div>
              <div className="rounded-lg bg-gray-100 p-3 text-center dark:bg-gray-900">
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  {assignmentStats.total}
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total
                </div>
              </div>
            </div>
          )}

          {/* Export Options */}
          {hasAssignments && (
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                onClick={exportAllAssignments}
                className="flex-1 md:flex-initial"
              >
                <Download className="mr-2 size-4" />
                Export All (ZIP)
              </Button>
              <Button
                onClick={exportOverview}
                variant="outline"
                className="flex-1 md:flex-initial"
              >
                <FileSpreadsheet className="mr-2 size-4" />
                Export Overview
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Errors */}
      {assignmentResult && !assignmentResult.success && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="size-5" />
              Assignment Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assignmentResult.errors.map((error, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 text-red-600 dark:text-red-400"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment Warnings */}
      {assignmentResult &&
        assignmentResult.success &&
        assignmentResult.warnings.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <AlertTriangle className="size-5" />
                Assignment Warnings ({assignmentResult.warnings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {assignmentResult.warnings.map((warning, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-yellow-600 dark:text-yellow-400"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span className="text-sm">{warning}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Schedule with Assignments */}
      {dayColumns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assignment Results</CardTitle>
            <CardDescription>
              {hasAssignments
                ? 'Click download to get individual slot assignments, or expand to view faculty details.'
                : 'Generate assignments to see results and download options.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-24 px-6 py-4">Slot</TableHead>
                    {dayColumns.map((dayColumn) => (
                      <TableHead
                        key={dayColumn.dayIndex}
                        className="min-w-[280px] px-4 py-4 text-center"
                      >
                        <div className="space-y-1">
                          <div className="font-semibold">
                            Day {dayColumn.dayIndex + 1}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {format(dayColumn.date, 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {Array.from({ length: maxSlotsPerDay }, (_, slotIndex) => (
                    <TableRow key={slotIndex}>
                      <TableCell className="bg-muted/30 text-center font-medium">
                        Slot {slotIndex + 1}
                      </TableCell>

                      {dayColumns.map((dayColumn) => {
                        const slot = dayColumn.slots.find(
                          (s) => s.slot === slotIndex
                        );
                        const slotAssignments = slot
                          ? getSlotAssignments(dayColumn.dayIndex, slotIndex)
                          : [];
                        const isExpanded = expandedSlots.has(
                          `${dayColumn.dayIndex}-${slotIndex}`
                        );
                        const assignmentDetails = slot
                          ? getSlotAssignmentDetails(
                              dayColumn.dayIndex,
                              slotIndex
                            )
                          : [];

                        return (
                          <TableCell
                            key={`${dayColumn.dayIndex}-${slotIndex}`}
                            className="p-2"
                          >
                            {slot ? (
                              <div className="space-y-3">
                                {/* Time Display */}
                                <div className="flex items-center justify-center gap-1 text-sm font-medium">
                                  <Clock className="size-3" />
                                  {slot.startTime} - {slot.endTime}
                                </div>

                                {/* Assignment Status */}
                                <div className="text-center">
                                  {slotAssignments.length > 0 ? (
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                      <CheckCircle className="mr-1 size-3" />
                                      {slotAssignments.length} assigned
                                    </Badge>
                                  ) : hasAssignments ? (
                                    <Badge variant="destructive">
                                      No assignments
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">Pending</Badge>
                                  )}
                                </div>

                                {/* Required vs Assigned */}
                                <div className="grid grid-cols-2 gap-1 text-xs">
                                  <div className="rounded bg-blue-50 p-1 text-center dark:bg-blue-900/30">
                                    <div className="font-medium text-blue-700 dark:text-blue-300">
                                      {
                                        slotAssignments.filter(
                                          (a) => a.role === 'regular'
                                        ).length
                                      }
                                      /{slot.regularDuties}
                                    </div>
                                    <div className="text-blue-600 dark:text-blue-400">
                                      Regular
                                    </div>
                                  </div>
                                  <div className="rounded bg-green-50 p-1 text-center dark:bg-green-900/30">
                                    <div className="font-medium text-green-700 dark:text-green-300">
                                      {
                                        slotAssignments.filter(
                                          (a) => a.role === 'reliever'
                                        ).length
                                      }
                                      /{slot.relieverDuties || 0}
                                    </div>
                                    <div className="text-green-600 dark:text-green-400">
                                      Reliever
                                    </div>
                                  </div>
                                  <div className="rounded bg-purple-50 p-1 text-center dark:bg-purple-900/30">
                                    <div className="font-medium text-purple-700 dark:text-purple-300">
                                      {
                                        slotAssignments.filter(
                                          (a) => a.role === 'squad'
                                        ).length
                                      }
                                      /{slot.squadDuties || 0}
                                    </div>
                                    <div className="text-purple-600 dark:text-purple-400">
                                      Squad
                                    </div>
                                  </div>
                                  <div className="rounded bg-orange-50 p-1 text-center dark:bg-orange-900/30">
                                    <div className="font-medium text-orange-700 dark:text-orange-300">
                                      {
                                        slotAssignments.filter(
                                          (a) => a.role === 'buffer'
                                        ).length
                                      }
                                      /{slot.bufferDuties}
                                    </div>
                                    <div className="text-orange-600 dark:text-orange-400">
                                      Buffer
                                    </div>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-1">
                                  <div className="flex gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 flex-1 text-xs"
                                      onClick={() =>
                                        exportSlotAssignments(
                                          dayColumn.dayIndex,
                                          slotIndex
                                        )
                                      }
                                      disabled={slotAssignments.length === 0}
                                    >
                                      <Download className="mr-1 size-3" />
                                      Download
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() =>
                                        toggleSlotExpansion(
                                          dayColumn.dayIndex,
                                          slotIndex
                                        )
                                      }
                                      disabled={slotAssignments.length === 0}
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="size-3" />
                                      ) : (
                                        <ChevronDown className="size-3" />
                                      )}
                                    </Button>
                                  </div>

                                  {/* Expandable Faculty List */}
                                  {slotAssignments.length > 0 && (
                                    <Collapsible open={isExpanded}>
                                      <CollapsibleContent className="space-y-1">
                                        <div className="bg-muted/30 max-h-32 overflow-y-auto rounded border p-2">
                                          <div className="space-y-1">
                                            {assignmentDetails.map(
                                              (
                                                {
                                                  assignment,
                                                  faculty: facultyMember,
                                                },
                                                index
                                              ) => (
                                                <div
                                                  key={index}
                                                  className="flex items-center justify-between text-xs"
                                                >
                                                  <div className="min-w-0 flex-1">
                                                    <div className="truncate font-medium">
                                                      {facultyMember?.facultyName ||
                                                        'Unknown'}
                                                    </div>
                                                    <div className="text-muted-foreground">
                                                      {facultyMember?.facultyId}
                                                    </div>
                                                  </div>
                                                  <div className="ml-2 flex items-center gap-1">
                                                    <Badge
                                                      variant="outline"
                                                      className="px-1 py-0 text-xs"
                                                    >
                                                      {assignment.role.toUpperCase()}
                                                    </Badge>
                                                    {assignment.roomNumber && (
                                                      <code className="bg-muted rounded px-1 text-xs">
                                                        {assignment.roomNumber}
                                                      </code>
                                                    )}
                                                  </div>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-muted-foreground flex h-32 items-center justify-center">
                                <div className="text-center text-sm italic">
                                  No slot
                                </div>
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
