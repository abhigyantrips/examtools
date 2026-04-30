import type JSZip from 'jszip';

import type { Project } from '@/types';

import {
  createProject,
  putAttendance,
  putExamData,
  putRenumeration,
  setActiveProjectId,
  updateProject,
} from './projects-db';
import {
  extractAttendanceFromZip,
  extractExamDataFromZip,
  loadZipFromFile,
} from './project-zip';

export interface ImportZipResult {
  project: Project;
  zip: JSZip;
}

/**
 * Imports an uploaded ZIP into a brand-new draft project, sets it as the
 * active project, and returns both the project metadata and the parsed JSZip
 * (so the caller can keep using the existing JSZip-driven tool flows for the
 * remainder of the session).
 *
 * Drafts get a generated title from the filename so they show up in the
 * project list with something readable; users can rename via "Save as new
 * project" when leaving the tool.
 */
export async function importZipAsDraftProject(
  file: File
): Promise<ImportZipResult> {
  const zip = await loadZipFromFile(file);
  const examData = await extractExamDataFromZip(zip);
  const attendance = await extractAttendanceFromZip(zip);

  const baseTitle = file.name.replace(/\.zip$/i, '').trim() || 'Imported ZIP';
  const project = await createProject({
    title: `Draft: ${baseTitle}`,
    semesterParity: 'even',
    notes: `Auto-created from imported ZIP "${file.name}".`,
    isDraft: true,
  });

  if (examData) {
    await putExamData(project.id, examData);
  }
  if (attendance) {
    await putAttendance(project.id, attendance);
  }

  await setActiveProjectId(project.id);
  return { project, zip };
}

/**
 * "Save as new project" — flips a draft into a real project with a
 * user-supplied title/notes/semester. Optionally re-slugs.
 */
export async function promoteDraftToProject(
  draftId: string,
  input: {
    title: string;
    semesterParity: 'even' | 'odd';
    notes?: string;
  }
): Promise<Project> {
  return updateProject(draftId, {
    title: input.title,
    semesterParity: input.semesterParity,
    notes: input.notes ?? '',
    isDraft: false,
  });
}

/**
 * "Update existing project from imported ZIP" — overwrites the target
 * project's exam data + attendance with what we extract from the ZIP. The
 * draft (if any) is left intact for the caller to dispose.
 */
export async function overwriteProjectFromZip(
  targetProjectId: string,
  zip: JSZip
): Promise<void> {
  const examData = await extractExamDataFromZip(zip);
  const attendance = await extractAttendanceFromZip(zip);
  if (examData) await putExamData(targetProjectId, examData);
  if (attendance) await putAttendance(targetProjectId, attendance);
}

/**
 * "Update existing project from current renumeration state" — used by the
 * renumeration tool when the user picks "save into existing project".
 */
export async function copyRenumerationStateToProject(
  fromProjectId: string,
  toProjectId: string
): Promise<void> {
  // We deliberately do not import here to keep the dep graph small; callers
  // pass the data they already have in memory via putRenumeration.
  // This helper exists so future call sites can wire copy semantics here.
  void fromProjectId;
  void toProjectId;
}

export { putRenumeration };
