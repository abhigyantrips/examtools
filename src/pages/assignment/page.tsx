import { format } from 'date-fns';
import {
  Calendar,
  CheckCircle,
  Clock,
  Download,
  FileSpreadsheet,
  Play,
  Settings,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { useCallback, useMemo, useState } from 'react';

import type { AssignmentResult } from '@/types';

import { assignDuties } from '@/lib/assignment';
import {
  exportAssignmentsOverview,
  exportBatchAssignments,
  exportDaySlotAssignments,
} from '@/lib/excel';
import { cn } from '@/lib/utils';

import { useExamData } from '@/hooks/use-exam-data';

import { AssignmentResults } from '@/components/assignment-results';
import { AvailabilityForm } from '@/components/forms/availability-form';
import { FacultyUploadForm } from '@/components/forms/faculty-upload-form';
import { ScheduleConfigForm } from '@/components/forms/schedule-config-form';
import { PWAPrompt } from '@/components/pwa-prompt';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';

type Phase = 'setup' | 'config' | 'assignment';

interface StepStatus {
  facultyUpload: boolean;
  designationCounts: boolean;
  scheduleConfig: boolean;
  availability: boolean;
}

export function AssignmentPage() {
  const [currentPhase, setCurrentPhase] = useState<Phase>('setup');
  const [assignmentResult, setAssignmentResult] =
    useState<AssignmentResult | null>(null);
  const [assigning, setAssigning] = useState(false);

  const {
    data,
    loading,
    error,
    updateFaculty,
    updateExamStructure,
    updateUnavailability,
    updateAssignments,
  } = useExamData();

  // Calculate step completion status
  const stepStatus = useMemo<StepStatus>(() => {
    const hasDesignationCounts =
      Object.keys(data.examStructure.designationDutyCounts).length > 0 &&
      Object.values(data.examStructure.designationDutyCounts).some(
        (count) => count > 0
      );

    const hasValidSchedule =
      data.examStructure.dutySlots.length > 0 &&
      data.examStructure.dutySlots.every(
        (slot) =>
          slot.date &&
          slot.regularDuties + slot.bufferDuties > 0 &&
          slot.rooms.length === slot.regularDuties
      );

    return {
      facultyUpload: data.faculty.length > 0,
      designationCounts: hasDesignationCounts,
      scheduleConfig: hasValidSchedule,
      availability: true, // Optional step, always considered complete
    };
  }, [data]);

  const canProceedToConfig =
    stepStatus.facultyUpload && stepStatus.designationCounts;
  const canProceedToAssignment =
    canProceedToConfig && stepStatus.scheduleConfig;

  // Handle assignment generation
  const runAssignment = useCallback(async () => {
    setAssigning(true);
    toast.loading('Generating duty assignments...', { id: 'assignment' });

    try {
      const result = assignDuties(
        data.faculty,
        data.examStructure,
        data.unavailability
      );
      setAssignmentResult(result);

      if (result.success) {
        await updateAssignments(result.assignments);
        toast.success(
          `Successfully generated ${result.assignments.length} duty assignments.`,
          { id: 'assignment' }
        );
      } else {
        toast.error(`${result.errors[0]}`, { id: 'assignment' });
      }
    } catch (error) {
      setAssignmentResult({
        success: false,
        assignments: [],
        errors: [
          `Assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        warnings: [],
      });
      toast.error('Assignment generation failed!', { id: 'assignment' });
    } finally {
      setAssigning(false);
    }
  }, [
    data.faculty,
    data.examStructure,
    data.unavailability,
    updateAssignments,
  ]);

  // Export functions
  const exportOverview = useCallback(() => {
    const overviewData = data.examStructure.dutySlots.map((slot) => ({
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      regularDuties: slot.regularDuties,
      bufferDuties: slot.bufferDuties,
    }));
    exportAssignmentsOverview(overviewData);
    toast.success('Overview exported successfully!');
  }, [data.examStructure.dutySlots]);

  const exportSlotAssignments = useCallback(
    (day: number, slot: number) => {
      const dutySlot = data.examStructure.dutySlots.find(
        (s) => s.day === day && s.slot === slot
      );
      const slotAssignments = data.assignments.filter(
        (a) => a.day === day && a.slot === slot
      );

      if (!dutySlot) return;

      const exportData = slotAssignments.map((assignment, index) => {
        const faculty = data.faculty.find(
          (f) => f.facultyId === assignment.facultyId
        );
        return {
          sNo: index + 1,
          roomNumber: assignment.roomNumber || 'BUFFER',
          facultyId: assignment.facultyId,
          facultyName: faculty?.facultyName || 'Unknown',
          phoneNo: faculty?.phoneNo || 'N/A',
        };
      });

      exportDaySlotAssignments(
        dutySlot.date,
        `${dutySlot.startTime} - ${dutySlot.endTime}`,
        exportData
      );
      toast.success(`Day ${day + 1} Slot ${slot + 1} assignments exported.`);
    },
    [data.examStructure.dutySlots, data.assignments, data.faculty]
  );

  const exportBatchAll = useCallback(async () => {
    try {
      await exportBatchAssignments(
        data.examStructure.dutySlots,
        data.assignments,
        data.faculty
      );
      toast.success('All assignments exported successfully');
    } catch (error) {
      toast.error(
        'Export failed: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }, [data.examStructure.dutySlots, data.assignments, data.faculty]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="border-primary mx-auto size-8 animate-spin rounded-full border-2 border-t-transparent" />
          <p className="text-muted-foreground">Loading exam data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">{error}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Progress Indicator */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center">
            {[
              { key: 'setup', label: 'Setup', icon: Users },
              { key: 'config', label: 'Configuration', icon: Settings },
              { key: 'assignment', label: 'Assignment', icon: Calendar },
            ].map(({ key, label, icon: Icon }, index) => {
              const isActive = currentPhase === key;
              const isComplete =
                (key === 'setup' && canProceedToConfig) ||
                (key === 'config' && canProceedToAssignment) ||
                (key === 'assignment' && assignmentResult?.success);

              return (
                <div
                  key={key}
                  className="flex flex-1 items-center last:flex-none"
                >
                  {/* Badge */}
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2 whitespace-nowrap transition-colors',
                      isActive && 'bg-primary text-primary-foreground',
                      isComplete && !isActive && 'bg-green-100 text-green-700',
                      !isActive && !isComplete && 'text-muted-foreground'
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="text-sm font-medium">{label}</span>
                    {isComplete && <CheckCircle className="size-4" />}
                  </div>

                  {/* Connector Line - only between items, not after last */}
                  {index < 2 && <div className="bg-border mx-4 h-px flex-1" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {currentPhase === 'setup' && (
          <div className="space-y-8">
            <div className="space-y-2 text-center">
              <h2 className="text-3xl font-bold">Basic Setup</h2>
              <p className="text-muted-foreground mx-auto max-w-2xl">
                Upload your faculty list and configure duty assignments by
                designation.
              </p>
            </div>

            <div className="mx-auto grid max-w-4xl gap-8">
              <FacultyUploadForm
                currentFaculty={data.faculty}
                onFacultyUploaded={updateFaculty}
              />

              {data.faculty.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Duty Counts by Designation</CardTitle>
                    <CardDescription>
                      Set how many duties each designation should receive during
                      the exam period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      {Array.from(
                        new Set(data.faculty.map((f) => f.designation))
                      )
                        .filter(Boolean)
                        .map((designation) => {
                          const facultyCount = data.faculty.filter(
                            (f) => f.designation === designation
                          ).length;
                          const currentCount =
                            data.examStructure.designationDutyCounts[
                              designation
                            ] || 0;

                          return (
                            <div
                              key={designation}
                              className="flex items-center justify-between rounded-lg border p-3"
                            >
                              <div>
                                <div className="font-medium">{designation}</div>
                                <div className="text-muted-foreground text-sm">
                                  {facultyCount} faculty member
                                  {facultyCount !== 1 ? 's' : ''}
                                </div>
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={currentCount}
                                onChange={(e) => {
                                  const newCounts = {
                                    ...data.examStructure.designationDutyCounts,
                                    [designation]:
                                      parseInt(e.target.value) || 0,
                                  };
                                  updateExamStructure({
                                    ...data.examStructure,
                                    designationDutyCounts: newCounts,
                                  });
                                }}
                                className="w-20 rounded-md border px-3 py-2 text-center"
                              />
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex justify-center">
              <Button
                onClick={() => setCurrentPhase('config')}
                disabled={!canProceedToConfig}
                size="lg"
              >
                Continue to Configuration
              </Button>
            </div>
          </div>
        )}

        {currentPhase === 'config' && (
          <div className="space-y-8">
            <div className="space-y-2 text-center">
              <h2 className="text-3xl font-bold">Schedule Configuration</h2>
              <p className="text-muted-foreground mx-auto max-w-2xl">
                Configure your examination schedule with dates, times, and room
                assignments.
              </p>
            </div>

            <div className="mx-auto max-w-6xl">
              <ScheduleConfigForm
                examStructure={data.examStructure}
                onExamStructureUpdated={updateExamStructure}
              />
            </div>

            <div className="flex justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => setCurrentPhase('setup')}
              >
                Back to Setup
              </Button>
              <Button
                onClick={() => setCurrentPhase('assignment')}
                disabled={!canProceedToAssignment}
                size="lg"
              >
                Continue to Assignment
              </Button>
            </div>
          </div>
        )}

        {currentPhase === 'assignment' && (
          <div className="space-y-8">
            <div className="space-y-2 text-center">
              <h2 className="text-3xl font-bold">Duty Assignment</h2>
              <p className="text-muted-foreground mx-auto max-w-2xl">
                Generate duty assignments and export the results.
              </p>
            </div>

            <div className="mx-auto max-w-4xl space-y-6">
              {/* Availability Form */}
              <AvailabilityForm
                faculty={data.faculty}
                dutySlots={data.examStructure.dutySlots}
                unavailability={data.unavailability}
                onUnavailabilityUpdated={updateUnavailability}
              />

              {/* Assignment Generation */}
              <Card>
                <CardHeader>
                  <CardTitle>Generate Assignments</CardTitle>
                  <CardDescription>
                    Run the assignment algorithm to generate duty schedules
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-center">
                    <Button
                      onClick={runAssignment}
                      disabled={assigning || !canProceedToAssignment}
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

                  {/* Assignment Results */}
                  {assignmentResult && (
                    <div className="space-y-4">
                      {assignmentResult.success ? (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                          <div className="mb-2 flex items-center gap-2 text-green-700">
                            <CheckCircle className="size-4" />
                            <span className="font-medium">
                              Assignment Successful!
                            </span>
                          </div>
                          <p className="text-sm text-green-600">
                            Generated {assignmentResult.assignments.length} duty
                            assignments
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                          <h4 className="mb-2 font-medium text-red-700">
                            Assignment Failed
                          </h4>
                          <ul className="space-y-1 text-sm text-red-600">
                            {assignmentResult.errors.map((error, index) => (
                              <li key={index}>• {error}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Assignment Stats */}
                      {assignmentResult.success && (
                        <AssignmentResults
                          result={assignmentResult}
                          faculty={data.faculty}
                          dutySlots={data.examStructure.dutySlots}
                        />
                      )}

                      {/* Export Options */}
                      {assignmentResult.success && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Export Assignments</CardTitle>
                            <CardDescription>
                              Download assignment documents in Excel format
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Batch Export - Primary Action */}
                            <Button
                              onClick={exportBatchAll}
                              className="w-full"
                              size="lg"
                            >
                              <Download className="mr-2 size-4" />
                              Export All Assignments (ZIP)
                            </Button>

                            {/* Individual Exports - Secondary Actions */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="bg-border h-px flex-1" />
                                <span className="text-muted-foreground text-xs">
                                  Or export individually
                                </span>
                                <div className="bg-border h-px flex-1" />
                              </div>

                              <Button
                                onClick={exportOverview}
                                variant="outline"
                                className="w-full"
                              >
                                <FileSpreadsheet className="mr-2 size-4" />
                                Export Overview Only
                              </Button>

                              <div className="space-y-2">
                                <h4 className="text-sm font-medium">
                                  Individual Slot Assignments:
                                </h4>
                                <div className="grid max-h-32 gap-2 overflow-y-auto">
                                  {data.examStructure.dutySlots
                                    .sort(
                                      (a, b) => a.day - b.day || a.slot - b.slot
                                    )
                                    .map((slot) => (
                                      <Button
                                        key={`${slot.day}-${slot.slot}`}
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          exportSlotAssignments(
                                            slot.day,
                                            slot.slot
                                          )
                                        }
                                        className="justify-start text-xs"
                                      >
                                        <Download className="mr-2 size-3" />
                                        Day {slot.day + 1} Slot {slot.slot + 1}{' '}
                                        - {format(slot.date, 'MMM dd')}{' '}
                                        {slot.startTime}
                                      </Button>
                                    ))}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setCurrentPhase('config')}
              >
                Back to Configuration
              </Button>
            </div>
          </div>
        )}
      </main>

      <Toaster />
      <PWAPrompt />
    </div>
  );
}
