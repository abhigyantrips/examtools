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
  designationBufferCounts?: Record<string, number>;
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
}

// Excel upload helpers
export interface ExcelParseResult<T> {
  data: T[];
  errors: string[];
  warnings: string[];
}
