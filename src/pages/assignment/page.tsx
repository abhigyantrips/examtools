import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle,
  Settings,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { useCallback, useState } from 'react';

import { cn } from '@/lib/utils';

import { useExamData } from '@/hooks/use-exam-data';

import { PWAPrompt } from '@/components/pwa-prompt';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';

import { AllocationPhase } from '@/pages/assignment/phases/allocation-phase';
import { AssignmentsPhase } from '@/pages/assignment/phases/assignments-phase';
import { ConfigurationPhase } from '@/pages/assignment/phases/configuration-phase';
import { UploadPhase } from '@/pages/assignment/phases/upload-phase';

type Phase = 'upload' | 'allocation' | 'configuration' | 'assignments';

export function AssignmentPage() {
  const [currentPhase, setCurrentPhase] = useState<Phase>('upload');

  const {
    data,
    loading,
    error,
    updateFaculty,
    updateExamStructure,
    updateUnavailability,
    updateAssignments,
  } = useExamData();

  const getPhaseCompletion = useCallback(
    (phase: Phase): boolean => {
      switch (phase) {
        case 'upload':
          return data.faculty.length > 0;
        case 'allocation':
          return (
            Object.keys(data.examStructure.designationDutyCounts).length > 0 &&
            Object.values(data.examStructure.designationDutyCounts).some(
              (count) => count > 0
            )
          );
        case 'configuration':
          return (
            data.examStructure.dutySlots.length > 0 &&
            data.examStructure.dutySlots.every(
              (slot) =>
                slot.date &&
                slot.regularDuties > 0 &&
                slot.rooms.length === slot.regularDuties
            )
          );
        case 'assignments':
          return data.assignments.length > 0;
        default:
          return false;
      }
    },
    [data]
  );

  const canProceedToNext = useCallback((): boolean => {
    return getPhaseCompletion(currentPhase);
  }, [currentPhase, getPhaseCompletion]);

  const getNextPhase = (current: Phase): Phase | null => {
    const phases: Phase[] = [
      'upload',
      'allocation',
      'configuration',
      'assignments',
    ];
    const currentIndex = phases.indexOf(current);
    return currentIndex < phases.length - 1 ? phases[currentIndex + 1] : null;
  };

  const getPreviousPhase = (current: Phase): Phase | null => {
    const phases: Phase[] = [
      'upload',
      'allocation',
      'configuration',
      'assignments',
    ];
    const currentIndex = phases.indexOf(current);
    return currentIndex > 0 ? phases[currentIndex - 1] : null;
  };

  const handleContinue = useCallback(() => {
    if (!canProceedToNext()) {
      toast.error('Please complete the current phase before continuing.');
      return;
    }

    const nextPhase = getNextPhase(currentPhase);
    if (nextPhase) {
      setCurrentPhase(nextPhase);
      toast.success(`Proceeding to ${nextPhase} phase.`);
    }
  }, [currentPhase, canProceedToNext]);

  const handleBack = useCallback(() => {
    const previousPhase = getPreviousPhase(currentPhase);
    if (previousPhase) {
      setCurrentPhase(previousPhase);
    }
  }, [currentPhase]);

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
      {/* Compact Phase Navigation */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center">
            {[
              { key: 'upload', label: 'Upload', icon: Users },
              {
                key: 'allocation',
                label: 'Allocation',
                icon: Settings,
              },
              {
                key: 'configuration',
                label: 'Configuration',
                icon: Calendar,
              },
              {
                key: 'assignments',
                label: 'Assignments',
                icon: CheckCircle,
              },
            ].map(({ key, label, icon: Icon }, index) => {
              const isActive = currentPhase === key;
              const isComplete = getPhaseCompletion(key as Phase);

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
                      isComplete &&
                        !isActive &&
                        'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400',
                      !isActive && !isComplete && 'text-muted-foreground'
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="text-sm font-medium">{label}</span>
                    {isComplete && <CheckCircle className="size-4" />}
                  </div>

                  {/* Connector Line - only between items, not after last */}
                  {index < 3 && <div className="bg-border mx-4 h-px flex-1" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentPhase === 'upload'}
            >
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>

            <Button onClick={handleContinue} disabled={!canProceedToNext()}>
              Continue
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Phase Content */}
      <main className="container mx-auto px-4 py-6">
        {currentPhase === 'upload' && (
          <UploadPhase
            faculty={data.faculty}
            onFacultyUploaded={updateFaculty}
          />
        )}
        {currentPhase === 'allocation' && (
          <AllocationPhase
            faculty={data.faculty}
            examStructure={data.examStructure}
            unavailability={data.unavailability}
            onExamStructureUpdated={updateExamStructure}
            onUnavailabilityUpdated={updateUnavailability}
          />
        )}
        {currentPhase === 'configuration' && (
          <ConfigurationPhase
            examStructure={data.examStructure}
            onExamStructureUpdated={updateExamStructure}
          />
        )}
        {currentPhase === 'assignments' && (
          <AssignmentsPhase
            faculty={data.faculty}
            examStructure={data.examStructure}
            unavailability={data.unavailability}
            assignments={data.assignments}
            onAssignmentsUpdated={updateAssignments}
          />
        )}
      </main>

      <Toaster />
      <PWAPrompt />
    </div>
  );
}
