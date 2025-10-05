import type {
  Assignment,
  AssignmentResult,
  DutySlot,
  ExamStructure,
  Faculty,
  UnavailableFaculty,
} from '@/types';

interface FacultyDutyCount {
  facultyId: string;
  targetDuties: number;
  assignedDuties: number;
  bufferDuties: number;
}

interface SlotAssignmentContext {
  day: number;
  slot: number;
  date: string;
  availableFaculty: Faculty[];
  availableRooms: string[];
  regularDutiesNeeded: number;
  relieverDutiesNeeded: number;
  squadDutiesNeeded: number;
  bufferDutiesNeeded: number;
}

export function assignDuties(
  faculty: Faculty[],
  examStructure: ExamStructure,
  unavailability: UnavailableFaculty[]
): AssignmentResult {
  const warnings: string[] = [];
  const assignments: Assignment[] = [];
  const incompleteSlots: AssignmentResult['incompleteSlots'] = [];

  // Step 1: Validate requirements
  const validation = validateAssignmentRequirements(faculty, examStructure);
  if (!validation.valid) {
    return {
      success: false,
      assignments: [],
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  // Step 2: Initialize faculty duty tracking
  const facultyDutyCounts = initializeFacultyDutyCounts(faculty, examStructure);

  // Step 3: Build unavailability map for quick lookups
  const unavailabilityMap = buildUnavailabilityMap(unavailability);

  // Step 4: Process each duty slot
  try {
    for (const dutySlot of examStructure.dutySlots) {
      const slotResult = assignSlotDuties(
        dutySlot,
        faculty,
        facultyDutyCounts,
        unavailabilityMap,
        assignments,
        examStructure
      );

      assignments.push(...slotResult.assignments);
      warnings.push(...slotResult.warnings);

      if (slotResult.incomplete) {
        incompleteSlots.push(slotResult.incomplete);
      }

      // Don't break on errors anymore - always continue
      if (slotResult.errors.length > 0) {
        warnings.push(...slotResult.errors); // Convert errors to warnings
      }
    }

    // Final validation
    const finalValidation = validateFinalAssignments(
      assignments,
      facultyDutyCounts
    );
    warnings.push(...finalValidation.warnings);

    return {
      success: true, // Always succeed
      assignments,
      errors: [],
      warnings,
      incompleteSlots: incompleteSlots.length > 0 ? incompleteSlots : undefined,
    };
  } catch (error) {
    return {
      success: false,
      assignments: [],
      errors: [
        `Assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
      warnings,
    };
  }
}

function validateAssignmentRequirements(
  faculty: Faculty[],
  examStructure: ExamStructure
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (faculty.length === 0) {
    errors.push('No faculty members available for assignment');
    return { valid: false, errors, warnings };
  }

  if (examStructure.dutySlots.length === 0) {
    errors.push('No duty slots configured');
    return { valid: false, errors, warnings };
  }

  // Calculate total duties needed
  const totalRegularDuties = examStructure.dutySlots.reduce(
    (sum, slot) => sum + slot.regularDuties,
    0
  );
  const totalRelieverDuties = examStructure.dutySlots.reduce(
    (sum, slot) => sum + (slot.relieverDuties || 0),
    0
  );
  const totalSquadDuties = examStructure.dutySlots.reduce(
    (sum, slot) => sum + (slot.squadDuties || 0),
    0
  );
  const totalBufferDuties = examStructure.dutySlots.reduce(
    (sum, slot) => sum + slot.bufferDuties,
    0
  );

  const totalMandatoryDuties =
    totalRegularDuties + totalRelieverDuties + totalSquadDuties;

  // Calculate total faculty capacity for ALL mandatory duty types
  const totalFacultyCapacity = faculty.reduce((sum, f) => {
    const regularCapacity =
      examStructure.designationDutyCounts[f.designation] || 0;
    const relieverCapacity =
      examStructure.designationRelieverCounts?.[f.designation] || 0;
    const squadCapacity =
      examStructure.designationSquadCounts?.[f.designation] || 0;
    return sum + regularCapacity + relieverCapacity + squadCapacity;
  }, 0);

  if (totalFacultyCapacity < totalMandatoryDuties) {
    errors.push(
      `Insufficient faculty capacity for mandatory duties. Need ${totalMandatoryDuties} (${totalRegularDuties} regular + ${totalRelieverDuties} reliever + ${totalSquadDuties} squad), but faculty can only handle ${totalFacultyCapacity}`
    );
  }

  // Validate room counts match duty requirements
  for (const slot of examStructure.dutySlots) {
    if (slot.rooms.length !== slot.regularDuties) {
      errors.push(
        `Day ${slot.day + 1} Slot ${slot.slot + 1}: ${slot.rooms.length} rooms provided but ${slot.regularDuties} regular duties needed`
      );
    }
  }

  // Check buffer duty eligibility
  const bufferEligibleFaculty = faculty.filter(
    (f) => examStructure.designationBufferEligibility?.[f.designation]
  );

  if (totalBufferDuties > 0 && bufferEligibleFaculty.length === 0) {
    warnings.push(
      `${totalBufferDuties} buffer duties needed but no designations are enabled for buffer duties.`
    );
  } else if (totalBufferDuties > bufferEligibleFaculty.length) {
    warnings.push(
      `${totalBufferDuties} buffer duties needed but only ${bufferEligibleFaculty.length} faculty from eligible designations available.`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

function initializeFacultyDutyCounts(
  faculty: Faculty[],
  examStructure: ExamStructure
): FacultyDutyCount[] {
  return faculty.map((f) => ({
    facultyId: f.facultyId,
    targetDuties:
      (examStructure.designationDutyCounts[f.designation] || 0) +
      (examStructure.designationRelieverCounts?.[f.designation] || 0) +
      (examStructure.designationSquadCounts?.[f.designation] || 0),
    assignedDuties: 0,
    bufferDuties: 0,
  }));
}

function buildUnavailabilityMap(
  unavailability: UnavailableFaculty[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const unavail of unavailability) {
    if (!map.has(unavail.date)) {
      map.set(unavail.date, new Set());
    }
    map.get(unavail.date)!.add(unavail.facultyId);
  }

  return map;
}

function assignSlotDuties(
  dutySlot: DutySlot,
  allFaculty: Faculty[],
  facultyDutyCounts: FacultyDutyCount[],
  unavailabilityMap: Map<string, Set<string>>,
  existingAssignments: Assignment[],
  examStructure: ExamStructure
): {
  assignments: Assignment[];
  errors: string[];
  warnings: string[];
  incomplete?: {
    day: number;
    slot: number;
    regular: { needed: number; assigned: number };
    reliever: { needed: number; assigned: number };
    squad: { needed: number; assigned: number };
    buffer: { needed: number; assigned: number };
  };
} {
  const assignments: Assignment[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const dateString = dutySlot.date.toISOString().split('T')[0];
  const unavailableToday = unavailabilityMap.get(dateString) || new Set();

  // Get faculty available for this slot
  const availableFaculty = allFaculty.filter(
    (f) => !unavailableToday.has(f.facultyId)
  );

  if (availableFaculty.length === 0) {
    errors.push(
      `Day ${dutySlot.day + 1} Slot ${dutySlot.slot + 1}: No faculty available`
    );
    return { assignments, errors, warnings };
  }

  const context: SlotAssignmentContext = {
    day: dutySlot.day,
    slot: dutySlot.slot,
    date: dateString,
    availableFaculty,
    availableRooms: [...dutySlot.rooms], // Copy for mutation
    regularDutiesNeeded: dutySlot.regularDuties,
    relieverDutiesNeeded: dutySlot.relieverDuties || 0,
    squadDutiesNeeded: dutySlot.squadDuties || 0,
    bufferDutiesNeeded: dutySlot.bufferDuties,
  };

  // Track slot-level assignments to prevent duplicates
  const slotAssignments: Assignment[] = [];

  // Phase 1: Regular duties (with rooms) - MANDATORY
  const regularResult = assignRegularDuties(context, facultyDutyCounts, [
    ...existingAssignments,
    ...slotAssignments,
  ]);
  slotAssignments.push(...regularResult.assignments);
  assignments.push(...regularResult.assignments);
  warnings.push(...regularResult.warnings);
  if (regularResult.errors.length > 0) {
    errors.push(...regularResult.errors);
    return { assignments, errors, warnings };
  }

  // Phase 2: Reliever duties (no rooms) - MANDATORY
  const relieverResult = assignRelieverDuties(context, facultyDutyCounts, [
    ...existingAssignments,
    ...slotAssignments,
  ]);
  slotAssignments.push(...relieverResult.assignments);
  assignments.push(...relieverResult.assignments);
  warnings.push(...relieverResult.warnings);
  if (relieverResult.errors.length > 0) {
    errors.push(...relieverResult.errors);
    return { assignments, errors, warnings }; // STOP on error since mandatory
  }

  // Phase 3: Squad duties (no rooms) - MANDATORY
  const squadResult = assignSquadDuties(context, facultyDutyCounts, [
    ...existingAssignments,
    ...slotAssignments,
  ]);
  slotAssignments.push(...squadResult.assignments);
  assignments.push(...squadResult.assignments);
  warnings.push(...squadResult.warnings);
  if (squadResult.errors.length > 0) {
    errors.push(...squadResult.errors);
    return { assignments, errors, warnings }; // STOP on error since mandatory
  }

  // Phase 4: Buffer duties (no rooms) - OPTIONAL (don't stop on errors)
  const bufferResult = assignBufferDuties(
    context,
    facultyDutyCounts,
    [...existingAssignments, ...slotAssignments],
    examStructure
  );
  slotAssignments.push(...bufferResult.assignments);
  assignments.push(...bufferResult.assignments);
  warnings.push(...bufferResult.warnings);
  errors.push(...bufferResult.errors); // Continue even with buffer errors

  // After all phases, check if slot is complete
  const regularAssigned = slotAssignments.filter(
    (a) => a.role === 'regular'
  ).length;
  const relieverAssigned = slotAssignments.filter(
    (a) => a.role === 'reliever'
  ).length;
  const squadAssigned = slotAssignments.filter(
    (a) => a.role === 'squad'
  ).length;
  const bufferAssigned = slotAssignments.filter(
    (a) => a.role === 'buffer'
  ).length;

  const isIncomplete =
    regularAssigned < context.regularDutiesNeeded ||
    relieverAssigned < context.relieverDutiesNeeded ||
    squadAssigned < context.squadDutiesNeeded ||
    bufferAssigned < context.bufferDutiesNeeded;

  return {
    assignments,
    errors: [],
    warnings,
    incomplete: isIncomplete
      ? {
          day: dutySlot.day,
          slot: dutySlot.slot,
          regular: {
            needed: context.regularDutiesNeeded,
            assigned: regularAssigned,
          },
          reliever: {
            needed: context.relieverDutiesNeeded,
            assigned: relieverAssigned,
          },
          squad: { needed: context.squadDutiesNeeded, assigned: squadAssigned },
          buffer: {
            needed: context.bufferDutiesNeeded,
            assigned: bufferAssigned,
          },
        }
      : undefined,
  };
}

function assignRegularDuties(
  context: SlotAssignmentContext,
  facultyDutyCounts: FacultyDutyCount[],
  existingAssignments: Assignment[]
): { assignments: Assignment[]; errors: string[]; warnings: string[] } {
  const assignments: Assignment[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const { availableRooms } = context;

  for (let i = 0; i < context.regularDutiesNeeded; i++) {
    if (availableRooms.length === 0) {
      errors.push(
        `Day ${context.day + 1} Slot ${context.slot + 1}: No more rooms available for regular duties`
      );
      break;
    }

    // Try without consecutive slots first
    let eligibleFaculty = getEligibleFaculty(
      context,
      facultyDutyCounts,
      [...existingAssignments, ...assignments],
      'regular',
      false // Don't allow consecutive
    );

    // If no one available, relax consecutive slot constraint
    if (eligibleFaculty.length === 0) {
      eligibleFaculty = getEligibleFaculty(
        context,
        facultyDutyCounts,
        [...existingAssignments, ...assignments],
        'regular',
        true // Allow consecutive
      );

      if (eligibleFaculty.length > 0) {
        warnings.push(
          `Day ${context.day + 1} Slot ${context.slot + 1}: Assigned faculty to consecutive slots due to insufficient alternatives for regular duty ${i + 1}`
        );
      }
    }

    if (eligibleFaculty.length === 0) {
      errors.push(
        `Day ${context.day + 1} Slot ${context.slot + 1}: No eligible faculty for regular duty ${i + 1}`
      );
      continue; // Continue trying to fill other duties
    }

    // Select faculty using weighted random (favor those with fewer duties)
    const selectedFaculty = selectFacultyDeterministic(
      eligibleFaculty,
      facultyDutyCounts
    );
    const room = availableRooms.shift()!;

    // Create assignment
    const assignment: Assignment = {
      day: context.day,
      slot: context.slot,
      facultyId: selectedFaculty.facultyId,
      roomNumber: room,
      role: 'regular',
    };

    assignments.push(assignment);

    // Update faculty duty count
    const facultyDutyCount = facultyDutyCounts.find(
      (f) => f.facultyId === selectedFaculty.facultyId
    )!;
    facultyDutyCount.assignedDuties++;
  }

  return { assignments, errors, warnings };
}

function assignRelieverDuties(
  context: SlotAssignmentContext,
  facultyDutyCounts: FacultyDutyCount[],
  existingAssignments: Assignment[]
): { assignments: Assignment[]; errors: string[]; warnings: string[] } {
  const assignments: Assignment[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < context.relieverDutiesNeeded; i++) {
    // First pass: Try with all constraints (no consecutive slots)
    let eligibleFaculty = getEligibleFaculty(
      context,
      facultyDutyCounts,
      [...existingAssignments, ...assignments],
      'reliever',
      false // Don't allow consecutive
    );

    // Second pass: Relax consecutive slot constraint if needed
    if (eligibleFaculty.length === 0) {
      eligibleFaculty = getEligibleFaculty(
        context,
        facultyDutyCounts,
        [...existingAssignments, ...assignments],
        'reliever',
        true // Allow consecutive
      );

      if (eligibleFaculty.length > 0) {
        warnings.push(
          `Day ${context.day + 1} Slot ${context.slot + 1}: Assigned faculty to consecutive slots due to insufficient alternatives for reliever duty ${i + 1}`
        );
      }
    }

    // If still no one available, log error and continue
    if (eligibleFaculty.length === 0) {
      errors.push(
        `Day ${context.day + 1} Slot ${context.slot + 1}: No eligible faculty for reliever duty ${i + 1}`
      );
      continue; // Continue trying to fill other reliever duties
    }

    const selectedFaculty = selectFacultyDeterministic(
      eligibleFaculty,
      facultyDutyCounts
    );

    // Create assignment
    const assignment: Assignment = {
      day: context.day,
      slot: context.slot,
      facultyId: selectedFaculty.facultyId,
      roomNumber: undefined, // No rooms for relievers
      role: 'reliever',
    };

    assignments.push(assignment);

    // Update faculty duty count
    const facultyDutyCount = facultyDutyCounts.find(
      (f) => f.facultyId === selectedFaculty.facultyId
    )!;
    facultyDutyCount.assignedDuties++;
  }

  return { assignments, errors, warnings };
}

function assignSquadDuties(
  context: SlotAssignmentContext,
  facultyDutyCounts: FacultyDutyCount[],
  existingAssignments: Assignment[]
): { assignments: Assignment[]; errors: string[]; warnings: string[] } {
  const assignments: Assignment[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < context.squadDutiesNeeded; i++) {
    // First pass: Try with all constraints (no consecutive slots)
    let eligibleFaculty = getEligibleFaculty(
      context,
      facultyDutyCounts,
      [...existingAssignments, ...assignments],
      'squad',
      false // Don't allow consecutive
    );

    // Second pass: Relax consecutive slot constraint if needed
    if (eligibleFaculty.length === 0) {
      eligibleFaculty = getEligibleFaculty(
        context,
        facultyDutyCounts,
        [...existingAssignments, ...assignments],
        'squad',
        true // Allow consecutive
      );

      if (eligibleFaculty.length > 0) {
        warnings.push(
          `Day ${context.day + 1} Slot ${context.slot + 1}: Assigned faculty to consecutive slots due to insufficient alternatives for squad duty ${i + 1}`
        );
      }
    }

    // If still no one available, log error and continue
    if (eligibleFaculty.length === 0) {
      errors.push(
        `Day ${context.day + 1} Slot ${context.slot + 1}: No eligible faculty for squad duty ${i + 1}`
      );
      continue; // Continue trying to fill other squad duties
    }

    const selectedFaculty = selectFacultyDeterministic(
      eligibleFaculty,
      facultyDutyCounts
    );

    const assignment: Assignment = {
      day: context.day,
      slot: context.slot,
      facultyId: selectedFaculty.facultyId,
      roomNumber: undefined, // No rooms for squad
      role: 'squad',
    };

    assignments.push(assignment);

    const facultyDutyCount = facultyDutyCounts.find(
      (f) => f.facultyId === selectedFaculty.facultyId
    )!;
    facultyDutyCount.assignedDuties++;
  }

  return { assignments, errors, warnings };
}

function assignBufferDuties(
  context: SlotAssignmentContext,
  facultyDutyCounts: FacultyDutyCount[],
  existingAssignments: Assignment[],
  examStructure: ExamStructure
): { assignments: Assignment[]; errors: string[]; warnings: string[] } {
  const assignments: Assignment[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < context.bufferDutiesNeeded; i++) {
    // First pass: Try with all constraints (no consecutive slots)
    let eligibleFaculty = getEligibleFaculty(
      context,
      facultyDutyCounts,
      [...existingAssignments, ...assignments],
      'buffer',
      false // Don't allow consecutive
    ).filter((faculty) => {
      // Filter by buffer eligibility switches
      return (
        examStructure.designationBufferEligibility?.[faculty.designation] ===
        true
      );
    });

    // Second pass: Relax consecutive slot constraint if needed
    if (eligibleFaculty.length === 0) {
      eligibleFaculty = getEligibleFaculty(
        context,
        facultyDutyCounts,
        [...existingAssignments, ...assignments],
        'buffer',
        true // Allow consecutive
      ).filter((faculty) => {
        return (
          examStructure.designationBufferEligibility?.[faculty.designation] ===
          true
        );
      });

      if (eligibleFaculty.length > 0) {
        warnings.push(
          `Day ${context.day + 1} Slot ${context.slot + 1}: Assigned faculty to consecutive slots due to insufficient alternatives for buffer duty ${i + 1}`
        );
      }
    }

    // If still no one available, log warning and continue
    if (eligibleFaculty.length === 0) {
      warnings.push(
        `Day ${context.day + 1} Slot ${context.slot + 1}: No eligible faculty for buffer duty ${i + 1}`
      );
      continue; // Continue trying to fill other buffer duties
    }

    // Select faculty using deterministic selection
    const selectedFaculty = selectFacultyDeterministic(
      eligibleFaculty,
      facultyDutyCounts
    );

    // Create assignment
    const assignment: Assignment = {
      day: context.day,
      slot: context.slot,
      facultyId: selectedFaculty.facultyId,
      roomNumber: undefined,
      role: 'buffer',
    };

    assignments.push(assignment);

    // Update faculty duty counts
    const facultyDutyCount = facultyDutyCounts.find(
      (f) => f.facultyId === selectedFaculty.facultyId
    )!;
    facultyDutyCount.assignedDuties++;
    facultyDutyCount.bufferDuties++;
  }

  return { assignments, errors, warnings };
}

function getEligibleFaculty(
  context: SlotAssignmentContext,
  facultyDutyCounts: FacultyDutyCount[],
  existingAssignments: Assignment[],
  role: 'regular' | 'reliever' | 'squad' | 'buffer',
  allowConsecutive: boolean = false
): Faculty[] {
  // Get faculty already assigned in this specific slot
  const slotAssignments = existingAssignments.filter(
    (a) => a.day === context.day && a.slot === context.slot
  );
  const alreadyAssignedInSlot = new Set(
    slotAssignments.map((a) => a.facultyId)
  );

  // Count faculty with remaining capacity (only for non-buffer roles)
  const facultyWithRemainingCapacity =
    role !== 'buffer'
      ? facultyDutyCounts.filter((f) => f.assignedDuties < f.targetDuties)
          .length
      : 0;

  return context.availableFaculty.filter((faculty) => {
    // Prevent duplicate assignments in same slot (HARD CONSTRAINT)
    if (alreadyAssignedInSlot.has(faculty.facultyId)) {
      return false;
    }

    const dutyCount = facultyDutyCounts.find(
      (f) => f.facultyId === faculty.facultyId
    )!;

    // Buffer duty limit (HARD CONSTRAINT - max 1 per faculty across entire exam)
    if (role === 'buffer' && dutyCount.bufferDuties >= 1) {
      return false;
    }

    // Consecutive slots constraint (SOFT - only enforce if allowConsecutive=false)
    if (
      !allowConsecutive &&
      hasConsecutiveSlotConflict(
        faculty.facultyId,
        context,
        existingAssignments
      )
    ) {
      return false;
    }

    // Target enforcement logic - SKIP FOR BUFFER DUTIES
    if (role !== 'buffer') {
      // For mandatory roles (regular, reliever, squad): enforce targets
      if (
        dutyCount.assignedDuties >= dutyCount.targetDuties &&
        facultyWithRemainingCapacity > 5
      ) {
        return false;
      }
    }
    // Buffer duties ignore target limits entirely - they're bonus duties on top of targets

    return true;
  });
}

function hasConsecutiveSlotConflict(
  facultyId: string,
  context: SlotAssignmentContext,
  existingAssignments: Assignment[]
): boolean {
  // Check if faculty is already assigned to adjacent slots on the same day
  const dayAssignments = existingAssignments.filter(
    (a) => a.facultyId === facultyId && a.day === context.day
  );

  for (const assignment of dayAssignments) {
    // Check if this slot is consecutive to any existing assignment
    if (Math.abs(assignment.slot - context.slot) === 1) {
      return true;
    }
  }

  return false;
}

function selectFacultyDeterministic(
  eligibleFaculty: Faculty[],
  facultyDutyCounts: FacultyDutyCount[]
): Faculty {
  // Sort by: 1) furthest behind target, 2) lowest total duties assigned, 3) faculty ID for consistency
  const sorted = eligibleFaculty
    .map((faculty) => {
      const dutyCount = facultyDutyCounts.find(
        (f) => f.facultyId === faculty.facultyId
      )!;
      return {
        faculty,
        dutyCount,
        deficit: dutyCount.targetDuties - dutyCount.assignedDuties, // How far behind target
        totalAssigned: dutyCount.assignedDuties,
      };
    })
    .sort((a, b) => {
      // Primary: Highest deficit (furthest behind target)
      if (a.deficit !== b.deficit) {
        return b.deficit - a.deficit;
      }
      // Secondary: Lowest total duties assigned
      if (a.totalAssigned !== b.totalAssigned) {
        return a.totalAssigned - b.totalAssigned;
      }
      // Tertiary: Consistent tie-breaking by faculty ID
      return a.faculty.facultyId.localeCompare(b.faculty.facultyId);
    });

  return sorted[0].faculty;
}

function validateFinalAssignments(
  assignments: Assignment[],
  facultyDutyCounts: FacultyDutyCount[]
): { warnings: string[] } {
  const warnings: string[] = [];

  // Check if any faculty didn't meet their target duties
  for (const dutyCount of facultyDutyCounts) {
    if (dutyCount.assignedDuties < dutyCount.targetDuties) {
      warnings.push(
        `Faculty ${dutyCount.facultyId} assigned ${dutyCount.assignedDuties}/${dutyCount.targetDuties} duties`
      );
    }
  }

  // Check for any constraint violations (should not happen if algorithm is correct)
  const violationCheck = checkConstraintViolations(assignments);
  warnings.push(...violationCheck);

  return { warnings };
}

function checkConstraintViolations(assignments: Assignment[]): string[] {
  const violations: string[] = [];

  // Group assignments by faculty and day
  const facultyDaySlots = new Map<string, Map<number, number[]>>();

  for (const assignment of assignments) {
    if (!facultyDaySlots.has(assignment.facultyId)) {
      facultyDaySlots.set(assignment.facultyId, new Map());
    }

    const facultyDays = facultyDaySlots.get(assignment.facultyId)!;
    if (!facultyDays.has(assignment.day)) {
      facultyDays.set(assignment.day, []);
    }

    facultyDays.get(assignment.day)!.push(assignment.slot);
  }

  // Check for consecutive slot violations
  for (const [facultyId, daySlots] of facultyDaySlots) {
    for (const [day, slots] of daySlots) {
      slots.sort((a, b) => a - b);

      for (let i = 0; i < slots.length - 1; i++) {
        if (slots[i + 1] - slots[i] === 1) {
          violations.push(
            `Faculty ${facultyId} has consecutive slots ${slots[i]} and ${slots[i + 1]} on day ${day}`
          );
        }
      }
    }
  }

  // Check buffer duty violations
  const bufferCounts = new Map<string, number>();
  for (const assignment of assignments) {
    if (assignment.role === 'buffer') {
      bufferCounts.set(
        assignment.facultyId,
        (bufferCounts.get(assignment.facultyId) || 0) + 1
      );
    }
  }

  for (const [facultyId, count] of bufferCounts) {
    if (count > 1) {
      violations.push(
        `Faculty ${facultyId} has ${count} buffer duties (max 1 allowed)`
      );
    }
  }

  return violations;
}

// Utility function for testing/debugging
export function getAssignmentStats(
  assignments: Assignment[],
  faculty: Faculty[]
): Record<string, { regular: number; buffer: number; total: number }> {
  const stats: Record<
    string,
    { regular: number; buffer: number; total: number }
  > = {};

  // Initialize all faculty
  for (const f of faculty) {
    stats[f.facultyId] = { regular: 0, buffer: 0, total: 0 };
  }

  // Count assignments
  for (const assignment of assignments) {
    if (!stats[assignment.facultyId]) {
      stats[assignment.facultyId] = { regular: 0, buffer: 0, total: 0 };
    }

    const stat = stats[assignment.facultyId];
    if (assignment.role === 'buffer') {
      stat.buffer++;
    } else {
      stat.regular++;
    }
    stat.total++;
  }

  return stats;
}
