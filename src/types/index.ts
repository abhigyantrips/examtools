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
  totalDuties: number;
  bufferDuties: number;
  rooms: string[]; // Room numbers
}

export interface ExamStructure {
  days: number;
  slots: number;
  dutySlots: DutySlot[];
  designationDutyCounts: Record<string, number>; // "Assistant Professor" -> 5
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
  isBuffer: boolean;
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