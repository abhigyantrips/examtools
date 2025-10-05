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
  // Build four sheets
  createRegularSheet(workbook, dutySlot, assignments, faculty, timeSlot);
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
  createBufferSheet(workbook, dutySlot, assignments, faculty, timeSlot);

  const filename = `day${dutySlot.day + 1}-slot${dutySlot.slot + 1}-${
    dutySlot.date.toISOString().split('T')[0]
  }.xlsx`;
  await downloadWorkbook(workbook, filename);
}

// Helper functions for multi-sheet export
function headerBlock(ws: ExcelJS.Worksheet, subtitle: string) {
  ws.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
  ws.mergeCells('A1:F1');
  const titleCell = ws.getCell('A1');
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.font = { bold: true, size: 14 };
  ws.addRow([subtitle]);
  ws.mergeCells('A2:F2');
  const subCell = ws.getCell('A2');
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.font = { bold: true };
  ws.addRow([]);
}

function createRegularSheet(
  workbook: ExcelJS.Workbook,
  slot: DutySlot,
  allAssignments: Assignment[],
  faculty: Faculty[],
  timeSlot: string
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet('Regular');
  headerBlock(ws, `${slot.date.toLocaleDateString()} ${timeSlot}`);
  ws.addRow([
    'S No',
    'Role',
    'Room Number',
    'Faculty ID',
    'Faculty Name',
    'Phone Number',
  ]).font = {
    bold: true,
  };

  const regs = allAssignments
    .filter(
      (a) => a.day === slot.day && a.slot === slot.slot && a.role === 'regular'
    )
    .sort((a, b) => (a.roomNumber || '').localeCompare(b.roomNumber || ''));

  const facById = new Map(faculty.map((f) => [f.facultyId, f]));
  const rows: Array<[number, string, string, string, string, string]> = [];

  // Create a map of room -> assignment for quick lookup, but we're fine with sequential
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

  // Add empties for unfilled rooms (left empty with light red bg)
  const missing = Math.max(0, slot.regularDuties - regs.length);
  for (let i = 0; i < missing; i++) {
    rows.push([sNo++, 'REGULAR', '', '', '', '']);
  }

  for (const r of rows) ws.addRow(r);

  // highlight empty rows (no facultyId)
  highlightEmptyRows(ws, 4);
  autoFitColumns(ws);
  setWidths(ws);
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
  ws.addRow([
    'S No',
    'Role',
    'Room Number',
    'Faculty ID',
    'Faculty Name',
    'Phone Number',
  ]).font = {
    bold: true,
  };

  const facById = new Map(faculty.map((f) => [f.facultyId, f]));

  // Collect assignments for the slot
  const asg = allAssignments
    .filter(
      (a) => a.day === slot.day && a.slot === slot.slot && a.role === role
    )
    .map((a) => ({
      ...a,
      rooms: [...(a.rooms || [])].sort((x, y) => x.localeCompare(y)),
    }));

  // We need to also account for unassigned positions => empty groups with zero rooms
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
      // render one empty row placeholder
      ws.addRow([sNo++, name.toUpperCase(), '', '', '', '']);
    } else {
      for (let i = 0; i < minRows; i++) {
        const room = rooms[i] || '';
        if (i === 0) {
          const f = isAssigned
            ? facById.get((grp as Assignment).facultyId)
            : undefined;
          ws.addRow([
            sNo,
            name.toUpperCase(),
            room,
            isAssigned ? (grp as Assignment).facultyId : '',
            isAssigned ? f?.facultyName || 'Unknown' : '',
            isAssigned ? f?.phoneNo || 'N/A' : '',
          ]);
        } else {
          ws.addRow(['', name.toUpperCase(), room, '', '', '']);
        }
      }
      sNo++;
    }

    const endRow = ws.rowCount;
    // Merge S No, Faculty ID, Faculty Name, Phone vertically across the block
    // Columns: 1=S No, 4=Faculty ID, 5=Faculty Name, 6=Phone
    if (endRow > startRow) {
      ws.mergeCells(startRow, 1, endRow, 1);
      ws.mergeCells(startRow, 4, endRow, 4);
      ws.mergeCells(startRow, 5, endRow, 5);
      ws.mergeCells(startRow, 6, endRow, 6);
      // Center merged cells vertically
      ws.getCell(startRow, 1).alignment = {
        vertical: 'middle',
        horizontal: 'center',
      };
      ws.getCell(startRow, 4).alignment = { vertical: 'middle' };
      ws.getCell(startRow, 5).alignment = { vertical: 'middle' };
      ws.getCell(startRow, 6).alignment = { vertical: 'middle' };
    }
  }

  // highlight empty blocks (no facultyId)
  highlightEmptyRows(ws, 4);
  autoFitColumns(ws);
  setWidths(ws);
  return ws;
}

function createBufferSheet(
  workbook: ExcelJS.Workbook,
  slot: DutySlot,
  allAssignments: Assignment[],
  faculty: Faculty[],
  timeSlot: string
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet('Buffer');
  headerBlock(ws, `${slot.date.toLocaleDateString()} ${timeSlot}`);
  ws.addRow([
    'S No',
    'Role',
    'Room Number',
    'Faculty ID',
    'Faculty Name',
    'Phone Number',
  ]).font = {
    bold: true,
  };

  const facById = new Map(faculty.map((f) => [f.facultyId, f]));
  const bufs = allAssignments.filter(
    (a) => a.day === slot.day && a.slot === slot.slot && a.role === 'buffer'
  );

  let sNo = 1;
  for (const a of bufs) {
    const f = facById.get(a.facultyId);
    ws.addRow([
      sNo++,
      'BUFFER',
      '',
      a.facultyId,
      f?.facultyName || 'Unknown',
      f?.phoneNo || 'N/A',
    ]);
  }

  // Empty rows for missing buffers
  const missing = Math.max(0, slot.bufferDuties - bufs.length);
  for (let i = 0; i < missing; i++) {
    ws.addRow([sNo++, 'BUFFER', '', '', '', '']);
  }

  highlightEmptyRows(ws, 4);
  autoFitColumns(ws);
  setWidths(ws);
  return ws;
}

function highlightEmptyRows(ws: ExcelJS.Worksheet, facultyIdCol: number) {
  const headerRow = 4; // 1:title,2:subtitle,3:blank,4:header
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const idCell = ws.getCell(r, facultyIdCol);
    if (!idCell.value) {
      for (let c = 1; c <= 6; c++) {
        const cell = ws.getCell(r, c);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEBEE' }, // light red
        };
      }
    }
  }
}

function setWidths(ws: ExcelJS.Worksheet) {
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 15;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 28;
  ws.getColumn(6).width = 15;
}

function createFacultyOverviewSheet(
  workbook: ExcelJS.Workbook,
  dutySlots: DutySlot[],
  assignments: Assignment[],
  faculty: Faculty[]
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet('Faculty Overview');

  // Title
  ws.addRow(['MANIPAL INSTITUTE OF TECHNOLOGY, BENGALURU']);
  ws.mergeCells('A1:I1');
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.addRow(['CONSOLIDATED FACULTY DUTY OVERVIEW']);
  ws.mergeCells('A2:I2');
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('A2').font = { bold: true };
  ws.addRow([]);

  // Header
  ws.addRow([
    'S No',
    'Date',
    'Time Slot',
    'Role',
    'Room Number',
    'Faculty ID',
    'Faculty Name',
    'Designation',
    'Phone',
  ]).font = { bold: true };

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

  // Deterministic faculty order
  const facultyIds = [...byFaculty.keys()].sort((a, b) => a.localeCompare(b));
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

    // For a well-formed solver, we only expect one assignment per (day,slot,role) per faculty.
    // But if duplicates exist, we'll fold rooms together.
    const grouped = [...groups.entries()]
      .map(([key, arr]) => {
        const [dayStr, slotStr, role] = key.split('|');
        const day = Number(dayStr);
        const slot = Number(slotStr);
        const ds = slotMap.get(slotKey(day, slot));
        const dateStr = ds ? ds.date.toLocaleDateString() : '';
        const timeStr = ds ? `${ds.startTime} - ${ds.endTime}` : '';
        // Collect rooms for reliever/squad; for regular include roomNumber; buffer has no rooms
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
      ws.addRow([
        sNo,
        '',
        '',
        '',
        '',
        fid,
        f?.facultyName || 'Unknown',
        f?.designation || 'Unknown',
        f?.phoneNo || 'N/A',
      ]);
      const endRow = ws.rowCount;
      ws.mergeCells(startRow, 1, endRow, 1);
      ws.mergeCells(startRow, 6, endRow, 6);
      ws.mergeCells(startRow, 7, endRow, 7);
      ws.mergeCells(startRow, 8, endRow, 8);
      ws.mergeCells(startRow, 9, endRow, 9);
      ws.getCell(startRow, 1).alignment = {
        vertical: 'middle',
        horizontal: 'center',
      };
      ws.getCell(startRow, 6).alignment = { vertical: 'middle' };
      ws.getCell(startRow, 7).alignment = { vertical: 'middle' };
      ws.getCell(startRow, 8).alignment = { vertical: 'middle' };
      ws.getCell(startRow, 9).alignment = { vertical: 'middle' };
      sNo++;
      continue;
    }

    // Emit all grouped duties for this faculty, but remember we need:
    // - faculty columns merged across ALL their rows
    // - date/time/role merged within each duty group
    const facultyStart = ws.rowCount + 1;

    for (const g of grouped) {
      const span = Math.max(1, g.rooms.length);
      const groupStart = ws.rowCount + 1;

      if (span === 1) {
        // One row duty (regular with 1 room or buffer)
        const room = g.role === 'REGULAR' ? g.rooms[0] || '' : '';
        ws.addRow([
          sNo, // temp; will merge later
          g.dateStr,
          g.timeStr,
          g.role,
          room,
          fid,
          f?.facultyName || 'Unknown',
          f?.designation || 'Unknown',
          f?.phoneNo || 'N/A',
        ]);
      } else {
        // Reliever/Squad with multiple rooms: N rows, merge Date/Time/Role across N rows
        for (let i = 0; i < span; i++) {
          const room = g.rooms[i] || '';
          if (i === 0) {
            ws.addRow([
              sNo, // temp; will merge later
              g.dateStr,
              g.timeStr,
              g.role,
              room,
              fid,
              f?.facultyName || 'Unknown',
              f?.designation || 'Unknown',
              f?.phoneNo || 'N/A',
            ]);
          } else {
            ws.addRow([
              '', // SNo merged
              g.dateStr,
              g.timeStr,
              g.role,
              room,
              '', // Faculty cols merged
              '',
              '',
              '',
            ]);
          }
        }
        // Merge Date (col 2), Time Slot (3), Role (4) within this duty group
        const groupEnd = ws.rowCount;
        ws.mergeCells(groupStart, 2, groupEnd, 2);
        ws.mergeCells(groupStart, 3, groupEnd, 3);
        ws.mergeCells(groupStart, 4, groupEnd, 4);
        ws.getCell(groupStart, 2).alignment = { vertical: 'middle' };
        ws.getCell(groupStart, 3).alignment = { vertical: 'middle' };
        ws.getCell(groupStart, 4).alignment = { vertical: 'middle' };
      }

      sNo++;
    }

    // Merge faculty columns across ALL rows for this faculty block
    const facultyEnd = ws.rowCount;
    if (facultyEnd > facultyStart) {
      ws.mergeCells(facultyStart, 1, facultyEnd, 1); // S No
      ws.mergeCells(facultyStart, 6, facultyEnd, 6); // Faculty ID
      ws.mergeCells(facultyStart, 7, facultyEnd, 7); // Name
      ws.mergeCells(facultyStart, 8, facultyEnd, 8); // Designation
      ws.mergeCells(facultyStart, 9, facultyEnd, 9); // Phone

      ws.getCell(facultyStart, 1).alignment = {
        vertical: 'middle',
        horizontal: 'center',
      };
      ws.getCell(facultyStart, 6).alignment = { vertical: 'middle' };
      ws.getCell(facultyStart, 7).alignment = { vertical: 'middle' };
      ws.getCell(facultyStart, 8).alignment = { vertical: 'middle' };
      ws.getCell(facultyStart, 9).alignment = { vertical: 'middle' };
    }
  }

  autoFitColumns(ws);
  ws.getColumn(1).width = 6; // S No
  ws.getColumn(2).width = 14; // Date
  ws.getColumn(3).width = 18; // Time Slot
  ws.getColumn(4).width = 12; // Role
  ws.getColumn(5).width = 16; // Room
  ws.getColumn(6).width = 14; // Faculty ID
  ws.getColumn(7).width = 28; // Name
  ws.getColumn(8).width = 18; // Designation
  ws.getColumn(9).width = 16; // Phone

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
