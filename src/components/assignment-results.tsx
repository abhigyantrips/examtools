import { useMemo, useState } from "react";
import {
  User,
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import type { Assignment, Faculty, DutySlot, AssignmentResult } from "@/types";

interface AssignmentResultsProps {
  result: AssignmentResult;
  faculty: Faculty[];
  dutySlots: DutySlot[];
}

interface FacultyWorkload {
  faculty: Faculty;
  regularDuties: number;
  bufferDuties: number;
  totalDuties: number;
  assignments: Assignment[];
}

interface ParsedWarning {
  originalMessage: string;
  facultyId?: string;
  facultyName?: string;
  type: "faculty" | "general";
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
          type: "faculty",
        };
      }

      return {
        originalMessage: warning,
        type: "general",
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
        if (assignment.isBuffer) {
          workload.bufferDuties++;
        } else {
          workload.regularDuties++;
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
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {result.assignments.filter((a) => !a.isBuffer).length}
            </div>
            <div className="text-sm text-muted-foreground">Regular Duties</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {result.assignments.filter((a) => a.isBuffer).length}
            </div>
            <div className="text-sm text-muted-foreground">Buffer Duties</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{facultyWorkloads.length}</div>
            <div className="text-sm text-muted-foreground">
              Faculty Assigned
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collapsible Warnings */}
      {parsedWarnings.length > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-yellow-600" />
                <CardTitle className="text-yellow-800">
                  Assignment Warnings ({parsedWarnings.length})
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWarningsExpanded(!warningsExpanded)}
                className="text-yellow-700 hover:text-yellow-800 hover:bg-yellow-100"
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
              <CardDescription className="text-yellow-700">
                Some assignments may not be optimal. Click to view details.
              </CardDescription>
            )}
          </CardHeader>

          {warningsExpanded && (
            <CardContent className="pt-0">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {parsedWarnings.map((warning, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-yellow-100 rounded-lg"
                  >
                    <AlertTriangle className="size-4 text-yellow-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      {warning.type === "faculty" && warning.facultyName ? (
                        <div>
                          <div className="font-medium text-yellow-800">
                            {warning.facultyName} ({warning.facultyId})
                          </div>
                          <div className="text-sm text-yellow-700 mt-1">
                            {warning.originalMessage}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-yellow-700">
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
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {facultyWorkloads.map((workload) => (
              <div
                key={workload.faculty.facultyId}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <User className="size-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {workload.faculty.facultyName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {workload.faculty.facultyId} •{" "}
                      {workload.faculty.designation}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium">{workload.regularDuties}</div>
                    <div className="text-muted-foreground">Regular</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">{workload.bufferDuties}</div>
                    <div className="text-muted-foreground">Buffer</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-primary">
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
                  (a) => !a.isBuffer,
                );
                const bufferAssignments = slotAssignments.filter(
                  (a) => a.isBuffer,
                );

                return (
                  <div key={key} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="size-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            Day {dutySlot.day + 1} - Slot {dutySlot.slot + 1}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(dutySlot.date, "MMM dd, yyyy")} •{" "}
                            {dutySlot.startTime} - {dutySlot.endTime}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="size-4 text-green-600" />
                        <span>
                          {slotAssignments.length}/{dutySlot.totalDuties}{" "}
                          assigned
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Regular Duties */}
                      <div>
                        <h5 className="font-medium mb-2 flex items-center gap-2">
                          <MapPin className="size-4" />
                          Regular Duties ({regularAssignments.length})
                        </h5>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {regularAssignments.map((assignment, index) => {
                            const assignedFaculty = faculty.find(
                              (f) => f.facultyId === assignment.facultyId,
                            );
                            return (
                              <div
                                key={index}
                                className="flex items-center justify-between p-2 bg-muted/30 rounded"
                              >
                                <div>
                                  <div className="text-sm font-medium">
                                    {assignedFaculty?.facultyName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {assignedFaculty?.facultyId}
                                  </div>
                                </div>
                                <div className="text-sm font-mono bg-background px-2 py-1 rounded">
                                  {assignment.roomNumber}
                                </div>
                              </div>
                            );
                          })}
                          {regularAssignments.length === 0 && (
                            <div className="text-sm text-muted-foreground italic">
                              No regular duties assigned
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Buffer Duties */}
                      <div>
                        <h5 className="font-medium mb-2 flex items-center gap-2">
                          <User className="size-4" />
                          Buffer Duties ({bufferAssignments.length})
                        </h5>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {bufferAssignments.map((assignment, index) => {
                            const assignedFaculty = faculty.find(
                              (f) => f.facultyId === assignment.facultyId,
                            );
                            return (
                              <div
                                key={index}
                                className="flex items-center justify-between p-2 bg-orange-50 rounded"
                              >
                                <div>
                                  <div className="text-sm font-medium">
                                    {assignedFaculty?.facultyName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {assignedFaculty?.facultyId}
                                  </div>
                                </div>
                                <div className="text-sm text-orange-700 font-medium">
                                  BUFFER
                                </div>
                              </div>
                            );
                          })}
                          {bufferAssignments.length === 0 && (
                            <div className="text-sm text-muted-foreground italic">
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
