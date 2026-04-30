import type JSZip from 'jszip';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle,
  Settings,
  Users,
} from 'lucide-react';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AdditionalStaff,
  DutySlot,
  Faculty,
  NonSlotWiseAssignmentEntry,
  Project,
  ProjectRenumerationData,
  RenumerationRoleEntry,
  SlotWiseAssignmentEntry,
} from '@/types';

import { importZipAsDraftProject } from '@/lib/project-import';
import {
  buildZipFromProject,
  extractExamDataFromZip,
} from '@/lib/project-zip';
import {
  deleteProject,
  getAttendance,
  getExamData,
  getProject,
  getRenumeration,
  putExamData,
  putRenumeration,
  setActiveProjectId,
} from '@/lib/projects-db';
import {
  readMetadataSlots,
  readRolesFromZip,
  readSlotAttendance,
} from '@/lib/renumeration';
import { cn } from '@/lib/utils';
import { readTextFile } from '@/lib/zip';

import { useActiveProjectId } from '@/hooks/use-projects';

import { ToolProjectSelector } from '@/components/projects/tool-project-selector';
import { PWAPrompt } from '@/components/pwa-prompt';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';

import { AdditionalAssignmentsPhase } from '@/pages/renumeration/phases/additional-assignments-phase';
import { AdditionalInfoPhase } from '@/pages/renumeration/phases/additional-info-phase';
import { ImportPhase } from '@/pages/renumeration/phases/import-phase';
import { ReviewPhase } from '@/pages/renumeration/phases/review-phase';

const DISABLE_DELAY = true;
type Phase = 'import' | 'info' | 'assign' | 'review';

export function RenumerationPage() {
  const { activeProjectId, setActive: setActiveProject } = useActiveProjectId();

  const [phase, setPhase] = useState<Phase>('import');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  const [zipInstance, setZipInstance] = useState<JSZip | null>(null);
  const [zipFileName, setZipFileName] = useState<string | null>(null);
  const [zipTimestamps, setZipTimestamps] = useState<{
    updated?: string;
    created?: string;
  } | null>(null);

  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [importChecks, setImportChecks] = useState<any | null>(null);
  const [zipSlots, setZipSlots] = useState<DutySlot[] | null>(null);

  const [roles, setRoles] = useState<RenumerationRoleEntry[]>([]);
  const [staffList, setStaffList] = useState<AdditionalStaff[]>([]);
  const [slotWiseAssignments, setSlotWiseAssignments] = useState<
    Record<string, Array<SlotWiseAssignmentEntry>>
  >({});
  const [nonSlotAssignments, setNonSlotAssignments] = useState<
    Record<string, Array<NonSlotWiseAssignmentEntry>>
  >({});
  const [roleNameToIdMap, setRoleNameToIdMap] = useState<
    Record<string, string>
  >({});
  const [visitedAssignPhase, setVisitedAssignPhase] = useState(false);

  // Avoid re-saving renumeration state into the DB before we've finished
  // hydrating it from the DB (otherwise the empty initial state would
  // overwrite stored data on first load).
  const renumerationLoadedRef = useRef(false);
  const justImportedRef = useRef(false);

  const phases: Phase[] = ['import', 'info', 'assign', 'review'];

  const getNextPhase = (current: Phase): Phase | null => {
    const idx = phases.indexOf(current);
    return idx < phases.length - 1 ? phases[idx + 1] : null;
  };

  const getPreviousPhase = (current: Phase): Phase | null => {
    const idx = phases.indexOf(current);
    return idx > 0 ? phases[idx - 1] : null;
  };

  const getPhaseCompletion = useCallback(
    (p: Phase): boolean => {
      switch (p) {
        case 'import':
          if (!importChecks) return false;
          if (importChecks.progress.attendance?.state !== 'done') return false;
          if (importChecks.progress.subjectInfo?.state !== 'done') return false;
          if (
            importChecks.missingAttendanceSlots &&
            importChecks.missingAttendanceSlots.length > 0
          )
            return false;
          if (
            importChecks.missingSubjectInfoSlots &&
            importChecks.missingSubjectInfoSlots.length > 0
          )
            return false;
          if (!facultyList || facultyList.length === 0) return false;
          return zipInstance !== null;
        case 'info':
          if (roles.length === 0) return false;
          for (const r of roles) {
            if (!r.name || r.rate == null || isNaN(r.rate) || r.rate < 1)
              return false;
          }
          return true;
        case 'assign':
          return visitedAssignPhase;
        case 'review':
          return false;
        default:
          return false;
      }
    },
    [zipInstance, facultyList, importChecks, roles, visitedAssignPhase]
  );

  const canProceedToNext = (current: Phase): boolean => {
    const next = getNextPhase(current);
    return next ? getPhaseCompletion(current) : false;
  };

  const handleContinue = useCallback(() => {
    const next = getNextPhase(phase);
    if (next) {
      if (next === 'assign') setVisitedAssignPhase(true);
      setPhase(next);
    }
  }, [phase]);

  const handleBack = useCallback(() => {
    const prev = getPreviousPhase(phase);
    if (prev) setPhase(prev);
  }, [phase]);

  const runImportChecks = async (
    zip: JSZip,
    onProgress?: (partial: any) => void
  ) => {
    const DELAY_MS = 1000;
    const sleep = (ms: number) =>
      new Promise((res) => setTimeout(res, DISABLE_DELAY ? 0 : ms));

    const result: any = {
      slotsFound: false,
      slotsCount: 0,
      facultyCount: 0,
      missingAttendanceSlots: [] as Array<{ day: number; slot: number }>,
      missingSubjectInfoSlots: [] as Array<{
        day: number;
        slot: number;
        missing: string[];
      }>,
      faculty: [] as Faculty[],
      progress: {
        metadata: { state: 'pending', message: '' },
        faculty: { state: 'pending', message: '' },
        attendance: { state: 'pending', message: '' },
        subjectInfo: { state: 'pending', message: '' },
      },
    };

    onProgress?.(result);

    try {
      result.progress.metadata = {
        state: 'processing',
        message: 'Parsing metadata',
      };
      onProgress?.(result);
      await sleep(DELAY_MS);

      const metaText =
        (await readTextFile(zip as any, 'internal/metadata.json')) ||
        (await readTextFile(zip as any, 'metadata.json'));
      if (!metaText) {
        result.progress.metadata = {
          state: 'failed',
          message: 'No metadata found - invalid ZIP file',
        };
        result.progress.faculty.state = 'failed';
        result.progress.attendance.state = 'failed';
        result.progress.subjectInfo.state = 'failed';
        onProgress?.(result);
        return result;
      }

      let obj;
      try {
        obj = JSON.parse(metaText);
      } catch {
        result.progress.metadata = {
          state: 'failed',
          message: 'Invalid metadata format - not a valid exam duty ZIP',
        };
        result.progress.faculty.state = 'failed';
        result.progress.attendance.state = 'failed';
        result.progress.subjectInfo.state = 'failed';
        onProgress?.(result);
        return result;
      }

      result.progress.metadata = { state: 'done', message: 'Metadata parsed' };
      onProgress?.(result);
      await sleep(DELAY_MS);

      result.progress.faculty = {
        state: 'processing',
        message: 'Loading faculty data',
      };
      onProgress?.(result);
      await sleep(DELAY_MS);

      const slots = Array.isArray(obj.slots)
        ? obj.slots
        : Array.isArray(obj.dutySlots)
          ? obj.dutySlots
          : [];
      const facultyArr = Array.isArray(obj.faculty)
        ? obj.faculty
        : Array.isArray(obj.facultyList)
          ? obj.facultyList
          : [];

      result.slotsFound = slots.length > 0;
      result.slotsCount = slots.length;
      result.facultyCount = facultyArr.length;
      result.faculty = facultyArr.map((f: any, idx: number) => ({
        sNo: Number(f.sNo || idx + 1),
        facultyName: String(f.facultyName || ''),
        facultyId: String(f.facultyId || ''),
        designation: String(f.designation || ''),
        department: String(f.department || ''),
        phoneNo: String(f.phoneNo || ''),
      }));

      if (slots.length === 0) {
        result.progress.faculty = {
          state: 'failed',
          message: 'No exam slots found in metadata',
        };
        result.progress.attendance.state = 'failed';
        result.progress.subjectInfo.state = 'failed';
        onProgress?.(result);
        return result;
      }

      if (facultyArr.length === 0) {
        result.progress.faculty = {
          state: 'failed',
          message: 'No faculty data found',
        };
      } else {
        result.progress.faculty = {
          state: 'done',
          message: `${result.facultyCount} faculty entries`,
        };
      }
      onProgress?.(result);
      await sleep(DELAY_MS);

      result.progress.attendance = {
        state: 'processing',
        message: 'Checking attendance',
      };
      result.progress.subjectInfo = {
        state: 'processing',
        message: 'Checking subject info',
      };
      onProgress?.(result);
      await sleep(DELAY_MS);

      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        const day = Number(s.day);
        const slot = Number(s.slot);
        result.progress.attendance = {
          state: 'processing',
          message: `Checking slot ${i + 1}/${slots.length} d${day}-s${slot}`,
        };
        result.progress.subjectInfo = {
          state: 'processing',
          message: `Checking slot ${i + 1}/${slots.length} d${day}-s${slot}`,
        };
        onProgress?.(result);

        try {
          const att = await readSlotAttendance(zip as any, day, slot);
          if (!att || !att.entries || att.entries.length === 0) {
            result.missingAttendanceSlots.push({ day, slot });
          }
        } catch {
          result.missingAttendanceSlots.push({ day, slot });
        }

        const missing: string[] = [];
        if (!s.subjectCode) missing.push('subjectCode');
        if (!s.subjectNames) missing.push('subjectNames');
        if (!s.studentsAttended) missing.push('studentsAttended');
        if (missing.length > 0) {
          result.missingSubjectInfoSlots.push({ day, slot, missing });
        }

        onProgress?.(result);
      }

      result.progress.attendance = {
        state: 'done',
        message: 'Attendance check complete',
      };
      result.progress.subjectInfo = {
        state: 'done',
        message: 'Subject info check complete',
      };
      onProgress?.(result);
      await sleep(DELAY_MS);
    } catch (err) {
      console.error('runImportChecks failed', err);
      if (result.progress.metadata.state === 'processing') {
        result.progress.metadata = {
          state: 'failed',
          message: 'Error reading ZIP file',
        };
      }
      if (
        result.progress.faculty.state === 'processing' ||
        result.progress.faculty.state === 'pending'
      ) {
        result.progress.faculty = {
          state: 'failed',
          message: 'Failed to load faculty data',
        };
      }
      if (
        result.progress.attendance.state === 'processing' ||
        result.progress.attendance.state === 'pending'
      ) {
        result.progress.attendance = {
          state: 'failed',
          message: 'Failed to check attendance',
        };
      }
      if (
        result.progress.subjectInfo.state === 'processing' ||
        result.progress.subjectInfo.state === 'pending'
      ) {
        result.progress.subjectInfo = {
          state: 'failed',
          message: 'Failed to check subject info',
        };
      }
      onProgress?.(result);
    }

    return result;
  };

  const processZip = useCallback(
    async (zip: JSZip, name?: string, onProgress?: (partial: any) => void) => {
      setZipInstance(zip);
      if (name) setZipFileName(name);

      try {
        const lm =
          zip.file('last_modified.txt') ||
          zip.file('internal/last_modified.txt');
        if (lm) {
          const text = await lm.async('string');
          setZipTimestamps({ updated: text });
        }
      } catch {
        // ignore
      }

      setImportChecks(null);
      setFacultyList([]);

      const checks = await runImportChecks(zip, onProgress);
      setImportChecks(checks);
      if (checks && checks.faculty) setFacultyList(checks.faculty);

      try {
        const rolesFromZip = await readRolesFromZip(zip);
        if (rolesFromZip && rolesFromZip.length > 0) {
          const nameToIdMap: Record<string, string> = {};
          rolesFromZip.forEach((r) => {
            nameToIdMap[r.name.toLowerCase()] = r.id;
          });
          if (Object.keys(roleNameToIdMap).length === 0) {
            setRoleNameToIdMap(nameToIdMap);
          }
          setRoles((prev) => (prev.length === 0 ? rolesFromZip : prev));
        }
      } catch {
        // ignore
      }

      try {
        const meta = await readMetadataSlots(zip);
        if (meta && meta.length > 0) {
          const mapped = meta.map((s: any) => ({
            ...s,
            date: new Date(s.date),
          }));
          setZipSlots(mapped);
        }
      } catch (err) {
        console.warn('Failed to read metadata slots from zip', err);
      }

      return checks;
    },
    [roleNameToIdMap]
  );

  const onZipReset = useCallback(async () => {
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
    setZipTimestamps(null);
    setImportChecks(null);
    setFacultyList([]);
    setRoles([]);
    setStaffList([]);
    setSlotWiseAssignments({});
    setNonSlotAssignments({});
    setRoleNameToIdMap({});
    setVisitedAssignPhase(false);
    setError(null);
    setPhase('import');
    renumerationLoadedRef.current = false;
  }, [project]);

  const onImportZip = useCallback(
    async (f: File | null) => {
      if (!f) return;
      // Reset state before processing new ZIP, but skip the draft cleanup
      // the standard reset would do (we're about to create a new draft).
      setImportChecks(null);
      setFacultyList([]);
      setRoles([]);
      setStaffList([]);
      setSlotWiseAssignments({});
      setNonSlotAssignments({});
      setRoleNameToIdMap({});
      setVisitedAssignPhase(false);
      setError(null);
      renumerationLoadedRef.current = false;

      try {
        const { project: draft, zip } = await importZipAsDraftProject(f);
        justImportedRef.current = true;
        await setActiveProject(draft.id);
        setProject(draft);
        await processZip(zip, f.name, (partial: any) => {
          setImportChecks(partial);
        });
        // Finished hydrating; allow renumeration auto-save below.
        renumerationLoadedRef.current = true;
      } catch (err) {
        console.error('Failed to load ZIP', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [processZip, setActiveProject]
  );

  // Hydrate from active project when it changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeProjectId) {
        if (!cancelled) {
          setProject(null);
          setZipInstance(null);
          setZipFileName(null);
          setImportChecks(null);
          setFacultyList([]);
          setRoles([]);
          setStaffList([]);
          setSlotWiseAssignments({});
          setNonSlotAssignments({});
          setRoleNameToIdMap({});
          setVisitedAssignPhase(false);
          setPhase('import');
          renumerationLoadedRef.current = false;
        }
        return;
      }
      if (justImportedRef.current) {
        justImportedRef.current = false;
        return;
      }
      setLoading(true);
      try {
        const [proj, examData, attendanceData, renumeration] =
          await Promise.all([
            getProject(activeProjectId),
            getExamData(activeProjectId),
            getAttendance(activeProjectId),
            getRenumeration(activeProjectId),
          ]);
        if (cancelled) return;
        if (!proj) {
          setProject(null);
          setZipInstance(null);
          setPhase('import');
          return;
        }
        setProject(proj);
        if (renumeration) {
          setRoles(renumeration.roles);
          setStaffList(renumeration.staffList);
          setSlotWiseAssignments(renumeration.slotWiseAssignments);
          setNonSlotAssignments(renumeration.nonSlotAssignments);
          setRoleNameToIdMap(renumeration.roleNameToIdMap);
        }
        if (examData || attendanceData) {
          const zip = buildZipFromProject({
            examData,
            attendance: attendanceData,
          });
          await processZip(zip, `${proj.title}.zip`);
        }
        renumerationLoadedRef.current = true;
      } catch (err) {
        console.warn('Failed to hydrate renumeration from project', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // processZip depends on roleNameToIdMap; re-running it on every change
    // would clobber hydration. We intentionally exclude it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  // After a fresh import, also write the parsed exam data into the project.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipInstance]);

  // Persist renumeration state to project storage whenever any of the tracked
  // pieces change. Skipped until we've finished the initial hydration to
  // avoid overwriting stored values with the empty initial state.
  useEffect(() => {
    if (!activeProjectId) return;
    if (!renumerationLoadedRef.current) return;
    const data: ProjectRenumerationData = {
      roles,
      staffList,
      slotWiseAssignments,
      nonSlotAssignments,
      roleNameToIdMap,
      updatedAt: new Date(),
    };
    putRenumeration(activeProjectId, data).catch((err) => {
      console.warn('Failed to persist renumeration state', err);
    });
  }, [
    activeProjectId,
    roles,
    staffList,
    slotWiseAssignments,
    nonSlotAssignments,
    roleNameToIdMap,
  ]);

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
              { key: 'info', label: 'Additional Info', icon: Settings },
              { key: 'assign', label: 'Assignments', icon: Calendar },
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
              zipFileName={zipFileName}
            />

            <Button
              onClick={handleContinue}
              disabled={!canProceedToNext(phase)}
            >
              Continue
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6">
        {phase === 'import' && (
          <ImportPhase
            zipFileName={zipFileName}
            zipTimestamps={zipTimestamps}
            onImport={onImportZip}
            onReset={onZipReset}
            checks={importChecks}
            facultyList={facultyList}
          />
        )}
        {phase === 'info' && (
          <AdditionalInfoPhase
            roles={roles}
            setRoles={setRoles}
            staffList={staffList}
            setStaffList={setStaffList}
          />
        )}
        {phase === 'assign' && (
          <AdditionalAssignmentsPhase
            roles={roles}
            facultyList={facultyList}
            staffList={staffList}
            nonSlotAssignments={nonSlotAssignments}
            setNonSlotAssignments={setNonSlotAssignments}
            slotWiseAssignments={slotWiseAssignments}
            setSlotWiseAssignments={setSlotWiseAssignments}
            zipSlots={zipSlots!}
          />
        )}
        {phase === 'review' && (
          <ReviewPhase
            zipInstance={zipInstance}
            zipSlots={zipSlots}
            roles={roles}
            facultyList={facultyList}
            staffList={staffList}
            slotWiseAssignments={slotWiseAssignments}
            nonSlotAssignments={nonSlotAssignments}
            roleNameToIdMap={roleNameToIdMap}
          />
        )}
      </main>

      <Toaster />
      <PWAPrompt />
    </div>
  );
}
