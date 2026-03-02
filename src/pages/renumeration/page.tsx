import type JSZip from 'jszip';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle,
  Settings,
  Users,
} from 'lucide-react';

import { useCallback, useEffect, useState } from 'react';

import type {
  AdditionalStaff,
  DutySlot,
  Faculty,
  NonSlotWiseAssignmentEntry,
  RenumerationRoleEntry,
  SlotWiseAssignmentEntry,
} from '@/types';

import {
  readMetadataSlots,
  readRolesFromZip,
  readSlotAttendance,
} from '@/lib/renumeration';
import { cn } from '@/lib/utils';
import { readTextFile } from '@/lib/zip';
import { loadZip } from '@/lib/zip';

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
  const [phase, setPhase] = useState<Phase>('import');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Zip file state
  const [zipInstance, setZipInstance] = useState<JSZip | null>(null);
  const [zipFileName, setZipFileName] = useState<string | null>(null);
  const [zipTimestamps, setZipTimestamps] = useState<{
    updated?: string;
    created?: string;
  } | null>(null);

  // Imported data state
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [importChecks, setImportChecks] = useState<any | null>(null);

  // Slot data
  const [zipSlots, setZipSlots] = useState<DutySlot[] | null>(null);

  // Role data
  const [roles, setRoles] = useState<RenumerationRoleEntry[]>([]);
  // Staff list imported from an Excel sheet in the Additional Info phase
  const [staffList, setStaffList] = useState<AdditionalStaff[]>([]);
  // Slot wise assignments
  const [slotWiseAssignments, setSlotWiseAssignments] = useState<
    Record<string, Array<SlotWiseAssignmentEntry>>
  >({});
  // Non-slot-wise assignments: map roleId -> list of {personId,name,source,count}
  const [nonSlotAssignments, setNonSlotAssignments] = useState<
    Record<string, Array<NonSlotWiseAssignmentEntry>>
  >({});
  // Store mapping of ZIP role name to RenumerationRoleEntry ID
  const [roleNameToIdMap, setRoleNameToIdMap] = useState<
    Record<string, string>
  >({});
  // Store if user has visited the assign phase to update its completion status
  const [visitedAssignPhase, setVisitedAssignPhase] = useState(false);
  
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
    (phase: Phase): boolean => {
      // Placeholder logic; replace with actual completion checks
      switch (phase) {
        case 'import':
          // console.log('importChecks', importChecks);
          if (!importChecks) {
            // Import checks haven't run yet
            return false;
          }
          if (importChecks.progress.attendance?.state !== 'done') {
            // Attendance check not done
            return false;
          }
          if (importChecks.progress.subjectInfo?.state !== 'done') {
            // Subject info check not done
            return false;
          }
          if (
            importChecks.missingAttendanceSlots &&
            importChecks.missingAttendanceSlots.length > 0
          ) {
            // Missing attendance slots or check not done
            return false;
          }
          if (
            importChecks.missingSubjectInfoSlots &&
            importChecks.missingSubjectInfoSlots.length > 0
          ) {
            // Missing subject info on slots or not done
            return false;
          }
          if (!facultyList || facultyList.length === 0) {
            // No faculty loaded or not done
            return false;
          }
          return zipInstance !== null;
        case 'info':
          // require at least one role defined and all roles to have a name and rate
          if (roles.length === 0) {
            return false;
          }
          for (const r of roles) {
            if (!r.name || r.rate == null || isNaN(r.rate) || r.rate < 1) {
              return false;
            }
          }
          // console.log('Roles complete:', roles);
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
      // Mark assign phase as visited when navigating to it
      if (next === 'assign') {
        setVisitedAssignPhase(true);
      }
      setPhase(next);
    }
  }, [phase]);

  const handleBack = useCallback(() => {
    const prev = getPreviousPhase(phase);
    if (prev) setPhase(prev);
  }, [phase, getPreviousPhase]);

  const onImportZip = useCallback(async (f: File | null) => {
    if (!f) return;
    // Reset state before processing new ZIP
    onZipReset();
    try {
      const zip = await loadZip(f);
      // process zip
      await processZip(zip, f.name, (partial: any) => {
        setImportChecks(partial);
      });
      // persist ZIP in localStorage
      try {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const dataUrl = reader.result as string;
            localStorage.setItem('renumeration:zip:dataUrl', dataUrl);
            localStorage.setItem('renumeration:zip:name', f.name);
          } catch (err) {
            console.warn('Failed to persist ZIP to localStorage', err);
          }
        };
        reader.readAsDataURL(f);
      } catch (err) {
        console.warn('Failed to create data URL for ZIP', err);
      }

      // read last_modified timestamp
      try {
        const lm =
          zip.file('last_modified.txt') ||
          zip.file('internal/last_modified.txt');
        if (lm) {
          const text = await lm.async('string');
          setZipTimestamps({ updated: text });
        }
      } catch (err) {
        // ignore
      }

      // Extract data from ZIP and run verification checks with progressive updates
      setImportChecks(null);
      const checks = await runImportChecks(zip as any, (partial: any) => {
        setImportChecks(partial);
      });
      // ensure final state is applied
      setImportChecks(checks);
      // populate faculty list if present
      if (checks && checks.faculty && checks.faculty.length > 0) {
        setFacultyList(checks.faculty);
      } else {
        setFacultyList([]);
      }
      // populate roles from assignments in the zip
      try {
        const rolesFromZip = await readRolesFromZip(zip as any);
        if (rolesFromZip && rolesFromZip.length > 0) {
          // Generate mapping of role name to ID
          const nameToIdMap: Record<string, string> = {};
          rolesFromZip.forEach((r) => {
            nameToIdMap[r.name.toLowerCase()] = r.id;
          });
          setRoleNameToIdMap(nameToIdMap);
          setRoles(rolesFromZip);
        }
      } catch (err) {
        // ignore role loading errors
      }
      // Load slot data
      try {
        const meta = await readMetadataSlots(zip as any);
        if (meta && meta.length > 0) {
          // convert date strings to Date objects for display
          const mapped = meta.map((s: any) => ({
            ...s,
            date: new Date(s.date),
          }));
          setZipSlots(mapped);
        }
      } catch (err) {
        console.warn('Failed to read metadata slots from zip', err);
      }
      console.log('Loaded ZIP');
    } catch (err) {
      console.error('Failed to load ZIP', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  // Zip processing function shared between import and restore
  const processZip = useCallback(
    async (zip: JSZip, name?: string, onProgress?: (partial: any) => void) => {
      setZipInstance(zip as any);
      if (name) setZipFileName(name);

      // read last_modified timestamp
      try {
        const lm =
          zip.file('last_modified.txt') ||
          zip.file('internal/last_modified.txt');
        if (lm) {
          const text = await lm.async('string');
          setZipTimestamps({ updated: text });
        }
      } catch (err) {
        // ignore
      }

      // reset previous checks and state data
      setImportChecks(null);
      setFacultyList([]);

      // run verification checks with progressive updates
      const checks = await runImportChecks(zip as any, onProgress);
      setImportChecks(checks);
      // populate faculty list if present
      if (checks && checks.faculty) {
        setFacultyList(checks.faculty);
      }

      // populate roles from assignments in the zip
      try {
        const rolesFromZip = await readRolesFromZip(zip as any);
        if (rolesFromZip && rolesFromZip.length > 0) {
          const nameToIdMap: Record<string, string> = {};
          rolesFromZip.forEach((r) => {
            nameToIdMap[r.name.toLowerCase()] = r.id;
          });
          // Only set roleNameToIdMap if not already populated from localStorage
          if (Object.keys(roleNameToIdMap).length === 0) {
            setRoleNameToIdMap(nameToIdMap);
          }
          setRoles(rolesFromZip);
        }
      } catch (err) {
        // ignore role loading errors
      }

      // Load slot data
      try {
        const meta = await readMetadataSlots(zip as any);
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
    []
  );

  const runImportChecks = async (
    zip: JSZip,
    onProgress?: (partial: any) => void
  ) => {
    const DELAY_MS = 1000;
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, DISABLE_DELAY ? 0 : ms));

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

    // Emit initial pending state immediately
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
      } catch (parseErr) {
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

      // Set faculty processing state before computing
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

      // Check if we have valid data
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

      // Check each slot for attendance and subject info (sequentially to provide progress updates)
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
        } catch (err) {
          result.missingAttendanceSlots.push({ day, slot });
        }

        const missing: string[] = [];
        if (!s.subjectCode) missing.push('subjectCode');
        if (!s.subjectNames && !s.subjectName) missing.push('subjectNames');
        if (missing.length > 0) {
          result.missingSubjectInfoSlots.push({ day, slot, missing });
        }

        // emit progress after each slot
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
      // give a short pause after all slot checks complete
      await sleep(DELAY_MS);
    } catch (err) {
      console.error('runImportChecks failed', err);
      // Mark all incomplete phases as failed
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

  const onZipReset = useCallback(() => {
    // clear persisted zip and reset state
    localStorage.removeItem('renumeration:zip:dataUrl');
    localStorage.removeItem('renumeration:zip:name');
    localStorage.removeItem('renumeration:roles');
    localStorage.removeItem('renumeration:staffList');
    localStorage.removeItem('renumeration:slotWiseAssignments');
    localStorage.removeItem('renumeration:nonSlotAssignments');
    localStorage.removeItem('renumeration:roleNameToIdMap');
    setZipInstance(null);
    setZipFileName(null);
    setZipTimestamps(null);
    setImportChecks(null);
    setPhase('import');
  }, []);

  // Functions to wrap setRoles and persist to localStorage
  const setRolesAndPersist = (newRoles: RenumerationRoleEntry[]) => {
    setRoles(newRoles);
    try {
      localStorage.setItem('renumeration:roles', JSON.stringify(newRoles));
    } catch (err) {
      console.warn('Failed to persist roles to localStorage', err);
    }
  };

  // Functions to wrap setStaffList and persist to localStorage
  const setStaffListAndPersist = (newList: AdditionalStaff[]) => {
    setStaffList(newList);
    try {
      localStorage.setItem('renumeration:staffList', JSON.stringify(newList));
    } catch (err) {
      console.warn('Failed to persist staffList to localStorage', err);
    }
  };

  // Functions to wrap setSlotAssignments and persist to localStorage
  const setSlotWiseAssignmentsAndPersist = (
    newMap: Record<string, Array<SlotWiseAssignmentEntry>>
  ) => {
    setSlotWiseAssignments(newMap);
    try {
      localStorage.setItem(
        'renumeration:slotWiseAssignments',
        JSON.stringify(newMap)
      );
    } catch (err) {
      console.warn(
        'Failed to persist slotWiseAssignments to localStorage',
        err
      );
    }
  };

  // Functions to wrap nonSlotAssignments and persist to localStorage
  const setNonSlotAssignmentsAndPersist = (
    newMap: Record<string, Array<NonSlotWiseAssignmentEntry>>
  ) => {
    setNonSlotAssignments(newMap);
    try {
      localStorage.setItem(
        'renumeration:nonSlotAssignments',
        JSON.stringify(newMap)
      );
    } catch (err) {
      console.warn('Failed to persist nonSlotAssignments to localStorage', err);
    }
  };

  // restore persisted state from localStorage (roles, staff, assignments)
  function restorePersistedState() {
    try {
      const raw = localStorage.getItem('renumeration:roles');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRoles(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed to restore persisted roles', err);
    }

    try {
      const rawStaff = localStorage.getItem('renumeration:staffList');
      if (rawStaff) {
        const parsedStaff = JSON.parse(rawStaff);
        if (Array.isArray(parsedStaff) && parsedStaff.length > 0) {
          setStaffList(parsedStaff);
        }
      }
    } catch (err) {
      console.warn('Failed to restore persisted staffList', err);
    }

    try {
      const rawNonSlot = localStorage.getItem(
        'renumeration:nonSlotAssignments'
      );
      if (rawNonSlot) {
        const parsedNonSlot = JSON.parse(rawNonSlot);
        if (
          parsedNonSlot &&
          typeof parsedNonSlot === 'object' &&
          Object.keys(parsedNonSlot).length > 0
        ) {
          setNonSlotAssignments(parsedNonSlot);
        }
      }
    } catch (err) {
      console.warn('Failed to restore persisted nonSlotAssignments', err);
    }

    try {
      const rawSlotWise = localStorage.getItem(
        'renumeration:slotWiseAssignments'
      );
      if (rawSlotWise) {
        const parsedSlotWise = JSON.parse(rawSlotWise);
        if (
          parsedSlotWise &&
          typeof parsedSlotWise === 'object' &&
          Object.keys(parsedSlotWise).length > 0
        ) {
          setSlotWiseAssignments(parsedSlotWise);
        }
      }
    } catch (err) {
      console.warn('Failed to restore persisted slotWiseAssignments', err);
    }

    try {
      const rawRoleNameToIdMap = localStorage.getItem(
        'renumeration:roleNameToIdMap'
      );
      if (rawRoleNameToIdMap) {
        const parsedMap = JSON.parse(rawRoleNameToIdMap);
        if (
          parsedMap &&
          typeof parsedMap === 'object' &&
          Object.keys(parsedMap).length > 0
        ) {
          setRoleNameToIdMap(parsedMap);
        }
      }
    } catch (err) {
      console.warn('Failed to restore persisted roleNameToIdMap', err);
    }
  }

  // on mount, try to restore persisted zip from localStorage
  useEffect(() => {
    const dataUrl = localStorage.getItem('renumeration:zip:dataUrl');
    const name = localStorage.getItem('renumeration:zip:name');
    if (!dataUrl) return;
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch(dataUrl);
        const buffer = await resp.arrayBuffer();
        const f = new File([buffer], name || 'attendance.zip', {
          type: 'application/zip',
        });
        const zip = await loadZip(f);
        // Use shared processor to restore state similar to import flow
        await processZip(zip, name || 'attendance.zip');

        // Restore persisted application state (roles, staff, assignments)
        restorePersistedState();
      } catch (err) {
        console.warn('Failed to restore ZIP from storage', err);
      }
      setLoading(false);
    })();
  }, []);

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
      {/* Compact Phase Navigation */}
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
              Continue
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Phase Content */}
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
            setRoles={setRolesAndPersist}
            staffList={staffList}
            setStaffList={setStaffListAndPersist}
          />
        )}
        {phase === 'assign' && (
          <AdditionalAssignmentsPhase
            roles={roles}
            facultyList={facultyList}
            staffList={staffList}
            nonSlotAssignments={nonSlotAssignments}
            setNonSlotAssignments={setNonSlotAssignmentsAndPersist}
            slotWiseAssignments={slotWiseAssignments}
            setSlotWiseAssignments={setSlotWiseAssignmentsAndPersist}
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
