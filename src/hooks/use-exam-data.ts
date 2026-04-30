import { toast } from 'sonner';

import { useCallback, useEffect, useState } from 'react';

import type {
  Assignment,
  ExamData,
  ExamStructure,
  Faculty,
  UnavailableFaculty,
} from '@/types';

import {
  importDataFromZip,
  importMetadataFromJsonFile,
  importMetadataFromZipFile,
} from '@/lib/excel';
import {
  getActiveProjectId,
  getExamData,
  putExamData,
} from '@/lib/projects-db';
import { facultyCompare } from '@/lib/utils';

import { notifyProjectsChanged } from './use-projects';

const ACTIVE_EVENT = 'examtools:active-project-changed';
const PROJECTS_EVENT = 'examtools:projects-changed';

const EMPTY_EXAM_DATA: ExamData = {
  faculty: [],
  examStructure: {
    days: 0,
    dutySlots: [],
    designationDutyCounts: {},
  },
  unavailability: [],
  assignments: [],
  lastUpdated: new Date(),
};

/**
 * Project-scoped exam data hook. Loads/saves the assignment-tool ExamData
 * record for the currently active project (or a caller-supplied projectId).
 *
 * If no project is active and none is supplied, all reads return the empty
 * shape and writes are no-ops with a warning. Callers are expected to ensure
 * a project context exists before invoking write APIs (the page-level UI
 * gates this).
 */
export function useExamData(projectIdOverride?: string | null) {
  const [projectId, setProjectId] = useState<string | null>(
    projectIdOverride ?? null
  );
  const [data, setData] = useState<ExamData>(EMPTY_EXAM_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve the project id we should be reading from.
  useEffect(() => {
    if (projectIdOverride !== undefined) {
      setProjectId(projectIdOverride);
      return;
    }
    let cancelled = false;
    (async () => {
      const id = await getActiveProjectId();
      if (!cancelled) setProjectId(id);
    })();
    const onChange = async () => {
      const id = await getActiveProjectId();
      if (!cancelled) setProjectId(id);
    };
    window.addEventListener(ACTIVE_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(ACTIVE_EVENT, onChange);
    };
  }, [projectIdOverride]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!projectId) {
        setData(EMPTY_EXAM_DATA);
        return;
      }
      const stored = await getExamData(projectId);
      setData(stored ?? EMPTY_EXAM_DATA);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // React to writes from elsewhere in the app (e.g. import flows).
  useEffect(() => {
    const onChange = () => loadData();
    window.addEventListener(PROJECTS_EVENT, onChange);
    return () => window.removeEventListener(PROJECTS_EVENT, onChange);
  }, [loadData]);

  const saveData = useCallback(
    async (newData: Partial<ExamData>) => {
      if (!projectId) {
        console.warn('useExamData.saveData called with no active project');
        return;
      }
      try {
        const updatedData: ExamData = {
          ...data,
          ...newData,
          lastUpdated: new Date(),
        };
        await putExamData(projectId, updatedData);
        setData(updatedData);
        notifyProjectsChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save data');
      }
    },
    [projectId, data]
  );

  const updateFaculty = useCallback(
    async (faculty: Faculty[]) => {
      const sorted = [...faculty].sort((a, b) => facultyCompare(a, b));
      const hadAssignments = (data.assignments || []).length > 0;
      await saveData({ faculty: sorted, assignments: [] });
      if (hadAssignments) {
        toast.success(
          'Assignments were reset because the faculty list changed'
        );
      }
    },
    [saveData, data]
  );

  const updateExamStructure = useCallback(
    async (examStructure: ExamStructure) => {
      const hadAssignments = (data.assignments || []).length > 0;
      await saveData({ examStructure, assignments: [] });
      if (hadAssignments) {
        toast.success(
          'Assignments were reset because the exam configuration changed'
        );
      }
    },
    [saveData, data]
  );

  const updateUnavailability = useCallback(
    async (unavailability: UnavailableFaculty[]) => {
      const hadAssignments = (data.assignments || []).length > 0;
      await saveData({ unavailability, assignments: [] });
      if (hadAssignments) {
        toast.success(
          'Assignments were reset because faculty unavailability changed'
        );
      }
    },
    [saveData, data]
  );

  const updateAssignments = useCallback(
    (assignments: Assignment[]) => {
      saveData({ assignments });
    },
    [saveData]
  );

  const clearAllData = useCallback(async () => {
    if (!projectId) return;
    try {
      const hadAssignments = (data.assignments || []).length > 0;
      await putExamData(projectId, EMPTY_EXAM_DATA);
      setData(EMPTY_EXAM_DATA);
      notifyProjectsChanged();
      if (hadAssignments)
        toast('All data cleared; assignments have been reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear data');
    }
  }, [projectId, data]);

  const importData = useCallback(
    async (file: File) => {
      try {
        setLoading(true);
        if (!file.name.toLowerCase().endsWith('.zip')) {
          throw new Error('Only ZIP files are supported for full data import');
        }
        const imported = await importDataFromZip(file);
        const sortedFaculty = [...imported.faculty].sort((a, b) =>
          facultyCompare(a, b)
        );
        await saveData({
          faculty: sortedFaculty,
          examStructure: imported.examStructure,
          unavailability: imported.unavailability,
          assignments: imported.assignments,
        });
        toast.success('Data imported successfully');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import data');
        toast.error(
          err instanceof Error ? err.message : 'Failed to import data'
        );
      } finally {
        setLoading(false);
      }
    },
    [saveData]
  );

  const importMetadata = useCallback(
    async (file: File) => {
      try {
        setLoading(true);
        const isZip = file.name.toLowerCase().endsWith('.zip');
        const imported = isZip
          ? await importMetadataFromZipFile(file)
          : await importMetadataFromJsonFile(file);
        const sortedFaculty = [...imported.faculty].sort((a, b) =>
          facultyCompare(a, b)
        );
        const hadAssignments = (data.assignments || []).length > 0;
        await saveData({
          faculty: sortedFaculty,
          examStructure: imported.examStructure,
          unavailability: imported.unavailability,
          assignments: [],
        });
        if (hadAssignments)
          toast.success('Metadata imported; assignments have been reset');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to import metadata'
        );
      } finally {
        setLoading(false);
      }
    },
    [saveData, data]
  );

  return {
    data,
    projectId,
    loading,
    error,
    updateFaculty,
    updateExamStructure,
    updateUnavailability,
    updateAssignments,
    saveData,
    clearAllData,
    reload: loadData,
    importMetadata,
    importData,
  };
}
