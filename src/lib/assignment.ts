// src/lib/assignment.ts
import type {
  Assignment,
  AssignmentResult,
  ExamStructure,
  Faculty,
  FacultyDutyOverview,
  UnavailableFaculty,
  Violation,
} from '@/types';

interface FacultyDutyCount {
  facultyId: string;
  // PER-ROLE tracking (buffer is separate)
  regular: number;
  reliever: number;
  squad: number;
  buffer: number;
  // PER-ROLE targets
  regularTarget: number;
  relieverTarget: number;
  squadTarget: number;
}

interface SlotCtx {
  day: number;
  slot: number;
  dateISO: string;
  roomsSorted: string[];
  need: {
    regular: number;
    reliever: number;
    squad: number;
    buffer: number;
  };
  availableFaculty: Faculty[];
}

export function assignDuties(
  faculty: Faculty[],
  examStructure: ExamStructure,
  unavailability: UnavailableFaculty[]
): AssignmentResult {
  const warnings: string[] = [];
  const violations: Violation[] = [];
  const assignments: Assignment[] = [];
  const incompleteSlots: NonNullable<AssignmentResult['incompleteSlots']> = [];

  // Validation
  const v = validateInputs(faculty, examStructure);
  if (!v.valid) {
    return {
      success: false,
      assignments: [],
      errors: v.errors,
      warnings: v.warnings,
      violations: [],
      dutyOverview: [],
    };
  }
  warnings.push(...v.warnings);

  // Initialize tracking with SEPARATE buffer count
  const dutyCounts = initializeCounts(faculty, examStructure);
  const unavailByDate = buildUnavailability(unavailability);

  // Unavailability count for TIEBREAKING ONLY
  const unavailabilityCountMap = new Map<string, number>();
  for (const u of unavailability) {
    unavailabilityCountMap.set(
      u.facultyId,
      (unavailabilityCountMap.get(u.facultyId) || 0) + 1
    );
  }

  // Process slots
  const sortedSlots = [...examStructure.dutySlots].sort((a, b) =>
    a.day === b.day ? a.slot - b.slot : a.day - b.day
  );

  for (const slot of sortedSlots) {
    // Hard constraint: room mismatch
    if (slot.rooms.length !== slot.regularDuties) {
      violations.push({
        id: 'ROOM_MISMATCH',
        message: `Day ${slot.day + 1} Slot ${slot.slot + 1}: ${slot.rooms.length} rooms != ${slot.regularDuties} regular duties`,
        day: slot.day,
        slot: slot.slot,
        role: 'regular',
      });
      incompleteSlots.push({
        day: slot.day,
        slot: slot.slot,
        regular: { needed: slot.regularDuties, assigned: 0 },
        reliever: { needed: slot.relieverDuties || 0, assigned: 0 },
        squad: { needed: slot.squadDuties || 0, assigned: 0 },
        buffer: { needed: slot.bufferDuties, assigned: 0 },
      });
      continue;
    }

    const year = slot.date.getFullYear();
    const month = String(slot.date.getMonth() + 1).padStart(2, '0');
    const day = String(slot.date.getDate()).padStart(2, '0');
    const dateISO = `${year}-${month}-${day}`;

    const unavailable = unavailByDate.get(dateISO) || new Set<string>();
    const availableFaculty = faculty.filter(
      (f) => !unavailable.has(f.facultyId)
    );

    const ctx: SlotCtx = {
      day: slot.day,
      slot: slot.slot,
      dateISO,
      roomsSorted: [...slot.rooms].sort((a, b) => a.localeCompare(b)),
      need: {
        regular: slot.regularDuties,
        reliever: slot.relieverDuties || 0,
        squad: slot.squadDuties || 0,
        buffer: slot.bufferDuties,
      },
      availableFaculty,
    };

    const slotAssigned: Assignment[] = [];

    // TARGET-BASED ASSIGNMENTS
    const aReg = assignRegular(
      ctx,
      dutyCounts,
      assignments,
      slotAssigned,
      unavailabilityCountMap
    );
    assignments.push(...aReg.assigned);
    violations.push(...aReg.violations);
    warnings.push(...aReg.warnings);

    const aRel = assignCoverage(
      ctx,
      dutyCounts,
      assignments,
      slotAssigned,
      'reliever',
      unavailabilityCountMap
    );
    assignments.push(...aRel.assigned);
    violations.push(...aRel.violations);
    warnings.push(...aRel.warnings);

    const aSq = assignCoverage(
      ctx,
      dutyCounts,
      assignments,
      slotAssigned,
      'squad',
      unavailabilityCountMap
    );
    assignments.push(...aSq.assigned);
    violations.push(...aSq.violations);
    warnings.push(...aSq.warnings);

    // BUFFER ASSIGNMENT (separate, no target)
    const aBuf = assignBuffer(
      ctx,
      dutyCounts,
      assignments,
      slotAssigned,
      examStructure,
      unavailabilityCountMap
    );
    assignments.push(...aBuf.assigned);
    violations.push(...aBuf.violations);
    warnings.push(...aBuf.warnings);

    // Incomplete tracking
    const regAssigned = slotAssigned.filter((x) => x.role === 'regular').length;
    const relAssigned = slotAssigned.filter(
      (x) => x.role === 'reliever'
    ).length;
    const sqAssigned = slotAssigned.filter((x) => x.role === 'squad').length;
    const bufAssigned = slotAssigned.filter((x) => x.role === 'buffer').length;

    if (
      regAssigned < ctx.need.regular ||
      relAssigned < ctx.need.reliever ||
      sqAssigned < ctx.need.squad ||
      bufAssigned < ctx.need.buffer
    ) {
      incompleteSlots.push({
        day: slot.day,
        slot: slot.slot,
        regular: { needed: ctx.need.regular, assigned: regAssigned },
        reliever: { needed: ctx.need.reliever, assigned: relAssigned },
        squad: { needed: ctx.need.squad, assigned: sqAssigned },
        buffer: { needed: ctx.need.buffer, assigned: bufAssigned },
      });
    }
  }

  // Verify unavailability constraint
  const unavailabilityViolations: string[] = [];
  for (const assignment of assignments) {
    const slot = sortedSlots.find(
      (s) => s.day === assignment.day && s.slot === assignment.slot
    );
    if (!slot) continue;

    const year = slot.date.getFullYear();
    const month = String(slot.date.getMonth() + 1).padStart(2, '0');
    const day = String(slot.date.getDate()).padStart(2, '0');
    const dateISO = `${year}-${month}-${day}`;

    const unavailableOnDate = unavailByDate.get(dateISO);
    if (unavailableOnDate?.has(assignment.facultyId)) {
      const facultyMember = faculty.find(
        (f) => f.facultyId === assignment.facultyId
      );
      unavailabilityViolations.push(
        `CRITICAL: ${facultyMember?.facultyName || assignment.facultyId} assigned on unavailable date ${dateISO}`
      );
    }
  }

  if (unavailabilityViolations.length > 0) {
    warnings.push(...unavailabilityViolations);
  }

  const overview = buildDutyOverview(assignments, faculty);
  const postWarnings = checkSoftViolations(assignments);
  warnings.push(...postWarnings);

  return {
    success: true,
    assignments,
    errors: [],
    warnings,
    violations,
    incompleteSlots: incompleteSlots.length ? incompleteSlots : undefined,
    dutyOverview: overview,
  };
}

/* ========== Setup ========== */

function validateInputs(
  faculty: Faculty[],
  structure: ExamStructure
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (faculty.length === 0) {
    errors.push('No faculty available');
    return { valid: false, errors, warnings };
  }
  if (structure.dutySlots.length === 0) {
    errors.push('No slots configured');
    return { valid: false, errors, warnings };
  }

  const totalRegular = sum(structure.dutySlots.map((s) => s.regularDuties));
  const totalReliever = sum(
    structure.dutySlots.map((s) => s.relieverDuties || 0)
  );
  const totalSquad = sum(structure.dutySlots.map((s) => s.squadDuties || 0));
  const totalMandatory = totalRegular + totalReliever + totalSquad;

  const totalCapacity = faculty.reduce((acc, f) => {
    const r = structure.designationDutyCounts[f.designation] || 0;
    const re = structure.designationRelieverCounts?.[f.designation] || 0;
    const sq = structure.designationSquadCounts?.[f.designation] || 0;
    return acc + r + re + sq;
  }, 0);

  if (totalCapacity < totalMandatory) {
    errors.push(
      `Insufficient capacity: need ${totalMandatory}, have ${totalCapacity}`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

function initializeCounts(
  faculty: Faculty[],
  structure: ExamStructure
): FacultyDutyCount[] {
  return faculty
    .map((f) => ({
      facultyId: f.facultyId,
      regular: 0,
      reliever: 0,
      squad: 0,
      buffer: 0, // Separate tracking
      regularTarget: structure.designationDutyCounts[f.designation] || 0,
      relieverTarget: structure.designationRelieverCounts?.[f.designation] || 0,
      squadTarget: structure.designationSquadCounts?.[f.designation] || 0,
    }))
    .sort((a, b) => a.facultyId.localeCompare(b.facultyId));
}

function buildUnavailability(
  unavailability: UnavailableFaculty[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const u of unavailability) {
    if (!map.has(u.date)) map.set(u.date, new Set());
    map.get(u.date)!.add(u.facultyId);
  }
  return map;
}

/* ========== Assignment Phases ========== */

function assignRegular(
  ctx: SlotCtx,
  dutyCounts: FacultyDutyCount[],
  globalAssignments: Assignment[],
  slotAssignments: Assignment[],
  unavailabilityCountMap: Map<string, number>
): { assigned: Assignment[]; violations: Violation[]; warnings: string[] } {
  const assigned: Assignment[] = [];
  const violations: Violation[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < ctx.need.regular; i++) {
    const room = ctx.roomsSorted[i];

    // Pass 1: Strict - no consecutive, no overflow, prefer 1 regular/day
    let eligible = filterEligible(
      ctx,
      dutyCounts,
      globalAssignments,
      slotAssignments,
      'regular',
      {
        allowConsecutive: false,
        allowTargetOverflow: false,
        allowMultiplePerDay: false,
      }
    );

    // Pass 2: Allow multiple per day
    if (eligible.length === 0) {
      eligible = filterEligible(
        ctx,
        dutyCounts,
        globalAssignments,
        slotAssignments,
        'regular',
        {
          allowConsecutive: false,
          allowTargetOverflow: false,
          allowMultiplePerDay: true,
        }
      );
    }

    // Pass 3: Allow overflow (still no consecutive)
    if (eligible.length === 0) {
      eligible = filterEligible(
        ctx,
        dutyCounts,
        globalAssignments,
        slotAssignments,
        'regular',
        {
          allowConsecutive: false,
          allowTargetOverflow: true,
          allowMultiplePerDay: true,
        }
      );
    }

    // Pass 4: Allow consecutive (last resort)
    if (eligible.length === 0) {
      eligible = filterEligible(
        ctx,
        dutyCounts,
        globalAssignments,
        slotAssignments,
        'regular',
        {
          allowConsecutive: true,
          allowTargetOverflow: true,
          allowMultiplePerDay: true,
        }
      );
      if (eligible.length > 0) {
        warnings.push(
          `Day ${ctx.day + 1} Slot ${ctx.slot + 1}: Consecutive regular allowed for duty ${i + 1}`
        );
      }
    }

    if (eligible.length === 0) {
      violations.push({
        id: 'NO_ELIGIBLE_RELIEVER',
        message: `No eligible faculty for regular duty ${i + 1}`,
        day: ctx.day,
        slot: ctx.slot,
        role: 'regular',
      });
      continue;
    }

    const chosen = selectByDeficit(
      eligible,
      dutyCounts,
      'regular',
      unavailabilityCountMap
    );
    assigned.push({
      day: ctx.day,
      slot: ctx.slot,
      facultyId: chosen.facultyId,
      roomNumber: room,
      role: 'regular',
    });
    slotAssignments.push(assigned[assigned.length - 1]);

    const dc = dutyCounts.find((x) => x.facultyId === chosen.facultyId)!;
    dc.regular++;
  }

  return { assigned, violations, warnings };
}

function assignCoverage(
  ctx: SlotCtx,
  dutyCounts: FacultyDutyCount[],
  globalAssignments: Assignment[],
  slotAssignments: Assignment[],
  role: 'reliever' | 'squad',
  unavailabilityCountMap: Map<string, number>
): { assigned: Assignment[]; violations: Violation[]; warnings: string[] } {
  const assigned: Assignment[] = [];
  const violations: Violation[] = [];
  const warnings: string[] = [];

  const totalNeeded = role === 'reliever' ? ctx.need.reliever : ctx.need.squad;
  if (totalNeeded <= 0) return { assigned, violations, warnings };

  const groups = buildRoomChunks(ctx.roomsSorted, totalNeeded);

  for (let i = 0; i < totalNeeded; i++) {
    // Pass 1: Strict
    let eligible = filterEligible(
      ctx,
      dutyCounts,
      globalAssignments,
      slotAssignments,
      role,
      {
        allowConsecutive: false,
        allowTargetOverflow: false,
        allowMultiplePerDay: true,
      }
    );

    // Pass 2: Allow overflow
    if (eligible.length === 0) {
      eligible = filterEligible(
        ctx,
        dutyCounts,
        globalAssignments,
        slotAssignments,
        role,
        {
          allowConsecutive: false,
          allowTargetOverflow: true,
          allowMultiplePerDay: true,
        }
      );
    }

    // Pass 3: Allow consecutive
    if (eligible.length === 0) {
      eligible = filterEligible(
        ctx,
        dutyCounts,
        globalAssignments,
        slotAssignments,
        role,
        {
          allowConsecutive: true,
          allowTargetOverflow: true,
          allowMultiplePerDay: true,
        }
      );
      if (eligible.length > 0) {
        warnings.push(
          `Day ${ctx.day + 1} Slot ${ctx.slot + 1}: Consecutive ${role} allowed for duty ${i + 1}`
        );
      }
    }

    if (eligible.length === 0) {
      violations.push({
        id: role === 'reliever' ? 'NO_ELIGIBLE_RELIEVER' : 'NO_ELIGIBLE_SQUAD',
        message: `No eligible faculty for ${role} duty ${i + 1}`,
        day: ctx.day,
        slot: ctx.slot,
        role,
      });
      continue;
    }

    const chosen = selectByDeficit(
      eligible,
      dutyCounts,
      role,
      unavailabilityCountMap
    );
    const rooms = groups[i] || [];

    assigned.push({
      day: ctx.day,
      slot: ctx.slot,
      facultyId: chosen.facultyId,
      role,
      rooms,
    });
    slotAssignments.push(assigned[assigned.length - 1]);

    const dc = dutyCounts.find((x) => x.facultyId === chosen.facultyId)!;
    if (role === 'reliever') {
      dc.reliever++;
    } else {
      dc.squad++;
    }
  }

  return { assigned, violations, warnings };
}

function assignBuffer(
  ctx: SlotCtx,
  dutyCounts: FacultyDutyCount[],
  globalAssignments: Assignment[],
  slotAssignments: Assignment[],
  structure: ExamStructure,
  unavailabilityCountMap: Map<string, number>
): { assigned: Assignment[]; violations: Violation[]; warnings: string[] } {
  const assigned: Assignment[] = [];
  const violations: Violation[] = [];
  const warnings: string[] = [];

  const totalNeeded = ctx.need.buffer;
  if (totalNeeded <= 0) return { assigned, violations, warnings };

  for (let i = 0; i < totalNeeded; i++) {
    // Pass 1: Strict
    let eligible = filterEligible(
      ctx,
      dutyCounts,
      globalAssignments,
      slotAssignments,
      'buffer',
      {
        allowConsecutive: false,
        allowTargetOverflow: true,
        allowMultiplePerDay: true,
      }
    ).filter(
      (f) => structure.designationBufferEligibility?.[f.designation] === true
    );

    // Pass 2: Allow consecutive
    if (eligible.length === 0) {
      eligible = filterEligible(
        ctx,
        dutyCounts,
        globalAssignments,
        slotAssignments,
        'buffer',
        {
          allowConsecutive: true,
          allowTargetOverflow: true,
          allowMultiplePerDay: true,
        }
      ).filter(
        (f) => structure.designationBufferEligibility?.[f.designation] === true
      );

      if (eligible.length > 0) {
        warnings.push(
          `Day ${ctx.day + 1} Slot ${ctx.slot + 1}: Consecutive buffer allowed for duty ${i + 1}`
        );
      }
    }

    if (eligible.length === 0) {
      violations.push({
        id: 'NO_ELIGIBLE_BUFFER',
        message: `No eligible faculty for buffer duty ${i + 1}`,
        day: ctx.day,
        slot: ctx.slot,
        role: 'buffer',
      });
      continue;
    }

    const chosen = selectByDeficit(
      eligible,
      dutyCounts,
      'buffer',
      unavailabilityCountMap
    );
    assigned.push({
      day: ctx.day,
      slot: ctx.slot,
      facultyId: chosen.facultyId,
      role: 'buffer',
    });
    slotAssignments.push(assigned[assigned.length - 1]);

    const dc = dutyCounts.find((x) => x.facultyId === chosen.facultyId)!;
    dc.buffer++;
  }

  return { assigned, violations, warnings };
}

/* ========== CORE LOGIC: Eligibility & Selection ========== */

function filterEligible(
  ctx: SlotCtx,
  dutyCounts: FacultyDutyCount[],
  globalAssignments: Assignment[],
  slotAssignments: Assignment[],
  role: 'regular' | 'reliever' | 'squad' | 'buffer',
  opts: {
    allowConsecutive: boolean;
    allowTargetOverflow: boolean;
    allowMultiplePerDay: boolean;
  }
): Faculty[] {
  const alreadyInSlot = new Set(slotAssignments.map((a) => a.facultyId));

  // Track per-day assignments
  const byFacultyDay = new Map<
    string,
    {
      slots: Array<{ slot: number; role: Assignment['role'] }>;
      regularCount: number;
    }
  >();

  for (const a of globalAssignments) {
    if (a.day !== ctx.day) continue;
    if (!byFacultyDay.has(a.facultyId)) {
      byFacultyDay.set(a.facultyId, { slots: [], regularCount: 0 });
    }
    const entry = byFacultyDay.get(a.facultyId)!;
    entry.slots.push({ slot: a.slot, role: a.role });
    if (a.role === 'regular') entry.regularCount++;
  }
  for (const entry of byFacultyDay.values()) {
    entry.slots.sort((x, y) => x.slot - y.slot);
  }

  // Calculate remaining pool BY ROLE
  const remainingPool = dutyCounts.filter((d) => {
    if (role === 'regular') return d.regular < d.regularTarget;
    if (role === 'reliever') return d.reliever < d.relieverTarget;
    if (role === 'squad') return d.squad < d.squadTarget;
    return true; // Buffer has no target
  }).length;

  return ctx.availableFaculty.filter((f) => {
    // Hard constraint: one role per slot
    if (alreadyInSlot.has(f.facultyId)) return false;

    const dc = dutyCounts.find((d) => d.facultyId === f.facultyId)!;

    // Target overflow check - ONLY block if pool has people below target
    if (!opts.allowTargetOverflow && remainingPool > 0) {
      if (role === 'regular' && dc.regular >= dc.regularTarget) return false;
      if (role === 'reliever' && dc.reliever >= dc.relieverTarget) return false;
      if (role === 'squad' && dc.squad >= dc.squadTarget) return false;
    }

    // Consecutive check - ONLY for regular-to-regular
    if (!opts.allowConsecutive && role === 'regular') {
      const dayRec = byFacultyDay.get(f.facultyId);
      const hasConsecutiveRegular =
        dayRec?.slots.some(
          (rec) => rec.role === 'regular' && Math.abs(rec.slot - ctx.slot) === 1
        ) ?? false;
      if (hasConsecutiveRegular) return false;
    }

    // Multiple per day check - prefer 1 regular per day
    if (!opts.allowMultiplePerDay && role === 'regular') {
      const dayRec = byFacultyDay.get(f.facultyId);
      const hasRegularToday = (dayRec?.regularCount || 0) >= 1;
      if (hasRegularToday && remainingPool > 0) return false;
    }

    return true;
  });
}

/**
 * AUTHORITATIVE SELECTION PRIORITY:
 *
 * For target-based roles (regular/reliever/squad):
 * 1. HIGHEST PER-ROLE DEFICIT (target - assigned)
 * 2. Among same deficit: MORE unavailable days (give them priority to meet quota)
 * 3. Fewest total target-based duties (regular + reliever + squad, NOT buffer)
 * 4. Alphabetical by ID
 *
 * For buffer (no target):
 * 1. Fewest buffer duties
 * 2. Fewest total target-based duties
 * 3. More unavailable days
 * 4. Alphabetical by ID
 */
function selectByDeficit(
  eligible: Faculty[],
  dutyCounts: FacultyDutyCount[],
  role: 'regular' | 'reliever' | 'squad' | 'buffer',
  unavailabilityCountMap: Map<string, number>
): Faculty {
  const byId = new Map(dutyCounts.map((d) => [d.facultyId, d]));

  return [...eligible]
    .map((f) => {
      const d = byId.get(f.facultyId)!;

      let roleDeficit = 0;
      const totalTargetBased = d.regular + d.reliever + d.squad; // EXCLUDE buffer

      if (role === 'regular') {
        roleDeficit = d.regularTarget - d.regular;
      } else if (role === 'reliever') {
        roleDeficit = d.relieverTarget - d.reliever;
      } else if (role === 'squad') {
        roleDeficit = d.squadTarget - d.squad;
      }
      // Buffer has no deficit

      const unavailableDaysCount = unavailabilityCountMap.get(f.facultyId) || 0;

      return {
        f,
        roleDeficit,
        bufferCount: d.buffer,
        totalTargetBased,
        unavailableDaysCount,
      };
    })
    .sort((a, b) => {
      if (role === 'buffer') {
        // Buffer: fewest buffers -> fewest target-based -> more unavailable -> ID
        if (a.bufferCount !== b.bufferCount)
          return a.bufferCount - b.bufferCount;
        if (a.totalTargetBased !== b.totalTargetBased)
          return a.totalTargetBased - b.totalTargetBased;
        if (a.unavailableDaysCount !== b.unavailableDaysCount)
          return b.unavailableDaysCount - a.unavailableDaysCount;
        return a.f.facultyId.localeCompare(b.f.facultyId);
      }

      // Target-based: HIGHEST deficit -> MORE unavailable -> fewest total -> ID
      if (a.roleDeficit !== b.roleDeficit) return b.roleDeficit - a.roleDeficit; // HIGHER deficit = HIGHER priority

      if (a.unavailableDaysCount !== b.unavailableDaysCount)
        return b.unavailableDaysCount - a.unavailableDaysCount; // MORE unavailable = HIGHER priority

      if (a.totalTargetBased !== b.totalTargetBased)
        return a.totalTargetBased - b.totalTargetBased; // FEWER total = HIGHER priority

      return a.f.facultyId.localeCompare(b.f.facultyId);
    })[0].f;
}

/* ========== Helpers ========== */

function buildRoomChunks(rooms: string[], people: number): string[][] {
  const list = [...rooms];
  if (people <= 0) return [];
  if (list.length === 0) return Array.from({ length: people }, () => []);
  const per = Math.floor(list.length / people) || 0;
  const rem = list.length % people;

  const chunks: string[][] = [];
  let idx = 0;
  for (let i = 0; i < people; i++) {
    let size = per;
    if (i < rem) size += 1;
    const group = list.slice(idx, idx + size);
    chunks.push(group);
    idx += size;
  }
  return chunks;
}

function buildDutyOverview(
  assignments: Assignment[],
  faculty: Faculty[]
): FacultyDutyOverview[] {
  const byId = new Map<string, Faculty>();
  faculty.forEach((f) => byId.set(f.facultyId, f));

  const map = new Map<string, FacultyDutyOverview>();
  for (const a of assignments) {
    const key = a.facultyId;
    if (!map.has(key)) {
      const f = byId.get(key);
      map.set(key, {
        facultyId: key,
        facultyName: f?.facultyName || 'Unknown',
        designation: f?.designation || 'Unknown',
        totals: { regular: 0, reliever: 0, squad: 0, buffer: 0, total: 0 },
        coverage: {},
      });
    }
    const o = map.get(key)!;
    o.totals[a.role]++;
    o.totals.total++;
    if (
      (a.role === 'reliever' || a.role === 'squad') &&
      a.rooms &&
      a.rooms.length > 0
    ) {
      const slotKey = `d${a.day}-s${a.slot}`;
      o.coverage![slotKey] = a.rooms;
    }
  }

  for (const f of faculty) {
    if (!map.has(f.facultyId)) {
      map.set(f.facultyId, {
        facultyId: f.facultyId,
        facultyName: f.facultyName,
        designation: f.designation,
        totals: { regular: 0, reliever: 0, squad: 0, buffer: 0, total: 0 },
        coverage: {},
      });
    }
  }

  return [...map.values()].sort((a, b) =>
    a.facultyId.localeCompare(b.facultyId)
  );
}

function checkSoftViolations(assignments: Assignment[]): string[] {
  const warnings: string[] = [];

  const byFacultyDay = new Map<
    string,
    Map<number, Array<{ slot: number; role: Assignment['role'] }>>
  >();

  for (const a of assignments) {
    if (!byFacultyDay.has(a.facultyId))
      byFacultyDay.set(a.facultyId, new Map());
    const m = byFacultyDay.get(a.facultyId)!;
    if (!m.has(a.day)) m.set(a.day, []);
    m.get(a.day)!.push({ slot: a.slot, role: a.role });
  }

  for (const [fid, days] of byFacultyDay) {
    for (const [day, entries] of days) {
      entries.sort((a, b) => a.slot - b.slot);
      for (let i = 0; i < entries.length - 1; i++) {
        const cur = entries[i];
        const nxt = entries[i + 1];
        if (
          nxt.slot - cur.slot === 1 &&
          cur.role === 'regular' &&
          nxt.role === 'regular'
        ) {
          warnings.push(
            `Faculty ${fid}: consecutive regular on day ${day + 1} (slots ${cur.slot + 1} & ${nxt.slot + 1})`
          );
        }
      }
    }
  }

  return warnings;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
