import type { Assignment, DutySlot, Faculty } from '@/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAssignmentAdd(
  newAssignment: Assignment,
  allAssignments: Assignment[],
  slot: DutySlot,
  faculty: Faculty[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if faculty already has a duty in this slot
  const existingInSlot = allAssignments.find(
    (a) =>
      a.day === newAssignment.day &&
      a.slot === newAssignment.slot &&
      a.facultyId === newAssignment.facultyId
  );

  if (existingInSlot) {
    errors.push(
      `Faculty is already assigned as ${existingInSlot.role.toUpperCase()} in this slot`
    );
  }

  // Check if room is already taken (for regular duties)
  if (newAssignment.role === 'regular' && newAssignment.roomNumber) {
    const roomTaken = allAssignments.find(
      (a) =>
        a.day === newAssignment.day &&
        a.slot === newAssignment.slot &&
        a.role === 'regular' &&
        a.roomNumber === newAssignment.roomNumber
    );

    if (roomTaken) {
      const facultyMember = faculty.find(
        (f) => f.facultyId === roomTaken.facultyId
      );
      errors.push(
        `Room ${newAssignment.roomNumber} is already assigned to ${facultyMember?.facultyName || roomTaken.facultyId}`
      );
    }

    // Check if room exists in slot
    if (!slot.rooms.includes(newAssignment.roomNumber)) {
      errors.push(
        `Room ${newAssignment.roomNumber} is not available in this slot`
      );
    }
  }

  // Warn if exceeding slot capacity
  const roleKey =
    newAssignment.role === 'regular'
      ? 'regularDuties'
      : newAssignment.role === 'reliever'
        ? 'relieverDuties'
        : newAssignment.role === 'squad'
          ? 'squadDuties'
          : 'bufferDuties';

  const currentCount = allAssignments.filter(
    (a) =>
      a.day === newAssignment.day &&
      a.slot === newAssignment.slot &&
      a.role === newAssignment.role
  ).length;

  const needed = slot[roleKey];
  if (currentCount >= needed) {
    warnings.push(
      `Adding this duty will exceed slot capacity (${currentCount + 1}/${needed} ${newAssignment.role})`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateAssignmentUpdate(
  oldAssignment: Assignment,
  newAssignment: Assignment,
  allAssignments: Assignment[],
  slot: DutySlot,
  faculty: Faculty[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Remove the old assignment from consideration
  const otherAssignments = allAssignments.filter(
    (a) =>
      !(
        a.day === oldAssignment.day &&
        a.slot === oldAssignment.slot &&
        a.facultyId === oldAssignment.facultyId
      )
  );

  // Check if faculty already has a different duty in this slot
  const existingInSlot = otherAssignments.find(
    (a) =>
      a.day === newAssignment.day &&
      a.slot === newAssignment.slot &&
      a.facultyId === newAssignment.facultyId
  );

  if (existingInSlot) {
    errors.push(
      `Faculty already has ${existingInSlot.role.toUpperCase()} duty in this slot`
    );
  }

  // Check if room is already taken (for regular duties)
  if (newAssignment.role === 'regular' && newAssignment.roomNumber) {
    const roomTaken = otherAssignments.find(
      (a) =>
        a.day === newAssignment.day &&
        a.slot === newAssignment.slot &&
        a.role === 'regular' &&
        a.roomNumber === newAssignment.roomNumber
    );

    if (roomTaken) {
      const facultyMember = faculty.find(
        (f) => f.facultyId === roomTaken.facultyId
      );
      errors.push(
        `Room ${newAssignment.roomNumber} is already assigned to ${facultyMember?.facultyName || roomTaken.facultyId}`
      );
    }

    // Check if room exists in slot
    if (!slot.rooms.includes(newAssignment.roomNumber)) {
      errors.push(
        `Room ${newAssignment.roomNumber} is not available in this slot`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateSwap(
  assignmentA: Assignment,
  assignmentB: Assignment,
  allAssignments: Assignment[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Swaps should be in the same slot
  if (
    assignmentA.day !== assignmentB.day ||
    assignmentA.slot !== assignmentB.slot
  ) {
    errors.push('Can only swap duties within the same slot');
  }

  // Check if either faculty has multiple duties in the slot
  const facultyADuties = allAssignments.filter(
    (a) =>
      a.day === assignmentA.day &&
      a.slot === assignmentA.slot &&
      a.facultyId === assignmentA.facultyId
  );

  const facultyBDuties = allAssignments.filter(
    (a) =>
      a.day === assignmentB.day &&
      a.slot === assignmentB.slot &&
      a.facultyId === assignmentB.facultyId
  );

  if (facultyADuties.length > 1 || facultyBDuties.length > 1) {
    warnings.push(
      'One or both faculty have multiple duties in this slot. Only selected duties will be swapped.'
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}
