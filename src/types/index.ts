export * from './excel';
export * from './json';

export interface Faculty {
  sNo: number;
  facultyName: string;
  facultyId: string;
  designation: string;
  department: string;
  phoneNo: string;
}

export interface DutySlot {
  day: number; // 0-indexed
  slot: number; // 0-indexed
  date: Date;
  startTime: string; // "2:00 PM"
  endTime: string; // "4:00 PM"
  subjectCode?: string;
  subjectNames?: string;
  regularDuties: number;
  relieverDuties: number;
  squadDuties: number;
  bufferDuties: number;
  rooms: string[]; // Room numbers
  // totalDuties is implied: regularDuties + bufferDuties
}

export interface ExamStructure {
  days: number;
  dutySlots: DutySlot[];
  designationDutyCounts: Record<string, number>;
  designationRelieverCounts?: Record<string, number>;
  designationSquadCounts?: Record<string, number>;
  designationBufferEligibility?: Record<string, boolean>;
}

export interface UnavailableFaculty {
  facultyId: string;
  date: string; // ISO date string
}

export interface Assignment {
  day: number;
  slot: number;
  facultyId: string;
  roomNumber?: string; // undefined for buffer duties
  role: 'regular' | 'reliever' | 'squad' | 'buffer';
  // For reliever/squad, the set of rooms this faculty covers in this slot
  rooms?: string[];
}

export interface Violation {
  id:
    | 'ROOM_MISMATCH'
    | 'NO_ELIGIBLE_BUFFER'
    | 'NO_ELIGIBLE_RELIEVER'
    | 'NO_ELIGIBLE_SQUAD'
    | 'BACK_TO_BACK'
    | 'SLOT_UNIQUENESS'
    | 'BUFFER_LIMIT';
  message: string;
  day: number;
  slot: number;
  facultyIds?: string[];
  role?: 'regular' | 'reliever' | 'squad' | 'buffer';
}

export interface FacultyDutyOverview {
  facultyId: string;
  facultyName: string;
  designation: string;
  totals: {
    regular: number;
    reliever: number;
    squad: number;
    buffer: number;
    total: number;
  };
  // coverage map: key like "d{day}-s{slot}"
  coverage?: Record<string, string[]>; // rooms for reliever/squad per slot
}

export interface ExamData {
  faculty: Faculty[];
  examStructure: ExamStructure;
  unavailability: UnavailableFaculty[];
  assignments: Assignment[];
  lastUpdated: Date;
}

export interface AssignmentResult {
  success: boolean;
  assignments: Assignment[];
  errors: string[];
  warnings: string[];
  incompleteSlots?: Array<{
    day: number;
    slot: number;
    regular: { needed: number; assigned: number };
    reliever: { needed: number; assigned: number };
    squad: { needed: number; assigned: number };
    buffer: { needed: number; assigned: number };
  }>;
  violations: Violation[];
  dutyOverview: FacultyDutyOverview[];
}

// Excel upload helpers
// ExcelParseResult moved to ./excel.ts

export type ToolType = 'assignment' | 'attendance' | 'renumeration';

export interface ExportMetadata {
  type: ToolType;
  generatedAt: string;
}
// Attendance export formats
export interface AttendanceEntry {
  facultyId: string;
  role: 'regular' | 'reliever' | 'squad' | 'buffer' | 'attendance-override';
  status: 'present' | 'absent' | 'replacement';
  replacementFrom?: string | null; // facultyId of replacement
}

export interface SlotAttendance {
  day: number;
  slot: number;
  date: string; // ISO string
  time?: string;
  entries: AttendanceEntry[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
