import type {
  AdditionalStaff,
  ExamData,
  NonSlotWiseAssignmentEntry,
  RenumerationRoleEntry,
  SlotAttendance,
  SlotWiseAssignmentEntry,
} from './index';

export type SemesterParity = 'even' | 'odd';

export interface Project {
  id: string;
  slug: string;
  title: string;
  semesterParity: SemesterParity;
  notes: string;
  // Drafts are auto-created when a user imports a ZIP without explicitly
  // selecting/creating a project. They are promoted to a real project on
  // explicit save, or discarded.
  isDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectAttendanceData {
  // key format: `d{day}-s{slot}` (matches existing convention in lib/renumeration.ts)
  slots: Record<string, SlotAttendance>;
  updatedAt: Date;
}

export interface ProjectRenumerationData {
  roles: RenumerationRoleEntry[];
  staffList: AdditionalStaff[];
  slotWiseAssignments: Record<string, SlotWiseAssignmentEntry[]>;
  nonSlotAssignments: Record<string, NonSlotWiseAssignmentEntry[]>;
  roleNameToIdMap: Record<string, string>;
  updatedAt: Date;
}

export interface ProjectBundle {
  project: Project;
  examData: ExamData | null;
  attendance: ProjectAttendanceData | null;
  renumeration: ProjectRenumerationData | null;
}
