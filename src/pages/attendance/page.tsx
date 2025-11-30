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

import { useCallback, useMemo, useState, useEffect } from 'react';

import type { SlotAttendance, DutySlot, Assignment } from '@/types';

import {
  createEmptyAttendance,
  loadZip,
  readAssignmentsFromZip,
  readMetadataSlots,
  readSlotAttendance,
} from '@/lib/attendance';
import { cn } from '@/lib/utils';

import { useExamData } from '@/hooks/use-exam-data';

import { PWAPrompt } from '@/components/pwa-prompt';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';

import { ImportPhase } from './phases/import-phase';
import { LinkPhase } from './phases/link-phase';
import { MarkPhase } from './phases/mark-phase';
import { ReviewPhase } from './phases/review-phase';
import { SlotSelectionPhase } from './phases/slot-selection-phase';

export function AttendancePage() {
  const { data: examData, loading, error } = useExamData();
  const [zipInstance, setZipInstance] = useState<JSZip | null>(null);
  const [zipFileName, setZipFileName] = useState<string | null>(null);
  const [zipSlots, setZipSlots] = useState<DutySlot[] | null>(null);
  const [selected, setSelected] = useState<{
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

  // Prefer slots from imported ZIP metadata when present, otherwise use app exam structure
  const slots = useMemo(
    () => zipSlots ?? (examData.examStructure.dutySlots || []),
    [examData, zipSlots]
  );

  type Phase = 'import' | 'select' | 'mark' | 'link' | 'review';

  const getPhaseCompletion = useCallback(
    (p: Phase) => {
      switch (p) {
        case 'import':
          // import phase considered complete when slots are available or zip loaded
          return (
            zipInstance !== null ||
            (examData.examStructure.dutySlots || []).length > 0
          );
        case 'select':
          return selected !== null;
        case 'mark':
          return attendance !== null && attendance.entries.length > 0;
        case 'link':
          return true; // placeholder
        case 'review':
          return attendance !== null;
        default:
          return false;
      }
    },
    [zipInstance, examData, selected, attendance]
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

      // load metadata slots (if the zip contains internal/metadata.json)
      try {
        const meta = await readMetadataSlots(zip as any);
        if (meta && meta.length > 0) {
          // convert date strings to Date objects for display
          const mapped = meta.map((s: any) => ({ ...s, date: new Date(s.date) }));
          setZipSlots(mapped);
          // compute marked map for these slots
          const mm: Record<string, boolean> = {};
          await Promise.all(
            mapped.map(async (s: any) => {
              try {
                console.log('Reading attendance for slot:', s);
                const att = await readSlotAttendance(zip as any, Number(s.day), Number(s.slot));
                mm[`${s.day}-${s.slot}`] = !!(att && att.entries && att.entries.length > 0);
              } catch {
                mm[`${s.day}-${s.slot}`] = false;
              }
            })
          );
          console.log('Marked map from metadata slots:', mm);
          setMarkedMap(mm);
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
            const att = await readSlotAttendance(zipInstance, Number(s.day), Number(s.slot));
            if (!cancelled) mm[`${s.day}-${s.slot}`] = !!(att && att.entries && att.entries.length > 0);
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
      const existing = zipInstance
        ? await readSlotAttendance(zipInstance, day, slot)
        : null;
      const att =
        existing ??
        createEmptyAttendance(
          day,
          slot,
          ds ? ds.date.toISOString() : new Date().toISOString(),
          ds ? `${ds.startTime} - ${ds.endTime}` : undefined
        );
      setAttendance(att);

      // load assigned list from zip or fallback to app assignments
      if (zipInstance) {
        const fromZip = await readAssignmentsFromZip(zipInstance, day, slot);
        if (fromZip && fromZip.length > 0)
          setAssignedList(
            fromZip.map((r) => ({
              facultyId: r.facultyId,
              role: (String(r.role) as Assignment['role']) || 'regular',
            }))
          );
        else
          setAssignedList(
            examData.assignments
              .filter((a) => a.day === day && a.slot === slot)
              .map((a) => ({ facultyId: a.facultyId, role: a.role }))
          );
      } else {
        setAssignedList(
          examData.assignments
            .filter((a) => a.day === day && a.slot === slot)
            .map((a) => ({ facultyId: a.facultyId, role: a.role }))
        );
      }

      setPhase('mark');
    },
    [zipInstance, slots, examData]
  );

  // cycling was removed; marking is handled inside the MarkPhase

  // Save is handled by export actions in phases; page does not directly save

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
              disabled={!canProceedToNext(phase) || phase === 'review'}
            >
              Continue <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Phase Content */}
      <main className="container mx-auto px-4 py-6">
        {phase === 'import' && (
          <ImportPhase zipFileName={zipFileName} onImport={onImportZip} />
        )}
        {phase === 'select' && (
          <SlotSelectionPhase
            slots={slots}
            selected={selected}
            onSelect={onSelectSlot}
            markedMap={markedMap}
          />
        )}
        {phase === 'mark' && (
          <MarkPhase
            attendance={attendance}
            assignedList={assignedList}
            examFaculty={examData.faculty}
            onSetAttendance={(next) => setAttendance(next)}
          />
        )}
        {phase === 'link' && <LinkPhase assignedList={assignedList} />}
        {phase === 'review' && <ReviewPhase attendance={attendance} />}
      </main>

      <Toaster />
      <PWAPrompt />
    </div>
  );
}
