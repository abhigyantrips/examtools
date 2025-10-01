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
  const workbook = new ExcelJS.Workbook();

  // 1. Create Slots Sheet
  const slotsWorksheet = workbook.addWorksheet('Slots');

  // Add main title (merged across all columns)
  slotsWorksheet.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
  slotsWorksheet.mergeCells('A1:F1');
  const mainTitleCell = slotsWorksheet.getCell('A1');
  mainTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  mainTitleCell.font = { bold: true, size: 14 };

  // Add sheet title (merged across all columns)
  slotsWorksheet.addRow(['LIST OF SLOTS']);
  slotsWorksheet.mergeCells('A2:F2');
  const sheetTitleCell = slotsWorksheet.getCell('A2');
  sheetTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetTitleCell.font = { bold: true, size: 14 };

  // Add empty row
  slotsWorksheet.addRow([]);

  // Add headers
  const headerRow = slotsWorksheet.addRow([
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

      slotsWorksheet.addRow([
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
      slotsWorksheet.mergeCells(`A${startRow}:A${currentRow - 1}`);
      const dateCell = slotsWorksheet.getCell(`A${startRow}`);
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // Auto-fit columns but set specific widths for better appearance
  autoFitColumns(slotsWorksheet);
  slotsWorksheet.getColumn(1).width = 15; // Date column
  slotsWorksheet.getColumn(2).width = 20; // Time slot column
  slotsWorksheet.getColumn(3).width = 10; // Regular column
  slotsWorksheet.getColumn(4).width = 10; // Reliever column
  slotsWorksheet.getColumn(5).width = 10; // Squad column
  slotsWorksheet.getColumn(6).width = 10; // Buffer column

  // 2. Create Faculty List Sheet
  const facultyWorksheet = workbook.addWorksheet('Faculty List');

  // Add main title (merged across all columns)
  facultyWorksheet.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
  facultyWorksheet.mergeCells('A1:F1');
  const facultyMainTitleCell = facultyWorksheet.getCell('A1');
  facultyMainTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  facultyMainTitleCell.font = { bold: true, size: 14 };

  // Add sheet title (merged across all columns)
  facultyWorksheet.addRow(['FACULTY ASSIGNMENT OVERVIEW']);
  facultyWorksheet.mergeCells('A2:F2');
  const facultySheetTitleCell = facultyWorksheet.getCell('A2');
  facultySheetTitleCell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };
  facultySheetTitleCell.font = { bold: true, size: 14 };

  // Add empty row
  facultyWorksheet.addRow([]);

  // Add headers
  const facultyHeaderRow = facultyWorksheet.addRow([
    'Faculty ID',
    'Faculty Name',
    'Regular',
    'Reliever',
    'Squad',
    'Buffer',
  ]);
  facultyHeaderRow.font = { bold: true };

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
    facultyWorksheet.addRow([
      f.facultyId,
      f.facultyName,
      stats.regular,
      stats.reliever,
      stats.squad,
      stats.buffer,
    ]);
  });

  // Auto-fit columns but set specific widths for better appearance
  autoFitColumns(facultyWorksheet);
  facultyWorksheet.getColumn(1).width = 15; // Faculty ID column
  facultyWorksheet.getColumn(2).width = 35; // Faculty Name column
  facultyWorksheet.getColumn(3).width = 10; // Regular column
  facultyWorksheet.getColumn(4).width = 10; // Reliever column
  facultyWorksheet.getColumn(5).width = 10; // Squad column
  facultyWorksheet.getColumn(6).width = 10; // Buffer column

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'exam-duty-overview.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
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
  }[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
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

  // Auto-fit columns
  autoFitColumns(worksheet);

  // Set specific column widths for better appearance
  worksheet.getColumn(1).width = 6; // S No column
  worksheet.getColumn(2).width = 12; // Role column
  worksheet.getColumn(3).width = 15; // Room Number column
  worksheet.getColumn(4).width = 12; // Faculty ID column
  worksheet.getColumn(5).width = 25; // Faculty Name column
  worksheet.getColumn(6).width = 15; // Phone Number column

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const filename = `duty-${date.toISOString().split('T')[0]}-slot.xlsx`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
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

  // 1. Create overview workbook with multiple sheets and add to ZIP
  const overviewWorkbook = new ExcelJS.Workbook();

  // Create Slots Sheet
  const slotsWorksheet = overviewWorkbook.addWorksheet('Slots');

  // Add main title (merged across all columns)
  slotsWorksheet.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
  slotsWorksheet.mergeCells('A1:F1');
  const mainTitleCell = slotsWorksheet.getCell('A1');
  mainTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  mainTitleCell.font = { bold: true, size: 14 };

  // Add sheet title (merged across all columns)
  slotsWorksheet.addRow(['LIST OF SLOTS']);
  slotsWorksheet.mergeCells('A2:F2');
  const sheetTitleCell = slotsWorksheet.getCell('A2');
  sheetTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetTitleCell.font = { bold: true, size: 14 };

  // Add empty row
  slotsWorksheet.addRow([]);

  // Add headers
  const headerRow = slotsWorksheet.addRow([
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

      slotsWorksheet.addRow([
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
      slotsWorksheet.mergeCells(`A${startRow}:A${currentRow - 1}`);
      const dateCell = slotsWorksheet.getCell(`A${startRow}`);
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // Auto-fit columns but set specific widths for better appearance
  autoFitColumns(slotsWorksheet);
  slotsWorksheet.getColumn(1).width = 15; // Date column
  slotsWorksheet.getColumn(2).width = 20; // Time slot column
  slotsWorksheet.getColumn(3).width = 10; // Regular column
  slotsWorksheet.getColumn(4).width = 10; // Reliever column
  slotsWorksheet.getColumn(5).width = 10; // Squad column
  slotsWorksheet.getColumn(6).width = 10; // Buffer column

  // Create Faculty List Sheet
  const facultyWorksheet = overviewWorkbook.addWorksheet('Faculty List');

  // Add main title (merged across all columns)
  facultyWorksheet.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
  facultyWorksheet.mergeCells('A1:F1');
  const facultyMainTitleCell = facultyWorksheet.getCell('A1');
  facultyMainTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  facultyMainTitleCell.font = { bold: true, size: 14 };

  // Add sheet title (merged across all columns)
  facultyWorksheet.addRow(['FACULTY ASSIGNMENT OVERVIEW']);
  facultyWorksheet.mergeCells('A2:F2');
  const facultySheetTitleCell = facultyWorksheet.getCell('A2');
  facultySheetTitleCell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };
  facultySheetTitleCell.font = { bold: true, size: 14 };

  // Add empty row
  facultyWorksheet.addRow([]);

  // Add headers
  const facultyHeaderRow = facultyWorksheet.addRow([
    'Faculty ID',
    'Faculty Name',
    'Regular',
    'Reliever',
    'Squad',
    'Buffer',
  ]);
  facultyHeaderRow.font = { bold: true };

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
    facultyWorksheet.addRow([
      f.facultyId,
      f.facultyName,
      stats.regular,
      stats.reliever,
      stats.squad,
      stats.buffer,
    ]);
  });

  // Auto-fit columns but set specific widths for better appearance
  autoFitColumns(facultyWorksheet);
  facultyWorksheet.getColumn(1).width = 15; // Faculty ID column
  facultyWorksheet.getColumn(2).width = 35; // Faculty Name column
  facultyWorksheet.getColumn(3).width = 10; // Regular column
  facultyWorksheet.getColumn(4).width = 10; // Reliever column
  facultyWorksheet.getColumn(5).width = 10; // Squad column
  facultyWorksheet.getColumn(6).width = 10; // Buffer column

  const overviewBuffer = await overviewWorkbook.xlsx.writeBuffer();
  zip.file('00-exam-duty-overview.xlsx', overviewBuffer);

  // 2. Create individual slot files and add to ZIP
  for (const dutySlot of dutySlots) {
    const slotAssignments = assignments.filter(
      (a) => a.day === dutySlot.day && a.slot === dutySlot.slot
    );

    const slotWorkbook = new ExcelJS.Workbook();
    const worksheet = slotWorkbook.addWorksheet('Assignments');

    // Add title row (merged across 6 columns)
    worksheet.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.font = { bold: true, size: 14 };

    // Add date/time row (merged across 6 columns)
    worksheet.addRow([
      `${dutySlot.date.toLocaleDateString()} ${dutySlot.startTime} - ${dutySlot.endTime}`,
    ]);
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
    slotAssignments.forEach((assignment, index) => {
      const assignedFaculty = faculty.find(
        (f) => f.facultyId === assignment.facultyId
      );
      worksheet.addRow([
        index + 1,
        assignment.role.toUpperCase(),
        assignment.roomNumber || 'BUFFER',
        assignment.facultyId,
        assignedFaculty?.facultyName || 'Unknown',
        assignedFaculty?.phoneNo || 'N/A',
      ]);
    });

    // Auto-fit columns
    autoFitColumns(worksheet);

    // Set specific column widths for better appearance
    worksheet.getColumn(1).width = 6; // S No column
    worksheet.getColumn(2).width = 12; // Role column
    worksheet.getColumn(3).width = 15; // Room Number column
    worksheet.getColumn(4).width = 12; // Faculty ID column
    worksheet.getColumn(5).width = 25; // Faculty Name column
    worksheet.getColumn(6).width = 15; // Phone Number column

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
