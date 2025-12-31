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

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Assignment, DutySlot, Faculty, SlotAttendance } from '@/types';

import {
  createEmptyAttendance,
  readAssignmentsFromZip,
  readMetadataFaculty,
  readMetadataSlots,
  readSlotAttendance,
  saveSlotAttendance,
} from '@/lib/attendance';
import { cn } from '@/lib/utils';
import { loadZip } from '@/lib/zip';

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
import { LinkPhase } from './phases/link-phase';
import { MarkPhase } from './phases/mark-phase';
import { ReviewPhase } from './phases/review-phase';
import { SlotSelectionPhase } from './phases/slot-selection-phase';

export function AttendancePage() {
  // const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [zipInstance, setZipInstance] = useState<JSZip | null>(null);
  const [zipFileName, setZipFileName] = useState<string | null>(null);
  const [zipSlots, setZipSlots] = useState<DutySlot[] | null>(null);
  const [zipTimestamps, setZipTimestamps] = useState<{ updated?: string; created?: string } | null>(null);
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
  const [phase, setPhase] = useState<
    'import' | 'select' | 'mark' | 'link' | 'review'
  >('import');
  const [markedMap, setMarkedMap] = useState<Record<string, boolean>>({});
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);

  // Prefer slots from imported ZIP metadata when present, otherwise use app exam structure
  const slots = useMemo(() => zipSlots ?? [], [zipSlots]);

  type Phase = 'import' | 'select' | 'mark' | 'link' | 'review';

  const getPhaseCompletion = useCallback(
    (p: Phase) => {
      switch (p) {
        case 'import':
          // import phase considered complete when slots are available or zip loaded
          return zipInstance !== null || [].length > 0;
        case 'select':
          return selected !== null;
        case 'mark':
          return attendance !== null && attendance.entries.length > 0;
        case 'link':
          // Complete if all assigned faculty are either present or have a replacement
          if (!attendance) return false;
          const unlinkedAbsentees = attendance.entries.filter(
            (e) =>
              e.status === 'absent' &&
              e.role !== 'buffer' &&
              !attendance.entries.some(
                (en) =>
                  en.status === 'replacement' &&
                  en.replacementFrom === e.facultyId
              )
          );
          return unlinkedAbsentees.length === 0;
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

  const phases: Phase[] = ['import', 'select', 'mark', 'link', 'review'];

  const getNextPhase = (current: Phase): Phase | null => {
    const idx = phases.indexOf(current);
    return idx < phases.length - 1 ? phases[idx + 1] : null;
  };

  const getPreviousPhase = (current: Phase): Phase | null => {
    const idx = phases.indexOf(current);
    return idx > 0 ? phases[idx - 1] : null;
  };

  const handleContinue = useCallback(() => {
    if (!canProceedToNext(phase)) {
      toast.error('Please complete the current phase before continuing.');
      return;
    }
    const next = getNextPhase(phase);
    if (phase === 'review') {
      // Reset selected and attendance to allow new slot selection
      setSelected(null);
      setAttendance(null);
      // Update marked map to reflect newly marked slot
      if (selected) {
        setMarkedMap((prev) => ({
          ...prev,
          [`${selected.day}-${selected.slot}`]: true,
        }));
      }
      if (!zipInstance || !attendance) {
        toast.error('No ZIP instance or attendance data found.');
        return;
      } else {
        // Make a copy of zipInstance to modify
        var zip = zipInstance;
        // Update zip blob
        saveSlotAttendance(zip as any, attendance)
          .then(() => {
            console.log('Saved attendance to ZIP');
          })
          .catch((err) => {
            console.error('Failed to save attendance to ZIP', err);
            toast.error('Failed to save attendance data to ZIP.');
          });
        setZipInstance(zip);
      }

      toast.success(
        'Attendance data saved successfully. You can mark another slot now.'
      );
      // Move to select phase
      setPhase('select');
      return;
    }
    if (next) setPhase(next);
  }, [phase, canProceedToNext]);

  const handleBack = useCallback(() => {
    const prev = getPreviousPhase(phase);
    if (prev) setPhase(prev);
  }, [phase]);

  const onImportZip = useCallback(async (f: File | null) => {
    if (!f) return;
    try {
      const zip = await loadZip(f);
      setZipInstance(zip as any);
      setZipFileName(f.name);
      // persist ZIP in localStorage as data URL so it survives reloads
      try {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const dataUrl = reader.result as string;
            localStorage.setItem('attendance:zip:dataUrl', dataUrl);
            localStorage.setItem('attendance:zip:name', f.name);
          } catch (err) {
            console.warn('Failed to persist ZIP to localStorage', err);
          }
        };
        reader.readAsDataURL(f);
      } catch (err) {
        console.warn('Failed to create data URL for ZIP', err);
      }

      // read last_modified.txt if present and expose to import UI
      try {
        const lm = zip.file('last_modified.txt') || zip.file('internal/last_modified.txt');
        if (lm) {
          const text = await lm.async('string');
          setZipTimestamps({ updated: text });
        }
      } catch (err) {
        // ignore
      }

      // load metadata slots (if the zip contains internal/metadata.json)
      try {
        const meta = await readMetadataSlots(zip as any);
        if (meta && meta.length > 0) {
          // convert date strings to Date objects for display
          const mapped = meta.map((s: any) => ({
            ...s,
            date: new Date(s.date),
          }));
          setZipSlots(mapped);
          // compute marked map for these slots
          const mm: Record<string, boolean> = {};
          await Promise.all(
            mapped.map(async (s: any) => {
              try {
                console.log('Reading attendance for slot:', s);
                const att = await readSlotAttendance(
                  zip as any,
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
          console.log('Marked map from metadata slots:', mm);
          setMarkedMap(mm);
          // Extract faculty list from metadata for faculty map
          const facultyList = await readMetadataFaculty(zip as any);
          if (facultyList && facultyList.length > 0) {
            setFacultyList(facultyList);
          }
        }
      } catch (err) {
        console.warn('Failed to read metadata slots from zip', err);
      }

      console.log('Loaded ZIP');
      // move to select phase after import
      setPhase('select');
    } catch (err) {
      console.error('Failed to load ZIP', err);
    }
  }, []);

  // on mount, try to restore persisted zip from localStorage
  useEffect(() => {
    const dataUrl = localStorage.getItem('attendance:zip:dataUrl');
    const name = localStorage.getItem('attendance:zip:name');
    if (!dataUrl) return;
    (async () => {
      try {
        const resp = await fetch(dataUrl);
        const buffer = await resp.arrayBuffer();
        const f = new File([buffer], name || 'attendance.zip', { type: 'application/zip' });
        const zip = await loadZip(f);
        setZipInstance(zip as any);
        setZipFileName(name || 'attendance.zip');
        // read metadata slots if present
        try {
          const meta = await readMetadataSlots(zip as any);
          if (meta && meta.length > 0) {
            const mapped = meta.map((s: any) => ({ ...s, date: new Date(s.date) }));
            setZipSlots(mapped);
          }
        } catch (err) {
          // ignore
        }
        // read last_modified
        try {
          const lm = zip.file('last_modified.txt') || zip.file('internal/last_modified.txt');
          if (lm) {
            const text = await lm.async('string');
            setZipTimestamps({ updated: text });
          }
        } catch (err) {}
        setPhase('select');
      } catch (err) {
        console.warn('Failed to restore ZIP from storage', err);
      }
    })();
  }, []);

  // recompute marked map when zipInstance or slots change (fallback if no metadata)
  useEffect(() => {
    let cancelled = false;
    async function compute() {
      if (!zipInstance) {
        setMarkedMap({});
        return;
      }
      const mm: Record<string, boolean> = {};
      const iterate = slots && slots.length > 0 ? slots : [];
      await Promise.all(
        iterate.map(async (s: any) => {
          try {
            const att = await readSlotAttendance(
              zipInstance,
              Number(s.day),
              Number(s.slot)
            );
            if (!cancelled)
              mm[`${s.day}-${s.slot}`] = !!(
                att &&
                att.entries &&
                att.entries.length > 0
              );
          } catch {
            if (!cancelled) mm[`${s.day}-${s.slot}`] = false;
          }
        })
      );
      if (!cancelled) setMarkedMap(mm);
    }
    compute();
    return () => {
      cancelled = true;
    };
  }, [zipInstance, slots]);

  const onSelectSlot = useCallback(
    async (day: number, slot: number) => {
      setSelected({ day, slot });
      // load or create attendance
      const ds = slots.find((s) => s.day === day && s.slot === slot);

      if (zipInstance) {
        const existing = await readSlotAttendance(zipInstance, day, slot);
        const fromZip = await readAssignmentsFromZip(zipInstance, day, slot);
        const localAssignedList = fromZip.map((r) => ({
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
        // if existing attendance found in zip, use it to prefill
        if (existing) {
          attendanceData.entries = existing.entries;
          // Ensure all assigned faculty are included (excluding buffers)
          localAssignedList
            .filter((a) => a.role !== 'buffer')
            .forEach((a) => {
              if (
                !attendanceData.entries.some((e) => e.facultyId === a.facultyId)
              ) {
                // Add missing assigned faculty as absent by default
                attendanceData.entries.push({
                  facultyId: a.facultyId,
                  status: 'absent',
                  role: a.role,
                });
              }
            });
        } else {
          // Default all assigned faculty to absent
          localAssignedList.forEach((a) => {
            attendanceData.entries.push({
              facultyId: a.facultyId,
              status: 'absent',
              role: a.role,
            });
          });
        }

        console.log('After adding', attendanceData);

        setAttendance(attendanceData);
        setPhase('mark');
      } else {
        setError(new Error('No ZIP instance loaded'));
        return;
      }
    },
    [zipInstance, slots]
  );

  const attemptSelectSlot = useCallback(
    (day: number, slot: number) => {
      const key = `${day}-${slot}`;
      if (markedMap && markedMap[key]) {
        setPendingSelection({ day, slot });
        return;
      }
      // proceed directly
      onSelectSlot(day, slot);
    },
    [markedMap, onSelectSlot]
  );

  // if (loading) {
  //   return (
  //     <div className="flex min-h-screen items-center justify-center">
  //       <div className="space-y-4 text-center">
  //         <div className="border-primary mx-auto size-8 animate-spin rounded-full border-2 border-t-transparent" />
  //         <p className="text-muted-foreground">Loading exam data...</p>
  //       </div>
  //     </div>
  //   );
  // }

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
      {/* Compact Phase Navigation */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center">
            {[
              { key: 'import', label: 'Import', icon: Users },
              { key: 'select', label: 'Select Slot', icon: Settings },
              { key: 'mark', label: 'Mark', icon: Calendar },
              { key: 'link', label: 'Link', icon: CheckCircle },
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

      {/* Navigation Controls */}
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

            <Button
              onClick={handleContinue}
              disabled={!canProceedToNext(phase)}
            >
              {/* Iterative Marking */}
              {phase === 'review' ? 'Mark Another Slot' : 'Continue'}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Phase Content */}
      <main className="container mx-auto px-4 py-6">
        {phase === 'import' && (
          <ImportPhase zipFileName={zipFileName} zipTimestamps={zipTimestamps} onImport={onImportZip} onReset={() => {
            // clear persisted zip and reset state
            localStorage.removeItem('attendance:zip:dataUrl');
            localStorage.removeItem('attendance:zip:name');
            setZipInstance(null);
            setZipFileName(null);
            setZipSlots(null);
            setMarkedMap({});
            setZipTimestamps(null);
            setPhase('import');
          }} />
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
            onSetAttendance={(next) => setAttendance(next)}
          />
        )}
        {phase === 'link' && (
          <LinkPhase
            attendance={attendance}
            assignedList={assignedList}
            examFaculty={facultyList}
            onSetAttendance={(next) => setAttendance(next)}
          />
        )}
        {phase === 'review' && (
          <ReviewPhase
            attendance={attendance}
            assignedList={assignedList}
            examFaculty={facultyList}
            zipInstance={zipInstance}
            zipFileName={zipFileName ?? undefined}
          />
        )}
      </main>

      <Toaster />
      <PWAPrompt />

      {/* Confirm dialog when editing already-marked slot */}
      <AlertDialog
        open={!!pendingSelection}
        onOpenChange={(open) => {
          if (!open) {
            setPendingSelection(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit existing attendance?</AlertDialogTitle>
            <AlertDialogDescription>
              This slot already has attendance recorded. Are you sure you want
              to edit it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingSelection(null);
              }}
            >
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
