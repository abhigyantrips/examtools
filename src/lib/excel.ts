import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import type {
  Assignment,
  DutySlot,
  ExamStructure,
  ExcelParseResult,
  Faculty,
  UnavailableFaculty,
} from '@/types';

import { facultyCompare } from '@/lib/utils';

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

  // Sort on intake for deterministic order across the system
  const sorted = [...faculty].sort((a, b) => facultyCompare(a, b));
  return { data: sorted, errors, warnings };
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
  // Add consolidated faculty overview with merged rows per duty
  createFacultyOverviewSheet(workbook, dutySlots, assignments, faculty);
  await downloadWorkbook(workbook, 'exam-duty-overview.xlsx');
}

export async function exportDaySlotAssignments(
  dutySlot: DutySlot,
  assignments: Assignment[],
  faculty: Faculty[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const timeSlot = `${dutySlot.startTime} - ${dutySlot.endTime}`;
  // Build the sheets
  createRegularSheet(workbook, dutySlot, assignments, faculty, timeSlot, true);
  createRelieverOrSquadSheet(
    workbook,
    dutySlot,
    assignments,
    faculty,
    timeSlot,
    'reliever'
  );
  createRelieverOrSquadSheet(
    workbook,
    dutySlot,
    assignments,
    faculty,
    timeSlot,
    'squad'
  );

  const filename = `day${dutySlot.day + 1}-slot${dutySlot.slot + 1}-${
    dutySlot.date.toISOString().split('T')[0]
  }.xlsx`;
  await downloadWorkbook(workbook, filename);
}

export async function exportSignatureSheet(
  dutySlots: DutySlot[],
  assignments: Assignment[],
  faculty: Faculty[]
): Promise<void> {
  // Create workbook and sheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Signature Sheet');

  // Add title row (merged across 6 columns)
  worksheet.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
  worksheet.mergeCells('A1:F1');
  const titleCell = worksheet.getCell('A1');
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.font = { bold: true, size: 14 };
  applyBorders(titleCell);

  // Sort slots by day and then slot
  const sortedSlots = [...dutySlots].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.slot - b.slot;
  });

  for (const slot of sortedSlots) {
    // Add empty row
    worksheet.addRow([]);
    // Add date/time row (merged across 6 columns)
    worksheet.addRow([
      `${slot.date.toLocaleDateString()} ${slot.startTime} - ${slot.endTime}`,
    ]);
    worksheet.mergeCells(`A${worksheet.rowCount}:F${worksheet.rowCount}`);
    const dateCell = worksheet.getCell(`A${worksheet.rowCount}`);
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dateCell.font = { bold: true };
    applyBorders(dateCell);
    // Add Heading row
    const headerRow = worksheet.addRow([
      'S No',
      'Faculty ID',
      'Faculty Name',
      'Role',
      'Location',
      'Signature',
    ]);
    // Format header row
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      applyBorders(cell);
      applyPadding(cell);
    });

    // Get assignments for this slot
    const slotAssignments = assignments.filter(
      (a) => a.day === slot.day && a.slot === slot.slot
    );

    // Add data
    const facById = new Map(faculty.map((f) => [f.facultyId, f]));
    let sNo = 1;
    for (const a of slotAssignments) {
      const f = facById.get(a.facultyId);
      const row = worksheet.addRow([
        sNo++,
        a.facultyId,
        f?.facultyName || 'Unknown',
        getRoleDisplay(a.role),
        a.role === 'regular' ? a.roomNumber || '' : '',
        '', // Signature column left blank
      ]);
      row.eachCell((cell) => {
        applyBorders(cell);
        applyPadding(cell);
      });
    }
  }

  // Fit Columns
  worksheet.getColumn(1).width = 8; // S No
  worksheet.getColumn(2).width = 16; // Faculty ID
  worksheet.getColumn(3).width = 30; // Faculty Name
  worksheet.getColumn(4).width = 10; // Role
  worksheet.getColumn(5).width = 10; // Location
  worksheet.getColumn(6).width = 16; // Signature

  // Set row heights starting from header row
  setRowHeights(worksheet, 3);
  // Download
  await downloadWorkbook(workbook, 'exam-duty-signature-sheet.xlsx');
}

// Helper functions for multi-sheet export
function headerBlock(ws: ExcelJS.Worksheet, subtitle: string) {
  ws.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
  ws.mergeCells('A1:F1');
  const titleCell = ws.getCell('A1');
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.font = { bold: true, size: 14 };
  applyBorders(titleCell);

  ws.addRow([subtitle]);
  ws.mergeCells('A2:F2');
  const subCell = ws.getCell('A2');
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.font = { bold: true };
  applyBorders(subCell);

  ws.addRow([]);
}

function applyBorders(
  cell: ExcelJS.Cell,
  style: 'thin' | 'medium' | 'thick' = 'thin'
) {
  cell.border = {
    top: { style },
    left: { style },
    bottom: { style },
    right: { style },
  };
}

function applyPadding(cell: ExcelJS.Cell) {
  if (!cell.alignment) {
    cell.alignment = {};
  }
  cell.alignment = {
    ...cell.alignment,
    vertical: 'middle',
    indent: 1,
    wrapText: false,
  };
}

function createRegularSheet(
  workbook: ExcelJS.Workbook,
  slot: DutySlot,
  allAssignments: Assignment[],
  faculty: Faculty[],
  timeSlot: string,
  appendBuffer?: boolean
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet('Regular');
  headerBlock(ws, `${slot.date.toLocaleDateString()} ${timeSlot}`);

  const headerRow = ws.addRow([
    'S No',
    'Role',
    'Room Number',
    'Faculty ID',
    'Faculty Name',
    'Phone Number',
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    applyBorders(cell);
    applyPadding(cell);
  });

  const regs = allAssignments
    .filter(
      (a) => a.day === slot.day && a.slot === slot.slot && a.role === 'regular'
    )
    .sort((a, b) => (a.roomNumber || '').localeCompare(b.roomNumber || ''));

  const facById = new Map(faculty.map((f) => [f.facultyId, f]));
  const rows: Array<[number, string, string, string, string, string]> = [];

  let sNo = 1;
  for (const a of regs) {
    const f = facById.get(a.facultyId);
    rows.push([
      sNo++,
      'REGULAR',
      a.roomNumber || '',
      a.facultyId,
      f?.facultyName || 'Unknown',
      f?.phoneNo || 'N/A',
    ]);
  }

  const missing = Math.max(0, slot.regularDuties - regs.length);
  for (let i = 0; i < missing; i++) {
    rows.push([sNo++, 'REGULAR', '', '', '', '']);
  }

  // Append buffer duties if requested
  if (appendBuffer) {
    const bufs = allAssignments.filter(
      (a) => a.day === slot.day && a.slot === slot.slot && a.role === 'buffer'
    );
    // Sort buffers by designation → name
    const bufsSorted = [...bufs].sort((a, b) =>
      facultyCompare(facById.get(a.facultyId), facById.get(b.facultyId))
    );
    for (const a of bufsSorted) {
      const f = facById.get(a.facultyId);
      rows.push([
        sNo++,
        'BUFFER',
        '',
        a.facultyId,
        f?.facultyName || 'Unknown',
        f?.phoneNo || 'N/A',
      ]);
    }
    const missingBuf = Math.max(0, slot.bufferDuties - bufs.length);
    for (let i = 0; i < missingBuf; i++) {
      rows.push([sNo++, 'BUFFER', '', '', '', '']);
    }
  }

  for (const r of rows) {
    const row = ws.addRow(r);
    row.eachCell((cell) => {
      applyBorders(cell);
      applyPadding(cell);
    });
  }

  highlightEmptyRows(ws, 4);
  autoFitColumns(ws);
  setWidths(ws);
  setRowHeights(ws, 4);
  return ws;
}

function createRelieverOrSquadSheet(
  workbook: ExcelJS.Workbook,
  slot: DutySlot,
  allAssignments: Assignment[],
  faculty: Faculty[],
  timeSlot: string,
  role: 'reliever' | 'squad'
): ExcelJS.Worksheet {
  const name = role === 'reliever' ? 'Reliever' : 'Squad';
  const ws = workbook.addWorksheet(name);
  headerBlock(ws, `${slot.date.toLocaleDateString()} ${timeSlot}`);

  const headerRow = ws.addRow([
    'S No',
    'Role',
    'Room Number',
    'Faculty ID',
    'Faculty Name',
    'Phone Number',
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    applyBorders(cell);
    applyPadding(cell);
  });

  const facById = new Map(faculty.map((f) => [f.facultyId, f]));

  const asg = allAssignments
    .filter(
      (a) => a.day === slot.day && a.slot === slot.slot && a.role === role
    )
    .map((a) => ({
      ...a,
      rooms: [...(a.rooms || [])].sort((x, y) => x.localeCompare(y)),
    }));
  // Sort blocks by designation → name (keep empties after assigned blocks)
  asg.sort((a, b) =>
    facultyCompare(facById.get(a.facultyId), facById.get(b.facultyId))
  );

  const needed =
    role === 'reliever' ? slot.relieverDuties || 0 : slot.squadDuties || 0;
  const empties = Math.max(0, needed - asg.length);
  const groups = [
    ...asg,
    ...Array.from({ length: empties }, () => ({ rooms: [] as string[] })),
  ];

  let sNo = 1;

  for (const grp of groups) {
    const isAssigned = 'facultyId' in grp && !!grp.facultyId;
    const rooms = (grp.rooms || []) as string[];
    const minRows = Math.max(1, rooms.length);
    const startRow = ws.rowCount + 1;

    if (minRows === 0) {
      const row = ws.addRow([sNo++, name.toUpperCase(), '', '', '', '']);
      row.eachCell((cell) => {
        applyBorders(cell);
        applyPadding(cell);
      });
    } else {
      for (let i = 0; i < minRows; i++) {
        const room = rooms[i] || '';
        if (i === 0) {
          const f = isAssigned
            ? facById.get((grp as Assignment).facultyId)
            : undefined;
          const row = ws.addRow([
            sNo,
            name.toUpperCase(),
            room,
            isAssigned ? (grp as Assignment).facultyId : '',
            isAssigned ? f?.facultyName || 'Unknown' : '',
            isAssigned ? f?.phoneNo || 'N/A' : '',
          ]);
          row.eachCell((cell) => {
            applyBorders(cell);
            applyPadding(cell);
          });
        } else {
          const row = ws.addRow(['', name.toUpperCase(), room, '', '', '']);
          row.eachCell((cell) => {
            applyBorders(cell);
            applyPadding(cell);
          });
        }
      }
      sNo++;
    }

    const endRow = ws.rowCount;
    if (endRow > startRow) {
      ws.mergeCells(startRow, 1, endRow, 1);
      ws.mergeCells(startRow, 4, endRow, 4);
      ws.mergeCells(startRow, 5, endRow, 5);
      ws.mergeCells(startRow, 6, endRow, 6);

      const mergedCells = [
        ws.getCell(startRow, 1),
        ws.getCell(startRow, 4),
        ws.getCell(startRow, 5),
        ws.getCell(startRow, 6),
      ];

      mergedCells.forEach((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        applyBorders(cell);
      });
    }
  }

  highlightEmptyRows(ws, 4);
  autoFitColumns(ws);
  setWidths(ws);
  setRowHeights(ws, 4);
  return ws;
}

function highlightEmptyRows(ws: ExcelJS.Worksheet, facultyIdCol: number) {
  const headerRow = 4;
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const idCell = ws.getCell(r, facultyIdCol);
    if (!idCell.value) {
      for (let c = 1; c <= 6; c++) {
        const cell = ws.getCell(r, c);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEBEE' },
        };
      }
    }
  }
}

function setWidths(ws: ExcelJS.Worksheet) {
  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;
  ws.getColumn(5).width = 30;
  ws.getColumn(6).width = 16;
}

function setRowHeights(ws: ExcelJS.Worksheet, startRow: number) {
  for (let r = startRow; r <= ws.rowCount; r++) {
    ws.getRow(r).height = 20;
  }
}

function createFacultyOverviewSheet(
  workbook: ExcelJS.Workbook,
  dutySlots: DutySlot[],
  assignments: Assignment[],
  faculty: Faculty[]
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet('Faculty Datesheet');

  // Title
  ws.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
  ws.mergeCells('A1:I1');
  const titleCell = ws.getCell('A1');
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.font = { bold: true, size: 14 };
  applyBorders(titleCell);

  ws.addRow(['CONSOLIDATED FACULTY DUTY DATESHEET']);
  ws.mergeCells('A2:I2');
  const subtitleCell = ws.getCell('A2');
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subtitleCell.font = { bold: true };
  applyBorders(subtitleCell);

  ws.addRow([]);

  // Header
  const headerRow = ws.addRow([
    'S No',
    'Faculty ID',
    'Faculty Name',
    'Designation',
    'Phone',
    'Date',
    'Time Slot',
    'Role',
    'Room Number',
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    applyBorders(cell);
    applyPadding(cell);
  });

  const facById = new Map(faculty.map((f) => [f.facultyId, f]));
  const slotMap = new Map<string, DutySlot>();
  const slotKey = (d: number, s: number) => `d${d}-s${s}`;
  for (const ds of dutySlots) slotMap.set(slotKey(ds.day, ds.slot), ds);

  // Group by faculty
  const byFaculty = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (!byFaculty.has(a.facultyId)) byFaculty.set(a.facultyId, []);
    byFaculty.get(a.facultyId)!.push(a);
  }
  // Include zero-duty faculty
  for (const f of faculty)
    if (!byFaculty.has(f.facultyId)) byFaculty.set(f.facultyId, []);

  // Deterministic faculty order: designation → name → id
  const facultyIds = [...byFaculty.keys()].sort((a, b) =>
    facultyCompare(facById.get(a), facById.get(b))
  );
  let sNo = 1;

  for (const fid of facultyIds) {
    const f = facById.get(fid);
    const list = [...(byFaculty.get(fid) || [])];

    // Sort duties by date, slot, role
    list.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      if (a.slot !== b.slot) return a.slot - b.slot;
      return a.role.localeCompare(b.role);
    });

    // Group by (day, slot, role) so reliever/squad rooms are a single duty
    const groups = new Map<string, Assignment[]>();
    for (const d of list) {
      const key = `${d.day}|${d.slot}|${d.role}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }

    const grouped = [...groups.entries()]
      .map(([key, arr]) => {
        const [dayStr, slotStr, role] = key.split('|');
        const day = Number(dayStr);
        const slot = Number(slotStr);
        const ds = slotMap.get(slotKey(day, slot));
        const dateStr = ds ? ds.date.toLocaleDateString() : '';
        const timeStr = ds ? `${ds.startTime} - ${ds.endTime}` : '';
        const allRooms = arr.flatMap((a) => {
          if (role === 'reliever' || role === 'squad') {
            return (a.rooms || []).map((r) => r);
          }
          if (role === 'regular' && a.roomNumber) {
            return [a.roomNumber];
          }
          return [];
        });
        const rooms = [...new Set(allRooms)].sort((x, y) => x.localeCompare(y));
        return {
          day,
          slot,
          dateStr,
          timeStr,
          role: role.toUpperCase() as
            | 'REGULAR'
            | 'RELIEVER'
            | 'SQUAD'
            | 'BUFFER',
          rooms,
        };
      })
      .sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        if (a.slot !== b.slot) return a.slot - b.slot;
        return a.role.localeCompare(b.role);
      });

    // If no duties, render a single blank row for this faculty
    if (grouped.length === 0) {
      const startRow = ws.rowCount + 1;
      const row = ws.addRow([
        sNo,
        fid,
        f?.facultyName || 'Unknown',
        f?.designation || 'Unknown',
        f?.phoneNo || 'N/A',
        '',
        '',
        '',
        '',
      ]);
      row.eachCell((cell) => {
        applyBorders(cell);
        applyPadding(cell);
      });
      const endRow = ws.rowCount;

      // Merge faculty info columns
      ws.mergeCells(startRow, 1, endRow, 1); // S No
      ws.mergeCells(startRow, 2, endRow, 2); // Faculty ID
      ws.mergeCells(startRow, 3, endRow, 3); // Name
      ws.mergeCells(startRow, 4, endRow, 4); // Designation
      ws.mergeCells(startRow, 5, endRow, 5); // Phone

      [1, 2, 3, 4, 5].forEach((col) => {
        const cell = ws.getCell(startRow, col);
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Apply thick bottom border to separate from next faculty
      for (let col = 1; col <= 9; col++) {
        const cell = ws.getCell(endRow, col);
        cell.border = {
          ...cell.border,
          bottom: { style: 'thick' },
        };
      }

      sNo++;
      continue;
    }

    // Emit all grouped duties for this faculty
    const facultyStart = ws.rowCount + 1;

    for (const g of grouped) {
      const span = Math.max(1, g.rooms.length);
      const groupStart = ws.rowCount + 1;

      if (span === 1) {
        const room = g.role === 'REGULAR' ? g.rooms[0] || '' : '';
        const row = ws.addRow([
          sNo,
          fid,
          f?.facultyName || 'Unknown',
          f?.designation || 'Unknown',
          f?.phoneNo || 'N/A',
          g.dateStr,
          g.timeStr,
          g.role,
          room,
        ]);
        row.eachCell((cell) => {
          applyBorders(cell);
          applyPadding(cell);
        });
      } else {
        for (let i = 0; i < span; i++) {
          const room = g.rooms[i] || '';
          if (i === 0) {
            const row = ws.addRow([
              sNo,
              fid,
              f?.facultyName || 'Unknown',
              f?.designation || 'Unknown',
              f?.phoneNo || 'N/A',
              g.dateStr,
              g.timeStr,
              g.role,
              room,
            ]);
            row.eachCell((cell) => {
              applyBorders(cell);
              applyPadding(cell);
            });
          } else {
            const row = ws.addRow([
              '',
              '',
              '',
              '',
              '',
              g.dateStr,
              g.timeStr,
              g.role,
              room,
            ]);
            row.eachCell((cell) => {
              applyBorders(cell);
              applyPadding(cell);
            });
          }
        }

        const groupEnd = ws.rowCount;
        // Merge Date (6), Time Slot (7), Role (8) within duty group
        ws.mergeCells(groupStart, 6, groupEnd, 6);
        ws.mergeCells(groupStart, 7, groupEnd, 7);
        ws.mergeCells(groupStart, 8, groupEnd, 8);

        [6, 7, 8].forEach((col) => {
          const cell = ws.getCell(groupStart, col);
          cell.alignment = { vertical: 'middle' };
          applyBorders(cell);
        });
      }

      sNo++;
    }

    // Merge faculty columns across ALL rows for this faculty block
    const facultyEnd = ws.rowCount;
    if (facultyEnd > facultyStart) {
      ws.mergeCells(facultyStart, 1, facultyEnd, 1); // S No
      ws.mergeCells(facultyStart, 2, facultyEnd, 2); // Faculty ID
      ws.mergeCells(facultyStart, 3, facultyEnd, 3); // Name
      ws.mergeCells(facultyStart, 4, facultyEnd, 4); // Designation
      ws.mergeCells(facultyStart, 5, facultyEnd, 5); // Phone

      [1, 2, 3, 4, 5].forEach((col) => {
        const cell = ws.getCell(facultyStart, col);
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Apply thick bottom border to last row of faculty block to separate from next faculty
      for (let col = 1; col <= 9; col++) {
        const cell = ws.getCell(facultyEnd, col);
        cell.border = {
          ...cell.border,
          bottom: { style: 'thick' },
        };
      }
    }
  }

  autoFitColumns(ws);
  ws.getColumn(1).width = 8; // S No
  ws.getColumn(2).width = 16; // Faculty ID
  ws.getColumn(3).width = 30; // Name
  ws.getColumn(4).width = 20; // Designation
  ws.getColumn(5).width = 16; // Phone
  ws.getColumn(6).width = 16; // Date
  ws.getColumn(7).width = 20; // Time Slot
  ws.getColumn(8).width = 12; // Role
  ws.getColumn(9).width = 16; // Room

  setRowHeights(ws, 4);

  return ws;
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
  examStructure: ExamStructure,
  assignments: Assignment[],
  faculty: Faculty[],
  unavailability: UnavailableFaculty[] = []
): Promise<void> {
  const zip = new JSZip();

  const dutySlots = examStructure.dutySlots || [];

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

  // 2.5 Add metadata.json and assignment.json
  try {
    const metadata = {
      generatedAt: new Date().toISOString(),
      slots: dutySlots.map((ds) => ({
        day: ds.day,
        slot: ds.slot,
        date: ds.date instanceof Date ? ds.date.toISOString() : String(ds.date),
        startTime: ds.startTime,
        endTime: ds.endTime,
        rooms: ds.rooms || [],
        regularDuties: ds.regularDuties,
        relieverDuties: ds.relieverDuties,
        squadDuties: ds.squadDuties,
        bufferDuties: ds.bufferDuties,
      })),
      designationDutyCounts: examStructure.designationDutyCounts || {},
      designationRelieverCounts:
        examStructure.designationRelieverCounts || undefined,
      designationSquadCounts: examStructure.designationSquadCounts || undefined,
      designationBufferEligibility:
        examStructure.designationBufferEligibility || undefined,
      unavailable: (unavailability || []).map((u) => ({
        facultyId: u.facultyId,
        date: u.date,
      })),
      faculty: faculty.map((f) => ({
        facultyId: f.facultyId,
        facultyName: f.facultyName,
        designation: f.designation,
        department: f.department,
        phoneNo: f.phoneNo,
      })),
    };

    const assignmentExport = assignments.map((a) => {
      const ds = dutySlots.find((d) => d.day === a.day && d.slot === a.slot);
      return {
        day: a.day,
        slot: a.slot,
        date:
          ds && ds.date instanceof Date
            ? ds.date.toISOString()
            : (ds?.date ?? null),
        time: ds ? `${ds.startTime} - ${ds.endTime}` : null,
        facultyId: a.facultyId,
        role: a.role,
        roomNumber: a.roomNumber || null,
        rooms: a.rooms || null,
      };
    });

    // Place JSON files inside an internal folder to keep them separate from user-facing files
    zip.file('internal/metadata.json', JSON.stringify(metadata, null, 2));
    zip.file(
      'internal/assignment.json',
      JSON.stringify(assignmentExport, null, 2)
    );
  } catch (err) {
    // If JSON serialization fails for some reason, still continue with ZIP generation
    // but include a simple error file to aid debugging.
    try {
      zip.file(
        'metadata-error.txt',
        String(err instanceof Error ? err.message : err)
      );
    } catch {
      // swallow
    }
  }

  // 3. Generate and download ZIP
  // Add a last_modified.txt at the root with the current timestamp
  try {
    zip.file('last_modified.txt', new Date().toISOString());
  } catch {
    // ignore
  }
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

// -------------------------
// Metadata import helpers
// -------------------------
export interface ImportedMetadata {
  faculty: Faculty[];
  examStructure: {
    days: number;
    dutySlots: DutySlot[];
    designationDutyCounts: Record<string, number>;
  };
  unavailability: UnavailableFaculty[];
}

function buildExamStructureFromSlots(slots: any[]): {
  days: number;
  dutySlots: DutySlot[];
  designationDutyCounts: Record<string, number>;
} {
  const dutySlots: DutySlot[] = (slots || []).map((s: any) => ({
    day: Number(s.day),
    slot: Number(s.slot),
    date: s.date ? new Date(s.date) : new Date(),
    startTime: s.startTime || '',
    endTime: s.endTime || '',
    regularDuties: Number(s.regularDuties || 0),
    relieverDuties: Number(s.relieverDuties || 0) || 0,
    squadDuties: Number(s.squadDuties || 0) || 0,
    bufferDuties: Number(s.bufferDuties || 0) || 0,
    rooms: Array.isArray(s.rooms) ? s.rooms.slice() : [],
  }));

  const maxDay = dutySlots.reduce((acc, ds) => Math.max(acc, ds.day), 0);
  return {
    days: maxDay >= 0 ? maxDay + 1 : 0,
    dutySlots,
    designationDutyCounts: {},
  };
}

function parseMetadataObject(obj: any): ImportedMetadata {
  const faculty: Faculty[] = Array.isArray(obj.faculty)
    ? obj.faculty.map((f: any, idx: number) => ({
        sNo: Number(f.sNo ?? idx + 1),
        facultyName: String(f.facultyName ?? f.name ?? ''),
        facultyId: String(f.facultyId ?? f.id ?? '').trim(),
        designation: String(f.designation ?? f.designation ?? ''),
        department: String(f.department ?? ''),
        phoneNo: String(f.phoneNo ?? ''),
      }))
    : [];

  const unavailability: UnavailableFaculty[] = Array.isArray(obj.unavailable)
    ? obj.unavailable.map((u: any) => ({
        facultyId: String(u.facultyId || u.id || ''),
        date: String(u.date),
      }))
    : [];

  const examStructure = buildExamStructureFromSlots(
    Array.isArray(obj.slots) ? obj.slots : []
  );
  // Copy designation-related maps if present
  if (
    obj.designationDutyCounts &&
    typeof obj.designationDutyCounts === 'object'
  ) {
    examStructure.designationDutyCounts = {
      ...(obj.designationDutyCounts || {}),
    };
  }
  if (
    obj.designationRelieverCounts &&
    typeof obj.designationRelieverCounts === 'object'
  ) {
    (examStructure as any).designationRelieverCounts = {
      ...(obj.designationRelieverCounts || {}),
    };
  }
  if (
    obj.designationSquadCounts &&
    typeof obj.designationSquadCounts === 'object'
  ) {
    (examStructure as any).designationSquadCounts = {
      ...(obj.designationSquadCounts || {}),
    };
  }
  if (
    obj.designationBufferEligibility &&
    typeof obj.designationBufferEligibility === 'object'
  ) {
    (examStructure as any).designationBufferEligibility = {
      ...(obj.designationBufferEligibility || {}),
    };
  }

  return { faculty, examStructure, unavailability };
}

export async function importMetadataFromJsonFile(
  file: File
): Promise<ImportedMetadata> {
  const text = await file.text();
  const obj = JSON.parse(text);
  return parseMetadataObject(obj);
}

export async function importMetadataFromZipFile(
  file: File
): Promise<ImportedMetadata> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  // Prefer internal/metadata.json, fallback to metadata.json at root
  const candidates = ['internal/metadata.json', 'metadata.json'];
  let content: string | null = null;
  for (const p of candidates) {
    const f = zip.file(p);
    if (f) {
      content = await f.async('string');
      break;
    }
  }
  if (!content)
    throw new Error(
      'metadata.json not found in ZIP (searched internal/metadata.json and metadata.json)'
    );
  const obj = JSON.parse(content);
  return parseMetadataObject(obj);
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
  applyBorders(mainTitleCell);

  // Add sheet title (merged across all columns)
  worksheet.addRow(['LIST OF SLOTS']);
  worksheet.mergeCells('A2:F2');
  const sheetTitleCell = worksheet.getCell('A2');
  sheetTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetTitleCell.font = { bold: true, size: 14 };
  applyBorders(sheetTitleCell);

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
  headerRow.eachCell((cell) => {
    applyBorders(cell);
    applyPadding(cell);
  });

  // Group slots by date for merging
  const dateGroups = new Map<string, typeof dutySlots>();
  dutySlots.forEach((slot) => {
    const dateStr = slot.date.toLocaleDateString();
    if (!dateGroups.has(dateStr)) {
      dateGroups.set(dateStr, []);
    }
    dateGroups.get(dateStr)!.push(slot);
  });

  let currentRow = 5;

  dateGroups.forEach((slots, dateStr) => {
    const startRow = currentRow;

    slots.forEach((slot) => {
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

      const row = worksheet.addRow([
        currentRow === startRow ? dateStr : '',
        `${slot.startTime} - ${slot.endTime}`,
        regularCount,
        relieverCount,
        squadCount,
        bufferCount,
      ]);
      row.eachCell((cell) => {
        applyBorders(cell);
        applyPadding(cell);
      });
      currentRow++;
    });

    if (slots.length > 1) {
      worksheet.mergeCells(`A${startRow}:A${currentRow - 1}`);
      const dateCell = worksheet.getCell(`A${startRow}`);
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      applyBorders(dateCell);
    }
  });

  autoFitColumns(worksheet);
  worksheet.getColumn(1).width = 16;
  worksheet.getColumn(2).width = 22;
  worksheet.getColumn(3).width = 12;
  worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 12;
  worksheet.getColumn(6).width = 12;

  setRowHeights(worksheet, 5);

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
  worksheet.mergeCells('A1:G1');
  const mainTitleCell = worksheet.getCell('A1');
  mainTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  mainTitleCell.font = { bold: true, size: 14 };
  applyBorders(mainTitleCell);

  // Add sheet title (merged across all columns)
  worksheet.addRow(['FACULTY ASSIGNMENT OVERVIEW']);
  worksheet.mergeCells('A2:G2');
  const sheetTitleCell = worksheet.getCell('A2');
  sheetTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetTitleCell.font = { bold: true, size: 14 };
  applyBorders(sheetTitleCell);

  // Add empty row
  worksheet.addRow([]);

  // Add headers
  const headerRow = worksheet.addRow([
    'Faculty ID',
    'Faculty Name',
    'Designation',
    'Regular',
    'Reliever',
    'Squad',
    'Buffer',
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    applyBorders(cell);
    applyPadding(cell);
  });

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

  // Sort faculty by designation, then by name
  const sortedFaculty = [...faculty].sort((a, b) => {
    if (a.designation !== b.designation) {
      return a.designation.localeCompare(b.designation);
    }
    return a.facultyName.localeCompare(b.facultyName);
  });

  // Add faculty data rows
  sortedFaculty.forEach((f) => {
    const stats = facultyStats.get(f.facultyId) || {
      regular: 0,
      reliever: 0,
      squad: 0,
      buffer: 0,
    };
    const row = worksheet.addRow([
      f.facultyId,
      f.facultyName,
      f.designation,
      stats.regular,
      stats.reliever,
      stats.squad,
      stats.buffer,
    ]);
    row.eachCell((cell) => {
      applyBorders(cell);
      applyPadding(cell);
    });
  });

  autoFitColumns(worksheet);
  worksheet.getColumn(1).width = 16;
  worksheet.getColumn(2).width = 35;
  worksheet.getColumn(3).width = 22;
  worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 12;
  worksheet.getColumn(6).width = 12;
  worksheet.getColumn(7).width = 12;

  setRowHeights(worksheet, 5);

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
  applyBorders(titleCell);

  // Add date/time row (merged across 6 columns)
  worksheet.addRow([`${date.toLocaleDateString()} ${timeSlot}`]);
  worksheet.mergeCells('A2:F2');
  const dateCell = worksheet.getCell('A2');
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  dateCell.font = { bold: true };
  applyBorders(dateCell);

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
  headerRow.eachCell((cell) => {
    applyBorders(cell);
    applyPadding(cell);
  });

  // Add data rows
  assignments.forEach((assignment, index) => {
    const row = worksheet.addRow([
      index + 1,
      assignment.role.toUpperCase(),
      assignment.roomNumber || getRoleDisplay(assignment.role),
      assignment.facultyId,
      assignment.facultyName,
      assignment.phoneNo,
    ]);
    row.eachCell((cell) => {
      applyBorders(cell);
      applyPadding(cell);
    });
  });

  // Check if slot is incomplete and add warning
  if (dutySlot) {
    const expectedTotal =
      dutySlot.regularDuties +
      (dutySlot.relieverDuties || 0) +
      (dutySlot.squadDuties || 0) +
      dutySlot.bufferDuties;

    if (assignments.length < expectedTotal) {
      worksheet.addRow([]);

      const warningRow = worksheet.addRow([
        '⚠️ WARNING: This slot has incomplete assignments. Some duties could not be filled.',
      ]);
      worksheet.mergeCells(`A${warningRow.number}:F${warningRow.number}`);
      const warningCell = worksheet.getCell(`A${warningRow.number}`);
      warningCell.font = { bold: true, color: { argb: 'FFD32F2F' } };
      warningCell.alignment = { horizontal: 'center', vertical: 'middle' };
      warningCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF59D' },
      };
      applyBorders(warningCell);

      const detailRow = worksheet.addRow([
        `Assigned: ${assignments.length} / ${expectedTotal} duties`,
      ]);
      worksheet.mergeCells(`A${detailRow.number}:F${detailRow.number}`);
      const detailCell = worksheet.getCell(`A${detailRow.number}`);
      detailCell.alignment = { horizontal: 'center', vertical: 'middle' };
      detailCell.font = { italic: true };
      applyBorders(detailCell);
    }
  }

  autoFitColumns(worksheet);
  setWidths(worksheet);
  setRowHeights(worksheet, 4);

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

    if (index === 0 && maxLength <= 4) {
      column.width = 8;
    } else {
      column.width = maxLength < 8 ? 8 : Math.min(maxLength + 2, 50);
    }
  });
}
