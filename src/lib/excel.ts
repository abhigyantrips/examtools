import JSZip from 'jszip';
import * as XLSX from 'xlsx';

import type { Assignment, DutySlot, ExcelParseResult, Faculty } from '@/types';

// Faculty Excel parsing
export function parseFacultyExcel(
  file: File
): Promise<ExcelParseResult<Faculty>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
        }) as unknown[][];

        const result = parseFacultyData(jsonData);
        resolve(result);
      } catch (error) {
        resolve({
          data: [],
          errors: [
            `Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ],
          warnings: [],
        });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function parseFacultyData(rows: unknown[][]): ExcelParseResult<Faculty> {
  const faculty: Faculty[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rows.length < 2) {
    errors.push('Excel file must contain header and at least one data row');
    return { data: faculty, errors, warnings };
  }

  // Expected headers (case-insensitive)
  const expectedHeaders = [
    'sno',
    'facultyname',
    'facultyid',
    'designation',
    'department',
    'phoneno',
  ];
  const headerRow = rows[0] as string[];
  const headerMap: Record<string, number> = {};

  // Map headers to column indices
  headerRow.forEach((header, index) => {
    const normalizedHeader = header
      ?.toString()
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    const expectedIndex = expectedHeaders.findIndex(
      (h) => h === normalizedHeader
    );
    if (expectedIndex !== -1) {
      headerMap[expectedHeaders[expectedIndex]] = index;
    }
  });

  // Check for missing required headers
  const missingHeaders = expectedHeaders.filter((h) => !(h in headerMap));
  if (missingHeaders.length > 0) {
    errors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
    return { data: faculty, errors, warnings };
  }

  // Parse data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];

    // Skip empty rows
    if (!row || row.every((cell) => !cell || cell === '')) continue;

    try {
      const facultyMember: Faculty = {
        sNo: Number(row[headerMap.sno]) || 0,
        facultyName: String(row[headerMap.facultyname] || '').trim(),
        facultyId: String(row[headerMap.facultyid] || '').trim(),
        designation: String(row[headerMap.designation] || '').trim(),
        department: String(row[headerMap.department] || '').trim(),
        phoneNo: String(row[headerMap.phoneno] || '').trim(),
      };

      // Validate required fields
      if (!facultyMember.facultyId) {
        warnings.push(`Row ${i + 1}: Missing faculty ID`);
        continue;
      }
      if (!facultyMember.facultyName) {
        warnings.push(`Row ${i + 1}: Missing faculty name`);
        continue;
      }
      if (!facultyMember.designation) {
        warnings.push(`Row ${i + 1}: Missing designation`);
        continue;
      }

      // Check for duplicates
      if (faculty.some((f) => f.facultyId === facultyMember.facultyId)) {
        warnings.push(
          `Row ${i + 1}: Duplicate faculty ID ${facultyMember.facultyId}`
        );
        continue;
      }

      faculty.push(facultyMember);
    } catch (error) {
      warnings.push(
        `Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`
      );
    }
  }

  return { data: faculty, errors, warnings };
}

// Room numbers Excel parsing
export function parseRoomsExcel(file: File): Promise<ExcelParseResult<string>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
        }) as unknown[][];

        const rooms: string[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        // Extract all non-empty cells as room numbers
        jsonData.forEach((row, rowIndex) => {
          row.forEach((cell, colIndex) => {
            if (cell && String(cell).trim()) {
              const roomNumber = String(cell).trim();
              if (!rooms.includes(roomNumber)) {
                rooms.push(roomNumber);
              } else {
                warnings.push(
                  `Duplicate room number: ${roomNumber} at row ${rowIndex + 1}, col ${colIndex + 1}`
                );
              }
            }
          });
        });

        resolve({ data: rooms, errors, warnings });
      } catch (error) {
        resolve({
          data: [],
          errors: [
            `Room Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ],
          warnings: [],
        });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// Export functions
export function exportAssignmentsOverview(
  dutySlots: {
    date: Date;
    startTime: string;
    endTime: string;
    regularDuties: number;
    bufferDuties: number;
  }[]
): void {
  const data = [
    ['Date', 'Time Slot', 'Regular Duties', 'Buffer Duties'],
    ...dutySlots.map((slot) => [
      slot.date.toLocaleDateString(),
      `${slot.startTime} - ${slot.endTime}`,
      slot.regularDuties.toString(),
      slot.bufferDuties.toString(),
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Overview');

  XLSX.writeFile(workbook, 'exam-duty-overview.xlsx');
}

export function exportDaySlotAssignments(
  date: Date,
  timeSlot: string,
  assignments: {
    sNo: number;
    roomNumber: string;
    facultyId: string;
    facultyName: string;
    phoneNo: string;
    role: string;
  }[]
): void {
  const data = [
    ['DATE AND TIME SLOT'],
    [`${date.toLocaleDateString()} ${timeSlot}`],
    [],
    [
      'S No',
      'Role',
      'Room Number',
      'Faculty ID',
      'Faculty Name',
      'Phone Number',
    ],
    ...assignments.map((assignment, index) => [
      (index + 1).toString(),
      assignment.role.toUpperCase(),
      assignment.roomNumber || getRoleDisplay(assignment.role),
      assignment.facultyId,
      assignment.facultyName,
      assignment.phoneNo,
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assignments');

  const filename = `duty-${date.toISOString().split('T')[0]}-slot.xlsx`;
  XLSX.writeFile(workbook, filename);
}

function getRoleDisplay(role: string): string {
  switch (role) {
    case 'regular':
      return 'ROOM';
    case 'reliever':
      return 'RELIEVER';
    case 'squad':
      return 'SQUAD';
    case 'buffer':
      return 'BUFFER';
    default:
      return 'UNKNOWN';
  }
}

export async function exportBatchAssignments(
  dutySlots: DutySlot[],
  assignments: Assignment[],
  faculty: Faculty[]
): Promise<void> {
  const zip = new JSZip();

  // 1. Create overview data and add to ZIP
  const overviewData = dutySlots.map((slot) => ({
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    totalDuties: slot.regularDuties + slot.bufferDuties,
    bufferDuties: slot.bufferDuties,
  }));

  const overviewWorksheet = XLSX.utils.aoa_to_sheet([
    ['Date', 'Time Slot', 'Total Duties', 'Buffer Duties'],
    ...overviewData.map((slot) => [
      slot.date.toLocaleDateString(),
      `${slot.startTime} - ${slot.endTime}`,
      slot.totalDuties.toString(),
      slot.bufferDuties.toString(),
    ]),
  ]);

  const overviewWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(overviewWorkbook, overviewWorksheet, 'Overview');
  const overviewBuffer = XLSX.write(overviewWorkbook, {
    type: 'array',
    bookType: 'xlsx',
  });
  zip.file('00-exam-duty-overview.xlsx', overviewBuffer);

  // 2. Create individual slot files and add to ZIP
  for (const dutySlot of dutySlots) {
    const slotAssignments = assignments.filter(
      (a) => a.day === dutySlot.day && a.slot === dutySlot.slot
    );

    const exportData = slotAssignments.map((assignment, index) => {
      const assignedFaculty = faculty.find(
        (f) => f.facultyId === assignment.facultyId
      );
      return {
        sNo: index + 1,
        roomNumber: assignment.roomNumber || 'BUFFER',
        facultyId: assignment.facultyId,
        facultyName: assignedFaculty?.facultyName || 'Unknown',
        phoneNo: assignedFaculty?.phoneNo || 'N/A',
        role: assignment.role,
      };
    });

    const data = [
      ['DATE AND TIME SLOT'],
      [
        `${dutySlot.date.toLocaleDateString()} ${dutySlot.startTime} - ${dutySlot.endTime}`,
      ],
      [],
      [
        'S No',
        'Role',
        'Room Number',
        'Faculty ID',
        'Faculty Name',
        'Phone Number',
      ],
      ...exportData.map((assignment) => [
        assignment.sNo.toString(),
        assignment.role.toUpperCase(),
        assignment.roomNumber,
        assignment.facultyId,
        assignment.facultyName,
        assignment.phoneNo,
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assignments');

    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const filename = `${String(dutySlot.day + 1).padStart(2, '0')}-${String(dutySlot.slot + 1).padStart(2, '0')}-day${dutySlot.day + 1}-slot${dutySlot.slot + 1}-${dutySlot.date.toISOString().split('T')[0]}.xlsx`;

    zip.file(filename, buffer);
  }

  // 3. Generate and download ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `exam-duty-assignments-${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
