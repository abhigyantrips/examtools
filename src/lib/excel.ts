import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import type { Assignment, DutySlot, ExcelParseResult, Faculty } from '@/types';

// Faculty Excel parsing
export async function parseFacultyExcel(
  file: File
): Promise<ExcelParseResult<Faculty>> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        data: [],
        errors: ['No worksheet found in the Excel file'],
        warnings: [],
      };
    }

    const jsonData: unknown[][] = [];
    worksheet.eachRow((row) => {
      const rowData: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        rowData.push(cell.value);
      });
      jsonData.push(rowData);
    });

    const result = parseFacultyData(jsonData);
    return result;
  } catch (error) {
    return {
      data: [],
      errors: [
        `Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
      warnings: [],
    };
  }
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
export async function parseRoomsExcel(
  file: File
): Promise<ExcelParseResult<string>> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return {
        data: [],
        errors: ['No worksheet found in the Excel file'],
        warnings: [],
      };
    }

    const rooms: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract all non-empty cells as room numbers
    worksheet.eachRow((row, rowIndex) => {
      row.eachCell((cell, colIndex) => {
        if (cell.value && String(cell.value).trim()) {
          const roomNumber = String(cell.value).trim();
          if (!rooms.includes(roomNumber)) {
            rooms.push(roomNumber);
          } else {
            warnings.push(
              `Duplicate room number: ${roomNumber} at row ${rowIndex}, col ${colIndex}`
            );
          }
        }
      });
    });

    return { data: rooms, errors, warnings };
  } catch (error) {
    return {
      data: [],
      errors: [
        `Room Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
      warnings: [],
    };
  }
}

// Export functions
export async function exportAssignmentsOverview(
  dutySlots: DutySlot[],
  assignments: Assignment[],
  faculty: Faculty[]
): Promise<void> {
  const workbook = createOverviewWorkbook(dutySlots, assignments, faculty);
  await downloadWorkbook(workbook, 'exam-duty-overview.xlsx');
}

export async function exportDaySlotAssignments(
  date: Date,
  timeSlot: string,
  assignments: {
    sNo: number;
    roomNumber: string;
    facultyId: string;
    facultyName: string;
    phoneNo: string;
    role: string;
  }[],
  dutySlot?: DutySlot
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  createSlotAssignmentWorksheet(
    workbook,
    date,
    timeSlot,
    assignments,
    dutySlot
  );

  const filename = `duty-${date.toISOString().split('T')[0]}-slot.xlsx`;
  await downloadWorkbook(workbook, filename);
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

  // 1. Create overview workbook and add to ZIP
  const overviewWorkbook = createOverviewWorkbook(
    dutySlots,
    assignments,
    faculty
  );
  const overviewBuffer = await overviewWorkbook.xlsx.writeBuffer();
  zip.file('00-exam-duty-overview.xlsx', overviewBuffer);

  // 2. Create individual slot files and add to ZIP
  for (const dutySlot of dutySlots) {
    const slotAssignments = assignments.filter(
      (a) => a.day === dutySlot.day && a.slot === dutySlot.slot
    );

    // Transform assignments to match the expected format
    const formattedAssignments = slotAssignments.map((assignment, index) => {
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

    const slotWorkbook = new ExcelJS.Workbook();
    const timeSlot = `${dutySlot.startTime} - ${dutySlot.endTime}`;
    createSlotAssignmentWorksheet(
      slotWorkbook,
      dutySlot.date,
      timeSlot,
      formattedAssignments,
      dutySlot
    );

    const buffer = await slotWorkbook.xlsx.writeBuffer();
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

// Helper functions for worksheet creation
function createSlotsWorksheet(
  workbook: ExcelJS.Workbook,
  dutySlots: DutySlot[],
  assignments: Assignment[]
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet('Slots');

  // Add main title (merged across all columns)
  worksheet.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
  worksheet.mergeCells('A1:F1');
  const mainTitleCell = worksheet.getCell('A1');
  mainTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  mainTitleCell.font = { bold: true, size: 14 };

  // Add sheet title (merged across all columns)
  worksheet.addRow(['LIST OF SLOTS']);
  worksheet.mergeCells('A2:F2');
  const sheetTitleCell = worksheet.getCell('A2');
  sheetTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetTitleCell.font = { bold: true, size: 14 };

  // Add empty row
  worksheet.addRow([]);

  // Add headers
  const headerRow = worksheet.addRow([
    'Date',
    'Time Slot',
    'Regular',
    'Reliever',
    'Squad',
    'Buffer',
  ]);
  headerRow.font = { bold: true };

  // Group slots by date for merging
  const dateGroups = new Map<string, typeof dutySlots>();
  dutySlots.forEach((slot) => {
    const dateStr = slot.date.toLocaleDateString();
    if (!dateGroups.has(dateStr)) {
      dateGroups.set(dateStr, []);
    }
    dateGroups.get(dateStr)!.push(slot);
  });

  let currentRow = 5; // Starting row for data (after headers)

  dateGroups.forEach((slots, dateStr) => {
    const startRow = currentRow;

    slots.forEach((slot) => {
      // Count duties by role for this slot
      const slotAssignments = assignments.filter(
        (a) => a.day === slot.day && a.slot === slot.slot
      );

      const regularCount = slotAssignments.filter(
        (a) => a.role === 'regular'
      ).length;
      const relieverCount = slotAssignments.filter(
        (a) => a.role === 'reliever'
      ).length;
      const squadCount = slotAssignments.filter(
        (a) => a.role === 'squad'
      ).length;
      const bufferCount = slotAssignments.filter(
        (a) => a.role === 'buffer'
      ).length;

      worksheet.addRow([
        currentRow === startRow ? dateStr : '', // Only show date on first row of group
        `${slot.startTime} - ${slot.endTime}`,
        regularCount,
        relieverCount,
        squadCount,
        bufferCount,
      ]);
      currentRow++;
    });

    // Merge date cells for this date group if more than one slot
    if (slots.length > 1) {
      worksheet.mergeCells(`A${startRow}:A${currentRow - 1}`);
      const dateCell = worksheet.getCell(`A${startRow}`);
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // Auto-fit columns but set specific widths for better appearance
  autoFitColumns(worksheet);
  worksheet.getColumn(1).width = 15; // Date column
  worksheet.getColumn(2).width = 20; // Time slot column
  worksheet.getColumn(3).width = 10; // Regular column
  worksheet.getColumn(4).width = 10; // Reliever column
  worksheet.getColumn(5).width = 10; // Squad column
  worksheet.getColumn(6).width = 10; // Buffer column

  return worksheet;
}

function createFacultyWorksheet(
  workbook: ExcelJS.Workbook,
  assignments: Assignment[],
  faculty: Faculty[]
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet('Faculty List');

  // Add main title (merged across all columns)
  worksheet.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
  worksheet.mergeCells('A1:F1');
  const mainTitleCell = worksheet.getCell('A1');
  mainTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  mainTitleCell.font = { bold: true, size: 14 };

  // Add sheet title (merged across all columns)
  worksheet.addRow(['FACULTY ASSIGNMENT OVERVIEW']);
  worksheet.mergeCells('A2:F2');
  const sheetTitleCell = worksheet.getCell('A2');
  sheetTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetTitleCell.font = { bold: true, size: 14 };

  // Add empty row
  worksheet.addRow([]);

  // Add headers
  const headerRow = worksheet.addRow([
    'Faculty ID',
    'Faculty Name',
    'Regular',
    'Reliever',
    'Squad',
    'Buffer',
  ]);
  headerRow.font = { bold: true };

  // Count assignments by faculty and role
  const facultyStats = new Map<
    string,
    { regular: number; reliever: number; squad: number; buffer: number }
  >();

  assignments.forEach((assignment) => {
    if (!facultyStats.has(assignment.facultyId)) {
      facultyStats.set(assignment.facultyId, {
        regular: 0,
        reliever: 0,
        squad: 0,
        buffer: 0,
      });
    }
    const stats = facultyStats.get(assignment.facultyId)!;
    stats[assignment.role as keyof typeof stats]++;
  });

  // Add faculty data rows
  faculty.forEach((f) => {
    const stats = facultyStats.get(f.facultyId) || {
      regular: 0,
      reliever: 0,
      squad: 0,
      buffer: 0,
    };
    worksheet.addRow([
      f.facultyId,
      f.facultyName,
      stats.regular,
      stats.reliever,
      stats.squad,
      stats.buffer,
    ]);
  });

  // Auto-fit columns but set specific widths for better appearance
  autoFitColumns(worksheet);
  worksheet.getColumn(1).width = 15; // Faculty ID column
  worksheet.getColumn(2).width = 35; // Faculty Name column
  worksheet.getColumn(3).width = 10; // Regular column
  worksheet.getColumn(4).width = 10; // Reliever column
  worksheet.getColumn(5).width = 10; // Squad column
  worksheet.getColumn(6).width = 10; // Buffer column

  return worksheet;
}

function createOverviewWorkbook(
  dutySlots: DutySlot[],
  assignments: Assignment[],
  faculty: Faculty[]
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  createSlotsWorksheet(workbook, dutySlots, assignments);
  createFacultyWorksheet(workbook, assignments, faculty);
  return workbook;
}

function createSlotAssignmentWorksheet(
  workbook: ExcelJS.Workbook,
  date: Date,
  timeSlot: string,
  assignments: {
    sNo: number;
    roomNumber: string;
    facultyId: string;
    facultyName: string;
    phoneNo: string;
    role: string;
  }[],
  dutySlot?: DutySlot
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet('Assignments');

  // Add title row (merged across 6 columns)
  worksheet.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
  worksheet.mergeCells('A1:F1');
  const titleCell = worksheet.getCell('A1');
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.font = { bold: true, size: 14 };

  // Add date/time row (merged across 6 columns)
  worksheet.addRow([`${date.toLocaleDateString()} ${timeSlot}`]);
  worksheet.mergeCells('A2:F2');
  const dateCell = worksheet.getCell('A2');
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  dateCell.font = { bold: true };

  // Add empty row
  worksheet.addRow([]);

  // Add header row
  const headerRow = worksheet.addRow([
    'S No',
    'Role',
    'Room Number',
    'Faculty ID',
    'Faculty Name',
    'Phone Number',
  ]);
  headerRow.font = { bold: true };

  // Add data rows
  assignments.forEach((assignment, index) => {
    worksheet.addRow([
      index + 1,
      assignment.role.toUpperCase(),
      assignment.roomNumber || getRoleDisplay(assignment.role),
      assignment.facultyId,
      assignment.facultyName,
      assignment.phoneNo,
    ]);
  });

  // Check if slot is incomplete and add warning
  if (dutySlot) {
    const expectedTotal =
      dutySlot.regularDuties +
      (dutySlot.relieverDuties || 0) +
      (dutySlot.squadDuties || 0) +
      dutySlot.bufferDuties;

    if (assignments.length < expectedTotal) {
      worksheet.addRow([]); // Empty row

      const warningRow = worksheet.addRow([
        '⚠️ WARNING: This slot has incomplete assignments. Some duties could not be filled.',
      ]);
      worksheet.mergeCells(`A${warningRow.number}:F${warningRow.number}`);
      const warningCell = worksheet.getCell(`A${warningRow.number}`);
      warningCell.font = { bold: true, color: { argb: 'FFD32F2F' } };
      warningCell.alignment = { horizontal: 'center' };
      warningCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF59D' },
      };

      const detailRow = worksheet.addRow([
        `Assigned: ${assignments.length} / ${expectedTotal} duties`,
      ]);
      worksheet.mergeCells(`A${detailRow.number}:F${detailRow.number}`);
      const detailCell = worksheet.getCell(`A${detailRow.number}`);
      detailCell.alignment = { horizontal: 'center' };
      detailCell.font = { italic: true };
    }
  }

  // Auto-fit columns and set specific column widths for better appearance
  autoFitColumns(worksheet);
  worksheet.getColumn(1).width = 6; // S No column
  worksheet.getColumn(2).width = 12; // Role column
  worksheet.getColumn(3).width = 15; // Room Number column
  worksheet.getColumn(4).width = 12; // Faculty ID column
  worksheet.getColumn(5).width = 25; // Faculty Name column
  worksheet.getColumn(6).width = 15; // Phone Number column

  return worksheet;
}

async function downloadWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function autoFitColumns(worksheet: ExcelJS.Worksheet): void {
  worksheet.columns.forEach((column, index) => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });

    // Special handling for S No column (typically first column)
    if (index === 0 && maxLength <= 4) {
      column.width = 6; // Set a smaller width for S No column
    } else {
      column.width = maxLength < 8 ? 8 : Math.min(maxLength + 2, 50); // Add padding but cap at 50
    }
  });
}
