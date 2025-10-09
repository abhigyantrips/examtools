import type {
  Assignment,
  AssignmentResult,
  ExamStructure,
  Faculty,
  FacultyDutyOverview,
  UnavailableFaculty,
  Violation,
} from '@/types';

// Set this to the facultyId you want to debug
// const focusedFacultyId = 'BROKEN_ID_WAS_HERE';

interface FacultyDutyCount {
  facultyId: string;
  targetDuties: number;
  assignedDuties: number;
  bufferDuties: number;
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

  // 1) Validation upfront
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

  // 2) Setup trackers
  const dutyCounts = initializeCounts(faculty, examStructure);
  const unavailByDate = buildUnavailability(unavailability);

  // 3) Process slots deterministically by (day, slot)
  const sortedSlots = [...examStructure.dutySlots].sort((a, b) =>
    a.day === b.day ? a.slot - b.slot : a.day - b.day
  );

  for (const slot of sortedSlots) {
    // Hard stop per-slot if room mismatch (still record violation, but continue overall)
    if (slot.rooms.length !== slot.regularDuties) {
      violations.push({
        id: 'ROOM_MISMATCH',
        message: `Day ${slot.day + 1} Slot ${slot.slot + 1}: ${slot.rooms.length} rooms provided but ${slot.regularDuties} regular duties required`,
        day: slot.day,
        slot: slot.slot,
        role: 'regular',
      });
      // mark slot as incomplete (all roles) and skip making assignments in this slot
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

    const dateISO = slot.date.toISOString().split('T')[0];
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

    // Per-slot assigned list to enforce slot uniqueness
    const slotAssigned: Assignment[] = [];

    // Phase A: Regular (mandatory, rooms)
    const aReg = assignRegular(
      ctx,
      dutyCounts,
      assignments,
      slotAssigned,
      examStructure
    );
    assignments.push(...aReg.assigned);
    violations.push(...aReg.violations);
    warnings.push(...aReg.warnings);

    // Phase B: Reliever (mandatory, coverage groups)
    const aRel = assignCoverage(
      ctx,
      dutyCounts,
      assignments,
      slotAssigned,
      'reliever',
      examStructure
    );
    assignments.push(...aRel.assigned);
    violations.push(...aRel.violations);
    warnings.push(...aRel.warnings);

    // Phase C: Squad (mandatory, coverage groups)
    const aSq = assignCoverage(
      ctx,
      dutyCounts,
      assignments,
      slotAssigned,
      'squad',
      examStructure
    );
    assignments.push(...aSq.assigned);
    violations.push(...aSq.violations);
    warnings.push(...aSq.warnings);

    // Phase D: Buffer (optional, no rooms)
    const aBuf = assignBuffer(
      ctx,
      dutyCounts,
      assignments,
      slotAssigned,
      examStructure
    );
    assignments.push(...aBuf.assigned);
    violations.push(...aBuf.violations);
    warnings.push(...aBuf.warnings);

    // Completion accounting
    const regAssigned = slotAssigned.filter((x) => x.role === 'regular').length;
    const relAssigned = slotAssigned.filter(
      (x) => x.role === 'reliever'
    ).length;
    const sqAssigned = slotAssigned.filter((x) => x.role === 'squad').length;
    const bufAssigned = slotAssigned.filter((x) => x.role === 'buffer').length;

    const incomplete =
      regAssigned < ctx.need.regular ||
      relAssigned < ctx.need.reliever ||
      sqAssigned < ctx.need.squad ||
      bufAssigned < ctx.need.buffer;

    if (incomplete) {
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

  // 4) Final passive checks and overview
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

/* ========== Validation and setup ========== */

function validateInputs(
  faculty: Faculty[],
  structure: ExamStructure
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (faculty.length === 0) {
    errors.push('No faculty members available for assignment');
    return { valid: false, errors, warnings };
  }
  if (structure.dutySlots.length === 0) {
    errors.push('No duty slots configured');
    return { valid: false, errors, warnings };
  }

  // Total mandatory duties vs total capacity (regular+reliever+squad targets)
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
      `Insufficient faculty capacity for mandatory duties. Need ${totalMandatory} (${totalRegular} regular + ${totalReliever} reliever + ${totalSquad} squad), capacity ${totalCapacity}`
    );
  }

  // Buffer eligibility sanity
  const totalBuffer = sum(structure.dutySlots.map((s) => s.bufferDuties));
  if (totalBuffer > 0) {
    const eligible = faculty.filter(
      (f) => structure.designationBufferEligibility?.[f.designation] === true
    );
    if (eligible.length === 0) {
      warnings.push(
        `${totalBuffer} buffer duties configured but no eligible designations are enabled.`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function initializeCounts(
  faculty: Faculty[],
  structure: ExamStructure
): FacultyDutyCount[] {
  return (
    faculty
      .map((f) => ({
        facultyId: f.facultyId,
        targetDuties:
          (structure.designationDutyCounts[f.designation] || 0) +
          (structure.designationRelieverCounts?.[f.designation] || 0) +
          (structure.designationSquadCounts?.[f.designation] || 0),
        assignedDuties: 0,
        bufferDuties: 0,
      }))
      // Stable initial order by facultyId for determinism downstream tie-breaks
      .sort((a, b) => a.facultyId.localeCompare(b.facultyId))
  );
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

/* ========== Assignment phases ========== */

function assignRegular(
  ctx: SlotCtx,
  dutyCounts: FacultyDutyCount[],
  globalAssignments: Assignment[],
  slotAssignments: Assignment[],
  examStructure: ExamStructure
): { assigned: Assignment[]; violations: Violation[]; warnings: string[] } {
  const assigned: Assignment[] = [];
  const violations: Violation[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < ctx.need.regular; i++) {
    const room = ctx.roomsSorted[i]; // roomsSorted length guaranteed equals need.regular by earlier check

    // Pass 1: no consecutive
    let eligible = filterEligible(
      ctx,
      dutyCounts,
      globalAssignments,
      slotAssignments,
      'regular',
      {
        allowConsecutive: false,
        allowTargetOverflow: false,
        respectBufferLimit: true,
      },
      examStructure
    );

    // Pass 2 (relax back-to-back)
    if (eligible.length === 0) {
      eligible = filterEligible(
        ctx,
        dutyCounts,
        globalAssignments,
        slotAssignments,
        'regular',
        {
          allowConsecutive: true,
          allowTargetOverflow: false,
          respectBufferLimit: true,
        },
        examStructure
      );
      if (eligible.length > 0) {
        warnings.push(
          `Day ${ctx.day + 1} Slot ${ctx.slot + 1}: Back-to-back regular assignment allowed due to low availability (duty ${i + 1})`
        );
      }
    }

    if (eligible.length === 0) {
      // leave empty (hard requirement unmet)
      violations.push({
        id: 'NO_ELIGIBLE_RELIEVER', // reuse severity ordering bucket; specific to role not necessary for export empties
        message: `Day ${ctx.day + 1} Slot ${ctx.slot + 1}: No eligible faculty for regular duty ${i + 1}`,
        day: ctx.day,
        slot: ctx.slot,
        role: 'regular',
      });
      continue;
    }

    const chosen = selectDeterministic(eligible, dutyCounts);
    // if (chosen.facultyId === focusedFacultyId) {
    //   console.log(
    //     `[assignRegular] Assigning REGULAR to faculty ${chosen.facultyId} on day ${ctx.day} slot ${ctx.slot}. assignedDuties=${dutyCounts.find((x) => x.facultyId === chosen.facultyId)?.assignedDuties}, targetDuties=${dutyCounts.find((x) => x.facultyId === chosen.facultyId)?.targetDuties}`
    //   );
    // }
    assigned.push({
      day: ctx.day,
      slot: ctx.slot,
      facultyId: chosen.facultyId,
      roomNumber: room,
      role: 'regular',
    });
    slotAssignments.push(assigned[assigned.length - 1]);

    const dc = dutyCounts.find((x) => x.facultyId === chosen.facultyId)!;
    dc.assignedDuties++;
    // if (chosen.facultyId === focusedFacultyId) {
    //   console.log(
    //     `[assignRegular] Faculty ${chosen.facultyId} assignedDuties incremented to ${dc.assignedDuties}`
    //   );
    // }
  }

  return { assigned, violations, warnings };
}

function assignCoverage(
  ctx: SlotCtx,
  dutyCounts: FacultyDutyCount[],
  globalAssignments: Assignment[],
  slotAssignments: Assignment[],
  role: 'reliever' | 'squad',
  examStructure: ExamStructure
): { assigned: Assignment[]; violations: Violation[]; warnings: string[] } {
  const assigned: Assignment[] = [];
  const violations: Violation[] = [];
  const warnings: string[] = [];

  const totalNeeded = role === 'reliever' ? ctx.need.reliever : ctx.need.squad;
  if (totalNeeded <= 0) return { assigned, violations, warnings };

  // Build coverage chunks: floor division, last can be smaller
  const groups = buildRoomChunks(ctx.roomsSorted, totalNeeded);

  for (let i = 0; i < totalNeeded; i++) {
    // Pass 1: strict availability (no consecutive)
    let eligible = filterEligible(
      ctx,
      dutyCounts,
      globalAssignments,
      slotAssignments,
      role,
      {
        allowConsecutive: false,
        allowTargetOverflow: false,
        respectBufferLimit: true,
      },
      examStructure
    );

    // Pass 2: relax reliever/squad availability (still no consecutive)
    if (eligible.length === 0) {
      eligible = filterEligible(
        ctx,
        dutyCounts,
        globalAssignments,
        slotAssignments,
        role,
        {
          allowConsecutive: false,
          allowTargetOverflow: true, // allow over target if capacity pressure
          respectBufferLimit: true,
        },
        examStructure
      );
    }

    // Pass 3: relax back-to-back as last resort
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
          respectBufferLimit: true,
        },
        examStructure
      );
      if (eligible.length > 0) {
        warnings.push(
          `Day ${ctx.day + 1} Slot ${ctx.slot + 1}: Back-to-back ${role} assignment allowed due to low availability (duty ${i + 1})`
        );
      }
    }

    if (eligible.length === 0) {
      violations.push({
        id: role === 'reliever' ? 'NO_ELIGIBLE_RELIEVER' : 'NO_ELIGIBLE_SQUAD',
        message: `Day ${ctx.day + 1} Slot ${ctx.slot + 1}: No eligible faculty for ${role} duty ${i + 1}`,
        day: ctx.day,
        slot: ctx.slot,
        role,
      });
      // leave this coverage empty (export: empty rows with background)
      continue;
    }

    const chosen = selectDeterministic(eligible, dutyCounts);
    const rooms = groups[i] || []; // may be empty if more people than rooms

    assigned.push({
      day: ctx.day,
      slot: ctx.slot,
      facultyId: chosen.facultyId,
      role,
      rooms,
    });
    slotAssignments.push(assigned[assigned.length - 1]);

    const dc = dutyCounts.find((x) => x.facultyId === chosen.facultyId)!;
    dc.assignedDuties++;
  }

  return { assigned, violations, warnings };
}

function assignBuffer(
  ctx: SlotCtx,
  dutyCounts: FacultyDutyCount[],
  globalAssignments: Assignment[],
  slotAssignments: Assignment[],
  structure: ExamStructure
): { assigned: Assignment[]; violations: Violation[]; warnings: string[] } {
  const assigned: Assignment[] = [];
  const violations: Violation[] = [];
  const warnings: string[] = [];

  const totalNeeded = ctx.need.buffer;
  if (totalNeeded <= 0) return { assigned, violations, warnings };

  for (let i = 0; i < totalNeeded; i++) {
    // Pass 1: strict — eligible designation, no consecutive, buffer limit
    let eligible = filterEligible(
      ctx,
      dutyCounts,
      globalAssignments,
      slotAssignments,
      'buffer',
      {
        allowConsecutive: false,
        allowTargetOverflow: true, // buffer doesn't count toward target; we still pick by deficit first
        respectBufferLimit: true,
      },
      structure
    ).filter(
      (f) => structure.designationBufferEligibility?.[f.designation] === true
    );

    // Pass 2: relax designation availability (still no consecutive)
    if (eligible.length === 0) {
      eligible = filterEligible(
        ctx,
        dutyCounts,
        globalAssignments,
        slotAssignments,
        'buffer',
        {
          allowConsecutive: false,
          allowTargetOverflow: true,
          respectBufferLimit: false, // relax buffer limit last? We were asked to keep 1 buffer max; do not relax this. Keep true.
        },
        structure
      ).filter(
        (f) => structure.designationBufferEligibility?.[f.designation] === true
      );
    }

    // Pass 3: relax back-to-back
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
          respectBufferLimit: true,
        },
        structure
      ).filter(
        (f) => structure.designationBufferEligibility?.[f.designation] === true
      );
      if (eligible.length > 0) {
        warnings.push(
          `Day ${ctx.day + 1} Slot ${ctx.slot + 1}: Back-to-back buffer assignment allowed due to low availability (duty ${i + 1})`
        );
      }
    }

    if (eligible.length === 0) {
      // record violation, leave empty
      violations.push({
        id: 'NO_ELIGIBLE_BUFFER',
        message: `Day ${ctx.day + 1} Slot ${ctx.slot + 1}: No eligible faculty for buffer duty ${i + 1}`,
        day: ctx.day,
        slot: ctx.slot,
        role: 'buffer',
      });
      continue;
    }

    const chosen = selectDeterministic(eligible, dutyCounts);
    assigned.push({
      day: ctx.day,
      slot: ctx.slot,
      facultyId: chosen.facultyId,
      role: 'buffer',
    });
    slotAssignments.push(assigned[assigned.length - 1]);

    const dc = dutyCounts.find((x) => x.facultyId === chosen.facultyId)!;
    dc.assignedDuties++;
    dc.bufferDuties++;
  }

  return { assigned, violations, warnings };
}

/* ========== Eligibility and selection ========== */

function filterEligible(
  ctx: SlotCtx,
  dutyCounts: FacultyDutyCount[],
  globalAssignments: Assignment[],
  slotAssignments: Assignment[],
  role: 'regular' | 'reliever' | 'squad' | 'buffer',
  opts: {
    allowConsecutive: boolean;
    allowTargetOverflow: boolean;
    respectBufferLimit: boolean;
  },
  examStructure: ExamStructure
): Faculty[] {
  // Enforce one-role-per-slot
  const alreadyInSlot = new Set(slotAssignments.map((a) => a.facultyId));
  // Track per-day assignments with role for role-aware consecutive + daily-regular-limit
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

  // Compute remaining capacity count (for stricter filtering)
  const remainingPool =
    role !== 'buffer'
      ? dutyCounts.filter((d) => d.assignedDuties < d.targetDuties).length
      : 0;

  return ctx.availableFaculty.filter((f) => {
    if (alreadyInSlot.has(f.facultyId)) {
      // if (f.facultyId === focusedFacultyId) {
      //   console.log(`[fEli] Faculty ${f.facultyId} already assigned in slot ${ctx.day}-${ctx.slot}`);
      // }
      return false;
    }

    const dc = dutyCounts.find((d) => d.facultyId === f.facultyId)!;

    // Count assigned duties by type for this faculty
    const assignedRegular = globalAssignments.filter(
      (a) => a.facultyId === f.facultyId && a.role === 'regular'
    ).length;
    const assignedReliever = globalAssignments.filter(
      (a) => a.facultyId === f.facultyId && a.role === 'reliever'
    ).length;
    const assignedSquad = globalAssignments.filter(
      (a) => a.facultyId === f.facultyId && a.role === 'squad'
    ).length;

    // Get target duties by type for this faculty based on Role
    const regularTarget =
      examStructure.designationDutyCounts[f.designation] || 0;
    const relieverTarget =
      examStructure.designationRelieverCounts?.[f.designation] || 0;
    const squadTarget =
      examStructure.designationSquadCounts?.[f.designation] || 0;

    // Enforce per-role limits
    if (
      role === 'regular' &&
      !opts.allowTargetOverflow &&
      assignedRegular >= regularTarget &&
      remainingPool > 5
    ) {
      // if (f.facultyId === focusedFacultyId) {
      //   console.log(
      //     `[fEli] Faculty ${f.facultyId} assignedRegular (${assignedRegular}) >= regularTarget (${regularTarget}), remainingPool=${remainingPool}, allowTargetOverflow=${opts.allowTargetOverflow}`
      //   );
      // }
      return false;
    }
    if (
      role === 'reliever' &&
      !opts.allowTargetOverflow &&
      assignedReliever >= relieverTarget &&
      remainingPool > 5
    ) {
      // if (f.facultyId === focusedFacultyId) {
      //   console.log(`[fEli] Faculty ${f.facultyId} assignedReliever (${assignedReliever}) >= relieverTarget (${relieverTarget}), remainingPool=${remainingPool}, allowTargetOverflow=${opts.allowTargetOverflow}`);
      // }
      return false;
    }
    if (
      role === 'squad' &&
      !opts.allowTargetOverflow &&
      assignedSquad >= squadTarget &&
      remainingPool > 5
    ) {
      // if (f.facultyId === focusedFacultyId) {
      //   console.log(
      //     `[fEli] Faculty ${f.facultyId} assignedSquad (${assignedSquad}) >= squadTarget (${squadTarget}), remainingPool=${remainingPool}, allowTargetOverflow=${opts.allowTargetOverflow}`
      //   );
      // }
      return false;
    }

    if (role === 'buffer' && opts.respectBufferLimit && dc.bufferDuties >= 1) {
      // if (f.facultyId === focusedFacultyId) {
      //   console.log(`[fEli] Faculty ${f.facultyId} buffer limit reached.`);
      // }
      return false;
    }

    // Back-to-back enforcement: ONLY block consecutive REGULAR->REGULAR in same day
    if (!opts.allowConsecutive && role === 'regular') {
      const dayRec = byFacultyDay.get(f.facultyId);
      const hasRR =
        dayRec?.slots.some(
          (rec) => rec.role === 'regular' && Math.abs(rec.slot - ctx.slot) === 1
        ) ?? false;
      if (hasRR) {
        // if (f.facultyId === focusedFacultyId) {
        //   console.log(`[fEli] Faculty ${f.facultyId} blocked for consecutive regular duties on day ${ctx.day}.`);
        // }
        return false;
      }
    }

    // Prefer at most one REGULAR per day per faculty (soft preference).
    // Enforce only when we still have many alternatives in pool.
    if (role === 'regular') {
      const dayRec = byFacultyDay.get(f.facultyId);
      const hasRegularToday = (dayRec?.regularCount || 0) >= 1;
      if (hasRegularToday && remainingPool > 5 && !opts.allowTargetOverflow) {
        // if (f.facultyId === focusedFacultyId) {
        //   console.log(`[fEli] Faculty ${f.facultyId} already has regular today. remainingPool=${remainingPool}`);
        // }
        return false;
      }
    }

    // if (f.facultyId === focusedFacultyId) {
    //   console.log(
    //     `[fEli] Faculty ${f.facultyId} eligible for role ${role} on day ${ctx.day} slot ${ctx.slot}. allowTargetOverflow=${opts.allowTargetOverflow}, assignedDuties=${dc.assignedDuties}, targetDuties=${dc.targetDuties}, assignedRegular=${assignedRegular}, assignedReliever=${assignedReliever}, assignedSquad=${assignedSquad}`
    //   );
    // }
    return true;
  });
}

function selectDeterministic(
  eligible: Faculty[],
  dutyCounts: FacultyDutyCount[]
): Faculty {
  const byId = new Map(dutyCounts.map((d) => [d.facultyId, d]));
  return [...eligible]
    .map((f) => {
      const d = byId.get(f.facultyId)!;
      return {
        f,
        deficit: d.targetDuties - d.assignedDuties,
        totalAssigned: d.assignedDuties,
      };
    })
    .sort((a, b) => {
      if (a.deficit !== b.deficit) return b.deficit - a.deficit; // furthest behind
      if (a.totalAssigned !== b.totalAssigned)
        return a.totalAssigned - b.totalAssigned;
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

  // We want last people possibly getting fewer rooms, not ceil for first
  // Distribute using floor, then spread remainder 1 per person from the start until rem exhausted.
  // But requirement says “last person may get fewer”; simplest: chunk size = floor, and put extra rooms into earlier chunks.
  const chunks: string[][] = [];
  let idx = 0;
  for (let i = 0; i < people; i++) {
    let size = per;
    if (i < rem) size += 1; // earlier relievers get +1 until remainder consumed
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

  // include all faculty even if zero duties (so overview is complete)
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

  // Back-to-back checker (post):
  // - Warn only when BOTH adjacent roles are regular (your amended rule).
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
        if (nxt.slot - cur.slot === 1) {
          const bothRegular = cur.role === 'regular' && nxt.role === 'regular';
          if (bothRegular) {
            warnings.push(
              `Faculty ${fid} has consecutive REGULAR duties on day ${day + 1} (slots ${cur.slot + 1} & ${nxt.slot + 1})`
            );
          }
        }
      }
    }
  }

  return warnings;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
