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
  const errors: string[] = [];
  const warnings: string[] = [];
  const assignments: Assignment[] = [];

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
        assignments
      );

      assignments.push(...slotResult.assignments);
      warnings.push(...slotResult.warnings);

      if (slotResult.errors.length > 0) {
        errors.push(...slotResult.errors);
        break; // Stop on critical errors
      }
    }

    // Step 5: Final validation
    const finalValidation = validateFinalAssignments(
      assignments,
      facultyDutyCounts
    );
    warnings.push(...finalValidation.warnings);

    return {
      success: errors.length === 0,
      assignments,
      errors,
      warnings,
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

  // Group slots by day for better error messages
  const slotsByDay = new Map<number, DutySlot[]>();
  examStructure.dutySlots.forEach((slot) => {
    if (!slotsByDay.has(slot.day)) {
      slotsByDay.set(slot.day, []);
    }
    slotsByDay.get(slot.day)!.push(slot);
  });

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

  // Check faculty capacity against mandatory duties first
  const designationCounts = examStructure.designationDutyCounts;
  const totalFacultyCapacity = faculty.reduce((sum, f) => {
    return sum + (designationCounts[f.designation] || 0);
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

  // Check for buffer duty constraint violations (max 1 per faculty)
  if (totalBufferDuties > faculty.length) {
    warnings.push(
      `${totalBufferDuties} buffer duties needed but only ${faculty.length} faculty available. Some faculty may get multiple buffer duties.`
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
      (examStructure.designationSquadCounts?.[f.designation] || 0) +
      (examStructure.designationBufferCounts?.[f.designation] || 0),
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
  existingAssignments: Assignment[]
): { assignments: Assignment[]; errors: string[]; warnings: string[] } {
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

  // Phase 1: Regular duties (with rooms) - MANDATORY
  const regularResult = assignRegularDuties(
    context,
    facultyDutyCounts,
    existingAssignments
  );
  assignments.push(...regularResult.assignments);
  warnings.push(...regularResult.warnings);
  if (regularResult.errors.length > 0) {
    errors.push(...regularResult.errors);
    return { assignments, errors, warnings };
  }

  // Phase 2: Reliever duties (no rooms) - MANDATORY
  const relieverResult = assignRelieverDuties(
    context,
    facultyDutyCounts,
    existingAssignments
  );
  assignments.push(...relieverResult.assignments);
  warnings.push(...relieverResult.warnings);
  if (relieverResult.errors.length > 0) {
    errors.push(...relieverResult.errors);
    return { assignments, errors, warnings }; // STOP on error since mandatory
  }

  // Phase 3: Squad duties (no rooms) - MANDATORY
  const squadResult = assignSquadDuties(
    context,
    facultyDutyCounts,
    existingAssignments
  );
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
    existingAssignments
  );
  assignments.push(...bufferResult.assignments);
  warnings.push(...bufferResult.warnings);
  errors.push(...bufferResult.errors); // Continue even with buffer errors

  return { assignments, errors, warnings };
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

    const eligibleFaculty = getEligibleFaculty(
      context,
      facultyDutyCounts,
      existingAssignments,
      'regular'
    );

    if (eligibleFaculty.length === 0) {
      errors.push(
        `Day ${context.day + 1} Slot ${context.slot + 1}: No eligible faculty for regular duty ${i + 1}`
      );
      break;
    }

    // Select faculty using weighted random (favor those with fewer duties)
    const selectedFaculty = selectFacultyDeterministic(
      eligibleFaculty,
      facultyDutyCounts
    );
    const room = availableRooms.shift()!; // Remove room from available list

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
    const eligibleFaculty = getEligibleFaculty(
      context,
      facultyDutyCounts,
      [...existingAssignments, ...assignments], // Include assignments from this function
      'reliever'
    );

    if (eligibleFaculty.length === 0) {
      errors.push(
        `Day ${context.day + 1} Slot ${context.slot + 1}: No eligible faculty for reliever duty ${i + 1}`
      );
      break; // MANDATORY - stop if we can't fulfill
    }

    const selectedFaculty = selectFacultyDeterministic(
      eligibleFaculty,
      facultyDutyCounts
    );

    // Create assignment with new role field
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
    const eligibleFaculty = getEligibleFaculty(
      context,
      facultyDutyCounts,
      [...existingAssignments, ...assignments],
      'squad'
    );

    if (eligibleFaculty.length === 0) {
      errors.push(
        `Day ${context.day + 1} Slot ${context.slot + 1}: No eligible faculty for squad duty ${i + 1}`
      );
      break; // MANDATORY - stop if we can't fulfill
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
  existingAssignments: Assignment[]
): { assignments: Assignment[]; errors: string[]; warnings: string[] } {
  const assignments: Assignment[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < context.bufferDutiesNeeded; i++) {
    const eligibleFaculty = getEligibleFaculty(
      context,
      facultyDutyCounts,
      existingAssignments,
      'buffer'
    );

    if (eligibleFaculty.length === 0) {
      warnings.push(
        `Day ${context.day + 1} Slot ${context.slot + 1}: No eligible faculty for buffer duty ${i + 1}`
      );
      continue;
    }

    // Select faculty using weighted random
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
  role: 'regular' | 'reliever' | 'squad' | 'buffer'
): Faculty[] {
  // Count faculty with remaining capacity
  const facultyWithRemainingCapacity = facultyDutyCounts.filter(
    (f) => f.assignedDuties < f.targetDuties
  ).length;

  // Only buffer duties have the 1-per-faculty limit
  const facultyWithRemainingBufferCapacity =
    role === 'buffer'
      ? facultyDutyCounts.filter((f) => f.bufferDuties < 1).length
      : 0;

  return context.availableFaculty.filter((faculty) => {
    const dutyCount = facultyDutyCounts.find(
      (f) => f.facultyId === faculty.facultyId
    )!;

    // Buffer duty limit (max 1 per faculty across entire exam)
    if (role === 'buffer' && dutyCount.bufferDuties >= 1) {
      return false;
    }

    // Consecutive slots constraint
    if (
      hasConsecutiveSlotConflict(
        faculty.facultyId,
        context,
        existingAssignments
      )
    ) {
      return false;
    }

    // Target enforcement logic
    if (role !== 'buffer') {
      // For mandatory roles (regular, reliever, squad): stricter enforcement
      if (
        dutyCount.assignedDuties >= dutyCount.targetDuties &&
        facultyWithRemainingCapacity > 5
      ) {
        return false;
      }
    } else {
      // For buffer: even stricter
      if (
        dutyCount.assignedDuties >= dutyCount.targetDuties &&
        facultyWithRemainingBufferCapacity > 2
      ) {
        return false;
      }
    }

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
