export interface JsonSlot {
  day: number;
  slot: number;
  date: string;
  startTime: string;
  endTime: string;
  subjectCode?: string;
  rooms: string[];
  regularDuties: number;
  relieverDuties: number;
  squadDuties: number;
  bufferDuties: number;
}

export interface JsonFaculty {
  facultyId: string;
  facultyName: string;
  designation: string;
  department: string;
  phoneNo: string;
}

export interface JsonUnavailable {
  facultyId: string;
  date: string;
}

export interface MetadataJson {
  type: string;
  generatedAt: string;
  slots: JsonSlot[];
  designationDutyCounts: Record<string, number>;
  designationRelieverCounts?: Record<string, number>;
  designationSquadCounts?: Record<string, number>;
  designationBufferEligibility?: Record<string, boolean>;
  unavailable: JsonUnavailable[];
  faculty: JsonFaculty[];
}

export interface AssignmentJson {
  day: number;
  slot: number;
  date: string | Date | null;
  time: string | null;
  facultyId: string;
  role: 'regular' | 'reliever' | 'squad' | 'buffer';
  roomNumber: string | null;
  rooms: string[] | null;
}
