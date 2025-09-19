import { useState, useCallback, useMemo } from 'react';
import { CheckCircle, Clock, Download, Play, RotateCcw, Settings, Users, Calendar, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FacultyUploadForm } from '@/components/forms/faculty-upload-form';
import { ScheduleConfigForm } from '@/components/forms/schedule-config-form';
import { AvailabilityForm } from '@/components/forms/availability-form';
import { useExamData } from '@/hooks/use-exam-data';
import { assignDuties } from '@/lib/assignment';
import { exportAssignmentsOverview, exportBatchAssignments, exportDaySlotAssignments } from '@/lib/excel';
import { cn } from '@/lib/utils';
import type { AssignmentResult } from '@/types';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { AssignmentResults } from '@/components/assignment-results';
import { PWAPrompt } from './components/pwa-prompt';
import { format } from 'date-fns';

type Phase = 'setup' | 'config' | 'assignment';

interface StepStatus {
  facultyUpload: boolean;
  designationCounts: boolean;
  scheduleConfig: boolean;
  availability: boolean;
}

export default function App() {
  const [currentPhase, setCurrentPhase] = useState<Phase>('setup');
  const [assignmentResult, setAssignmentResult] = useState<AssignmentResult | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const { data, loading, error, updateFaculty, updateExamStructure, updateUnavailability, updateAssignments, clearAllData } = useExamData();

  // Calculate step completion status
  const stepStatus = useMemo<StepStatus>(() => {
    const hasDesignationCounts = Object.keys(data.examStructure.designationDutyCounts).length > 0 &&
      Object.values(data.examStructure.designationDutyCounts).some(count => count > 0);

    const hasValidSchedule = data.examStructure.dutySlots.length > 0 &&
      data.examStructure.dutySlots.every(slot => 
        slot.date && 
        slot.totalDuties > 0 && 
        slot.rooms.length === (slot.totalDuties - slot.bufferDuties)
      );

    return {
      facultyUpload: data.faculty.length > 0,
      designationCounts: hasDesignationCounts,
      scheduleConfig: hasValidSchedule,
      availability: true // Optional step, always considered complete
    };
  }, [data]);

  const canProceedToConfig = stepStatus.facultyUpload && stepStatus.designationCounts;
  const canProceedToAssignment = canProceedToConfig && stepStatus.scheduleConfig;

  // Handle assignment generation
  const runAssignment = useCallback(async () => {
    setAssigning(true);
    toast.loading('Generating duty assignments...', { id: 'assignment' });

    try {
      const result = assignDuties(data.faculty, data.examStructure, data.unavailability);
      setAssignmentResult(result);
      
      if (result.success) {
        await updateAssignments(result.assignments);
        toast.success(`Successfully generated ${result.assignments.length} duty assignments.`, { id: 'assignment' });
      } else {
        toast.error(`${result.errors[0]}`, { id: 'assignment' });
      }
    } catch (error) {
      setAssignmentResult({
        success: false,
        assignments: [],
        errors: [`Assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      });
      toast.error('Assignment generation failed!', { id: 'assignment' });
    } finally {
      setAssigning(false);
    }
  }, [data.faculty, data.examStructure, data.unavailability, updateAssignments]);

  // Export functions
  const exportOverview = useCallback(() => {
    const overviewData = data.examStructure.dutySlots.map(slot => ({
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      totalDuties: slot.totalDuties,
      bufferDuties: slot.bufferDuties
    }));
    exportAssignmentsOverview(overviewData);
    toast.success('Overview exported successfully!');
  }, [data.examStructure.dutySlots]);

  const exportSlotAssignments = useCallback((day: number, slot: number) => {
    const dutySlot = data.examStructure.dutySlots.find(s => s.day === day && s.slot === slot);
    const slotAssignments = data.assignments.filter(a => a.day === day && a.slot === slot);
    
    if (!dutySlot) return;

    const exportData = slotAssignments.map((assignment, index) => {
      const faculty = data.faculty.find(f => f.facultyId === assignment.facultyId);
      return {
        sNo: index + 1,
        roomNumber: assignment.roomNumber || 'BUFFER',
        facultyId: assignment.facultyId,
        facultyName: faculty?.facultyName || 'Unknown',
        phoneNo: faculty?.phoneNo || 'N/A'
      };
    });

    exportDaySlotAssignments(
      dutySlot.date,
      `${dutySlot.startTime} - ${dutySlot.endTime}`,
      exportData
    );
    toast.success(`Day ${day + 1} Slot ${slot + 1} assignments exported.`);
  }, [data.examStructure.dutySlots, data.assignments, data.faculty]);

  const exportBatchAll = useCallback(async () => {
  try {
    await exportBatchAssignments(
      data.examStructure.dutySlots,
      data.assignments,
      data.faculty
    );
    toast.success('All assignments exported successfully');
  } catch (error) {
    toast.error('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}, [data.examStructure.dutySlots, data.assignments, data.faculty]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin size-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading exam data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">ExamDuty</h1>
              <p className="text-sm text-muted-foreground">
                An exam duty assignment system.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Instructions
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>How to Use ExamDuty</DialogTitle>
                    <DialogDescription>
                      Follow these steps to generate duty assignments
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Phase 1: Basic Setup</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                        <li>Upload faculty Excel with columns: S No, Faculty Name, Faculty ID, Designation, Department, Phone No</li>
                        <li>Set duty counts for each designation (e.g., "Assistant Professor" gets 5 duties)</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Phase 2: Schedule Configuration</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                        <li>Configure exam structure (days × slots grid)</li>
                        <li>Set dates and times for each slot</li>
                        <li>Upload room numbers Excel for each slot</li>
                        <li>Specify total duties and buffer duties per slot</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Phase 3: Assignment</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                        <li>Optionally mark faculty unavailable for specific dates</li>
                        <li>Generate assignments with automatic constraint checking</li>
                        <li>Export individual slot assignments and overview</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button variant="outline" size="sm" onClick={clearAllData}>
                <RotateCcw className="size-4 mr-2" />
                Reset All
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {[
              { key: 'setup', label: 'Setup', icon: Users },
              { key: 'config', label: 'Configuration', icon: Settings },
              { key: 'assignment', label: 'Assignment', icon: Calendar }
            ].map(({ key, label, icon: Icon }, index) => {
              const isActive = currentPhase === key;
              const isComplete = 
                (key === 'setup' && canProceedToConfig) ||
                (key === 'config' && canProceedToAssignment) ||
                (key === 'assignment' && assignmentResult?.success);

              return (
                <div key={key} className="flex items-center">
                  <div 
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                      isActive && "bg-primary text-primary-foreground",
                      isComplete && !isActive && "bg-green-100 text-green-700",
                      !isActive && !isComplete && "text-muted-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="text-sm font-medium">{label}</span>
                    {isComplete && <CheckCircle className="size-4" />}
                  </div>
                  {index < 2 && (
                    <div className="min-w-full max-w-142 h-px bg-border mx-2" />
                  )}
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
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Basic Setup</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Upload your faculty list and configure duty assignments by designation.
              </p>
            </div>

            <div className="grid gap-8 max-w-4xl mx-auto">
              <FacultyUploadForm 
                currentFaculty={data.faculty}
                onFacultyUploaded={updateFaculty}
              />

              {data.faculty.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Duty Counts by Designation</CardTitle>
                    <CardDescription>
                      Set how many duties each designation should receive during the exam period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      {Array.from(new Set(data.faculty.map(f => f.designation))).filter(Boolean).map(designation => {
                        const facultyCount = data.faculty.filter(f => f.designation === designation).length;
                        const currentCount = data.examStructure.designationDutyCounts[designation] || 0;
                        
                        return (
                          <div key={designation} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium">{designation}</div>
                              <div className="text-sm text-muted-foreground">
                                {facultyCount} faculty member{facultyCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={currentCount}
                              onChange={(e) => {
                                const newCounts = {
                                  ...data.examStructure.designationDutyCounts,
                                  [designation]: parseInt(e.target.value) || 0
                                };
                                updateExamStructure({
                                  ...data.examStructure,
                                  designationDutyCounts: newCounts
                                });
                              }}
                              className="w-20 px-3 py-2 border rounded-md text-center"
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
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Schedule Configuration</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Configure your examination schedule with dates, times, and room assignments.
              </p>
            </div>

            <div className="max-w-6xl mx-auto">
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
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Duty Assignment</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Generate duty assignments and export the results.
              </p>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
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
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-green-700 mb-2">
                            <CheckCircle className="size-4" />
                            <span className="font-medium">Assignment Successful!</span>
                          </div>
                          <p className="text-sm text-green-600">
                            Generated {assignmentResult.assignments.length} duty assignments
                          </p>
                        </div>
                      ) : (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <h4 className="font-medium text-red-700 mb-2">Assignment Failed</h4>
                          <ul className="text-sm text-red-600 space-y-1">
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
                                <div className="h-px bg-border flex-1" />
                                <span className="text-xs text-muted-foreground">Or export individually</span>
                                <div className="h-px bg-border flex-1" />
                              </div>

                              <Button onClick={exportOverview} variant="outline" className="w-full">
                                <FileSpreadsheet className="mr-2 size-4" />
                                Export Overview Only
                              </Button>

                              <div className="space-y-2">
                                <h4 className="text-sm font-medium">Individual Slot Assignments:</h4>
                                <div className="grid gap-2 max-h-32 overflow-y-auto">
                                  {data.examStructure.dutySlots
                                    .sort((a, b) => a.day - b.day || a.slot - b.slot)
                                    .map(slot => (
                                      <Button
                                        key={`${slot.day}-${slot.slot}`}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => exportSlotAssignments(slot.day, slot.slot)}
                                        className="justify-start text-xs"
                                      >
                                        <Download className="mr-2 size-3" />
                                        Day {slot.day + 1} Slot {slot.slot + 1} - {format(slot.date, 'MMM dd')} {slot.startTime}
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