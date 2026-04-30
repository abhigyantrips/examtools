import type JSZip from 'jszip';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle,
  Settings,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  Assignment,
  DutySlot,
  Faculty,
  Project,
  SlotAttendance,
} from '@/types';

import {
  createEmptyAttendance,
  readAssignmentsFromZip,
  readMetadataFaculty,
  readMetadataSlots,
  readSlotAttendance,
  saveSlotAttendance,
  updateSlotMetadata,
} from '@/lib/attendance';
import { importZipAsDraftProject } from '@/lib/project-import';
import {
  buildZipFromProject,
  extractAttendanceFromZip,
  extractExamDataFromZip,
} from '@/lib/project-zip';
import {
  deleteProject,
  getAttendance,
  getExamData,
  getProject,
  putAttendance,
  putExamData,
  setActiveProjectId,
} from '@/lib/projects-db';
import { cn } from '@/lib/utils';

import { useActiveProjectId } from '@/hooks/use-projects';

import { ToolProjectSelector } from '@/components/projects/tool-project-selector';
import { PWAPrompt } from '@/components/pwa-prompt';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';

import { ImportPhase } from './phases/import-phase';
import { MarkPhase } from './phases/mark-phase';
import { ReviewPhase } from './phases/review-phase';
import { SlotSelectionPhase } from './phases/slot-selection-phase';

type Phase = 'import' | 'select' | 'mark' | 'review';

export function AttendancePage() {
  const { activeProjectId, setActive: setActiveProject } = useActiveProjectId();

  const [error, setError] = useState<Error | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [zipInstance, setZipInstance] = useState<JSZip | null>(null);
  const [zipFileName, setZipFileName] = useState<string | null>(null);
  const [zipSlots, setZipSlots] = useState<DutySlot[] | null>(null);
  const [selected, setSelected] = useState<{
    day: number;
    slot: number;
  } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    day: number;
    slot: number;
  } | null>(null);
  const [attendance, setAttendance] = useState<SlotAttendance | null>(null);
  const [assignedList, setAssignedList] = useState<
    Array<Pick<Assignment, 'facultyId' | 'role'>>
  >([]);
  const [phase, setPhase] = useState<Phase>('import');
  const [markedMap, setMarkedMap] = useState<Record<string, boolean>>({});
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(false);

  // Tracks whether the currently loaded ZIP came from a freshly imported file
  // (so we know to write the parsed exam data back into the project on first
  // load) vs being rebuilt from project storage.
  const justImportedRef = useRef(false);

  const slots = useMemo(() => zipSlots ?? [], [zipSlots]);

  const getPhaseCompletion = useCallback(
    (p: Phase) => {
      switch (p) {
        case 'import':
          return zipInstance !== null;
        case 'select':
          return selected !== null;
        case 'mark':
          return attendance !== null && attendance.entries.length > 0;
        case 'review':
          return attendance !== null;
        default:
          return false;
      }
    },
    [zipInstance, selected, attendance]
  );

  const canProceedToNext = useCallback(
    (current: Phase) => getPhaseCompletion(current),
    [getPhaseCompletion]
  );

  const phases: Phase[] = ['import', 'select', 'mark', 'review'];
  const getNextPhase = (current: Phase) =>
    phases[Math.min(phases.indexOf(current) + 1, phases.length - 1)] ?? null;
  const getPreviousPhase = (current: Phase) =>
    phases[Math.max(phases.indexOf(current) - 1, 0)] ?? null;

  // Persist current attendance state from the in-memory ZIP back into the
  // active project. Called after every meaningful mutation.
  const persistAttendanceToProject = useCallback(
    async (zip: JSZip, projectId: string | null) => {
      if (!projectId) return;
      try {
        const data = await extractAttendanceFromZip(zip);
        if (data) {
          await putAttendance(projectId, data);
        }
      } catch (err) {
        console.warn('Failed to persist attendance to project', err);
      }
    },
    []
  );

  const hydrateZipMetadata = useCallback(async (zip: JSZip) => {
    try {
      const meta = await readMetadataSlots(zip);
      if (meta && meta.length > 0) {
        const mapped = meta.map((s: any) => ({
          ...s,
          date: new Date(s.date),
        })) as DutySlot[];
        setZipSlots(mapped);
        const mm: Record<string, boolean> = {};
        await Promise.all(
          mapped.map(async (s) => {
            try {
              const att = await readSlotAttendance(
                zip,
                Number(s.day),
                Number(s.slot)
              );
              mm[`${s.day}-${s.slot}`] = !!(
                att &&
                att.entries &&
                att.entries.length > 0
              );
            } catch {
              mm[`${s.day}-${s.slot}`] = false;
            }
          })
        );
        setMarkedMap(mm);
      }
    } catch (err) {
      console.warn('Failed to read metadata slots from zip', err);
    }

    try {
      const facultyMeta = await readMetadataFaculty(zip);
      if (facultyMeta && facultyMeta.length > 0) setFacultyList(facultyMeta);
    } catch {
      // ignore
    }
  }, []);

  const onImportZip = useCallback(
    async (f: File | null) => {
      if (!f) return;
      setLoading(true);
      try {
        const { project: draft, zip } = await importZipAsDraftProject(f);
        justImportedRef.current = true;
        await setActiveProject(draft.id);
        setProject(draft);
        setZipInstance(zip);
        setZipFileName(f.name);
        await hydrateZipMetadata(zip);
        setPhase('select');
      } catch (err) {
        console.error('Failed to load ZIP', err);
        toast.error(err instanceof Error ? err.message : 'Failed to load ZIP');
      } finally {
        setLoading(false);
      }
    },
    [hydrateZipMetadata, setActiveProject]
  );

  // Hydrate from the active project on mount / when the active project changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeProjectId) {
        if (!cancelled) {
          setProject(null);
          setZipInstance(null);
          setZipFileName(null);
          setZipSlots(null);
          setMarkedMap({});
          setPhase('import');
        }
        return;
      }
      // Don't clobber the in-memory ZIP we just imported.
      if (justImportedRef.current) {
        justImportedRef.current = false;
        return;
      }
      setLoading(true);
      try {
        const [proj, examData, attendanceData] = await Promise.all([
          getProject(activeProjectId),
          getExamData(activeProjectId),
          getAttendance(activeProjectId),
        ]);
        if (cancelled) return;
        if (!proj) {
          setProject(null);
          setZipInstance(null);
          setPhase('import');
          return;
        }
        setProject(proj);
        if (!examData && !attendanceData) {
          // Empty project — nothing to hydrate; user must import a ZIP.
          setZipInstance(null);
          setZipFileName(null);
          setZipSlots(null);
          setPhase('import');
          return;
        }
        const zip = buildZipFromProject({
          examData,
          attendance: attendanceData,
        });
        setZipInstance(zip);
        setZipFileName(`${proj.title}.zip`);
        await hydrateZipMetadata(zip);
        setPhase('select');
      } catch (err) {
        console.warn('Failed to hydrate from project', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, hydrateZipMetadata]);

  // After a fresh import, write the parsed exam data into the draft project
  // so the project carries metadata even before the user marks anything.
  useEffect(() => {
    if (!zipInstance || !activeProjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const examData = await extractExamDataFromZip(zipInstance);
        if (examData && !cancelled) {
          await putExamData(activeProjectId, examData);
        }
      } catch (err) {
        console.warn('Failed to seed exam data into project', err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // We intentionally only run this when the zipInstance reference changes,
    // not on every render; further changes are persisted via explicit writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipInstance]);

  const onZipReset = useCallback(async () => {
    // If the loaded project is a draft (auto-created from import), drop it
    // entirely. Otherwise just detach this tool from the active project.
    if (project?.isDraft) {
      try {
        await deleteProject(project.id);
      } catch (err) {
        console.warn('Failed to delete draft project', err);
      }
    }
    await setActiveProjectId(null);
    setProject(null);
    setZipInstance(null);
    setZipFileName(null);
    setZipSlots(null);
    setMarkedMap({});
    setPhase('import');
  }, [project]);

  const onSelectSlot = useCallback(
    async (day: number, slot: number) => {
      setSelected({ day, slot });
      setLoading(true);
      const ds = slots.find((s) => s.day === day && s.slot === slot);

      try {
        if (!zipInstance) throw new Error('No ZIP instance loaded');

        const [existing, fromZip] = await Promise.all([
          readSlotAttendance(zipInstance, day, slot),
          readAssignmentsFromZip(zipInstance, day, slot),
        ]);

        const localAssignedList = (fromZip || []).map((r) => ({
          facultyId: r.facultyId,
          role: (String(r.role) as Assignment['role']) || 'regular',
        }));
        setAssignedList(localAssignedList);

        const attendanceData = createEmptyAttendance(
          day,
          slot,
          ds ? ds.date.toISOString() : new Date().toISOString(),
          ds ? `${ds.startTime} - ${ds.endTime}` : undefined
        );

        attendanceData.subjectCode = ds?.subjectCode || undefined;
        attendanceData.subjectNames = ds?.subjectNames || undefined;
        attendanceData.studentsAttended = ds?.studentsAttended;

        if (existing) {
          attendanceData.entries = existing.entries.slice();
          attendanceData.subjectCode =
            existing.subjectCode ?? attendanceData.subjectCode;
          attendanceData.subjectNames =
            existing.subjectNames ?? attendanceData.subjectNames;
          attendanceData.studentsAttended =
            existing.studentsAttended ?? attendanceData.studentsAttended;
          localAssignedList
            .filter((a) => a.role !== 'buffer')
            .forEach((a) => {
              if (
                !attendanceData.entries.some((e) => e.facultyId === a.facultyId)
              ) {
                attendanceData.entries.push({
                  facultyId: a.facultyId,
                  status: 'absent',
                  role: a.role,
                });
              }
            });
        } else {
          localAssignedList.forEach((a) => {
            attendanceData.entries.push({
              facultyId: a.facultyId,
              status: 'absent',
              role: a.role,
            });
          });
        }

        setAttendance(attendanceData);
        setPhase('mark');
      } catch (err) {
        console.error('Failed to select slot', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [zipInstance, slots]
  );

  const handleSetAttendance = useCallback(
    (next: SlotAttendance) => {
      const metadataChanged =
        (attendance?.subjectCode ?? undefined) !==
          (next.subjectCode ?? undefined) ||
        (attendance?.subjectNames ?? undefined) !==
          (next.subjectNames ?? undefined) ||
        (attendance?.studentsAttended ?? undefined) !==
          (next.studentsAttended ?? undefined);

      setAttendance(next);

      if (!metadataChanged) return;

      setZipSlots((prev) => {
        if (!prev) return prev;
        return prev.map((s) =>
          s.day === next.day && s.slot === next.slot
            ? {
                ...s,
                subjectCode: next.subjectCode,
                subjectNames: next.subjectNames,
                studentsAttended: next.studentsAttended,
              }
            : s
        );
      });

      if (!zipInstance) return;

      updateSlotMetadata(zipInstance, next.day, next.slot, {
        subjectCode: next.subjectCode,
        subjectNames: next.subjectNames,
        studentsAttended: next.studentsAttended,
      })
        .then(async () => {
          // Slot metadata edits also affect exam data; refresh stored exam
          // data so the project list/other tools see the change.
          if (activeProjectId) {
            try {
              const examData = await extractExamDataFromZip(zipInstance);
              if (examData) await putExamData(activeProjectId, examData);
            } catch (err) {
              console.warn('Failed to persist exam data after slot edit', err);
            }
          }
        })
        .catch((err) => {
          console.error('Failed to update slot metadata in ZIP', err);
          toast.error('Failed to update slot metadata in ZIP.');
        });
    },
    [attendance, zipInstance, activeProjectId]
  );

  const handleContinue = useCallback(() => {
    if (!canProceedToNext(phase)) {
      toast.error('Please complete the current phase before continuing.');
      return;
    }
    const next = getNextPhase(phase);
    if (phase === 'review') {
      setSelected(null);
      setAttendance(null);
      if (selected) {
        setMarkedMap((prev) => ({
          ...prev,
          [`${selected.day}-${selected.slot}`]: true,
        }));
      }
      if (!zipInstance || !attendance) {
        toast.error('No ZIP instance or attendance data found.');
        return;
      }
      saveSlotAttendance(zipInstance, attendance)
        .then(async () => {
          await persistAttendanceToProject(zipInstance, activeProjectId);
        })
        .catch((err) => {
          console.error('Failed to save attendance', err);
          toast.error('Failed to save attendance data.');
        });

      toast.success(
        'Attendance data saved. You can mark another slot now.'
      );
      setPhase('select');
      return;
    }
    if (next) setPhase(next);
  }, [
    phase,
    canProceedToNext,
    selected,
    zipInstance,
    attendance,
    persistAttendanceToProject,
    activeProjectId,
  ]);

  const handleBack = useCallback(() => {
    const prev = getPreviousPhase(phase);
    if (prev) setPhase(prev);
  }, [phase]);

  const attemptSelectSlot = useCallback(
    (day: number, slot: number) => {
      const key = `${day}-${slot}`;
      if (markedMap && markedMap[key]) {
        setPendingSelection({ day, slot });
        return;
      }
      onSelectSlot(day, slot);
    },
    [markedMap, onSelectSlot]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="border-primary mx-auto size-8 animate-spin rounded-full border-2 border-t-transparent" />
          <p className="text-muted-foreground">Processing...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">
              An unexpected error has occurred
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              {String(error)}
            </p>
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
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center">
            {[
              { key: 'import', label: 'Import', icon: Users },
              { key: 'select', label: 'Select Slot', icon: Settings },
              { key: 'mark', label: 'Mark', icon: Calendar },
              { key: 'review', label: 'Review', icon: CheckCircle },
            ].map(({ key, label, icon: Icon }, index) => {
              const isActive = phase === key;
              const isComplete = getPhaseCompletion(key as Phase);

              return (
                <div
                  key={key}
                  className="flex flex-1 items-center last:flex-none"
                >
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

                  {index < 4 && <div className="bg-border mx-4 h-px flex-1" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={phase === 'import'}
            >
              <ArrowLeft className="mr-2 size-4" /> Back
            </Button>

            <ToolProjectSelector
              phase={phase}
              unlockedOnPhase="import"
              tool="attendance"
              zipFileName={zipFileName}
            />

            <Button
              onClick={handleContinue}
              disabled={!canProceedToNext(phase)}
            >
              {phase === 'review' ? 'Mark Another Slot' : 'Continue'}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6">
        {phase === 'import' && (
          <ImportPhase
            zipFileName={zipFileName}
            zipTimestamps={null}
            onImport={onImportZip}
            onReset={onZipReset}
          />
        )}
        {phase === 'select' && (
          <SlotSelectionPhase
            slots={slots}
            selected={selected}
            onSelect={attemptSelectSlot}
            markedMap={markedMap}
          />
        )}
        {phase === 'mark' && (
          <MarkPhase
            attendance={attendance}
            assignedList={assignedList}
            examFaculty={facultyList}
            onSetAttendance={handleSetAttendance}
          />
        )}
        {phase === 'review' && (
          <ReviewPhase
            attendance={attendance}
            assignedList={assignedList}
            examFaculty={facultyList}
            onSetAttendance={handleSetAttendance}
            zipInstance={zipInstance}
            zipFileName={zipFileName ?? undefined}
          />
        )}
      </main>

      <Toaster />
      <PWAPrompt />

      <AlertDialog
        open={!!pendingSelection}
        onOpenChange={(open) => {
          if (!open) setPendingSelection(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Existing Attendance?</AlertDialogTitle>
            <AlertDialogDescription>
              This slot already has attendance recorded. Are you sure you want
              to edit it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSelection(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingSelection) {
                  await onSelectSlot(
                    pendingSelection.day,
                    pendingSelection.slot
                  );
                }
                setPendingSelection(null);
              }}
            >
              Edit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
