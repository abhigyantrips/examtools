import type { DutySlot, ExamStructure, Faculty } from '@/types';

export interface TestDataConfig {
  totalDuties: number;
  minDays: number;
  maxDays: number;
  minSlotsPerDay: number;
  maxSlotsPerDay: number;
  regularDutyRatio: number; // 0.4 = 40% of duties should be regular
  relieverDutyRatio: number; // 0.2 = 20% of duties should be reliever
  squadDutyRatio: number; // 0.2 = 20% of duties should be squad
  bufferDutyRatio: number; // 0.2 = 20% of duties should be buffer
}

export function calculateTotalDuties(
  faculty: Faculty[],
  designationDutyCounts: Record<string, number>
): number {
  return faculty.reduce((total, member) => {
    return total + (designationDutyCounts[member.designation] || 0);
  }, 0);
}

export function generateRandomTestConfiguration(
  totalDuties: number,
  config: Partial<TestDataConfig> = {}
): ExamStructure {
  // Default configuration
  const defaultConfig: TestDataConfig = {
    totalDuties,
    minDays: 2,
    maxDays: 6,
    minSlotsPerDay: 1,
    maxSlotsPerDay: 4,
    regularDutyRatio: 0.45, // Regular duties need rooms, so slightly higher
    relieverDutyRatio: 0.2,
    squadDutyRatio: 0.2,
    bufferDutyRatio: 0.15, // Buffer is optional, so lower
  };

  const finalConfig = { ...defaultConfig, ...config };

  // Generate random structure
  const numDays = randomInt(finalConfig.minDays, finalConfig.maxDays);
  const daySlots: DutySlot[] = [];

  // Create slots structure first
  const slotStructure: Array<{ day: number; slot: number }> = [];

  for (let day = 0; day < numDays; day++) {
    const slotsThisDay = randomInt(
      finalConfig.minSlotsPerDay,
      finalConfig.maxSlotsPerDay
    );
    for (let slot = 0; slot < slotsThisDay; slot++) {
      slotStructure.push({ day, slot });
    }
  }

  const totalSlots = slotStructure.length;

  if (totalSlots === 0) {
    throw new Error('Generated structure has no slots');
  }

  // Calculate duty distribution
  const targetRegular = Math.floor(totalDuties * finalConfig.regularDutyRatio);
  const targetReliever = Math.floor(
    totalDuties * finalConfig.relieverDutyRatio
  );
  const targetSquad = Math.floor(totalDuties * finalConfig.squadDutyRatio);
  const targetBuffer =
    totalDuties - targetRegular - targetReliever - targetSquad; // Remainder

  console.log(
    `🧪 Test Data: ${totalDuties} total duties across ${numDays} days, ${totalSlots} slots`
  );
  console.log(
    `📊 Distribution: ${targetRegular} regular, ${targetReliever} reliever, ${targetSquad} squad, ${targetBuffer} buffer`
  );

  // Distribute duties across slots
  const regularDistribution = distributeEvenly(targetRegular, totalSlots, 1); // Min 1 regular per slot
  const relieverDistribution = distributeEvenly(targetReliever, totalSlots, 0);
  const squadDistribution = distributeEvenly(targetSquad, totalSlots, 0);
  const bufferDistribution = distributeEvenly(targetBuffer, totalSlots, 0);

  // Generate actual slots
  slotStructure.forEach(({ day, slot }, index) => {
    const regularDuties = regularDistribution[index];
    const relieverDuties = relieverDistribution[index];
    const squadDuties = squadDistribution[index];
    const bufferDuties = bufferDistribution[index];

    const dutySlot: DutySlot = {
      day,
      slot,
      date: generateRandomDate(day), // Random dates spread over time
      startTime: generateRandomStartTime(slot),
      endTime: generateRandomEndTime(slot),
      regularDuties,
      relieverDuties,
      squadDuties,
      bufferDuties,
      rooms: generateRoomNumbers(regularDuties, day, slot),
    };

    daySlots.push(dutySlot);
  });

  return {
    days: numDays,
    dutySlots: daySlots,
    designationDutyCounts: {}, // Will be filled by existing data
  };
}

// Helper functions
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function distributeEvenly(
  total: number,
  slots: number,
  minPerSlot: number = 0
): number[] {
  const distribution = new Array(slots).fill(minPerSlot);
  let remaining = total - minPerSlot * slots;

  // Randomly distribute remaining duties
  while (remaining > 0) {
    const randomSlot = Math.floor(Math.random() * slots);
    distribution[randomSlot]++;
    remaining--;
  }

  return distribution;
}

function generateRandomDate(dayOffset: number): Date {
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + dayOffset);
  return baseDate;
}

function generateRandomStartTime(slotIndex: number): string {
  const times = [
    '9:00 AM',
    '10:00 AM',
    '11:00 AM',
    '12:00 PM',
    '1:00 PM',
    '2:00 PM',
    '3:00 PM',
    '4:00 PM',
  ];

  // Ensure slots don't overlap by using slot index
  const startIndex = Math.min(slotIndex * 2, times.length - 2);
  return times[startIndex];
}

function generateRandomEndTime(slotIndex: number): string {
  const times = [
    '12:00 PM',
    '1:00 PM',
    '2:00 PM',
    '3:00 PM',
    '4:00 PM',
    '5:00 PM',
    '6:00 PM',
    '7:00 PM',
  ];

  const endIndex = Math.min(slotIndex * 2 + 1, times.length - 1);
  return times[endIndex];
}

function generateRoomNumbers(
  count: number,
  day: number,
  slot: number
): string[] {
  const rooms: string[] = [];
  const buildingPrefixes = ['A', 'B', 'C', 'D', 'E'];
  const building = buildingPrefixes[day % buildingPrefixes.length];

  for (let i = 0; i < count; i++) {
    const roomNumber = `${building}${slot * 100 + 101 + i}`;
    rooms.push(roomNumber);
  }

  return rooms;
}

// Validation function to ensure generated data is valid
export function validateTestConfiguration(
  structure: ExamStructure,
  totalDuties: number
): {
  isValid: boolean;
  errors: string[];
  summary: {
    actualTotal: number;
    regularDuties: number;
    relieverDuties: number;
    squadDuties: number;
    bufferDuties: number;
  };
} {
  const errors: string[] = [];

  let regularDuties = 0;
  let relieverDuties = 0;
  let squadDuties = 0;
  let bufferDuties = 0;

  structure.dutySlots.forEach((slot, index) => {
    // Check room count matches regular duties
    if (slot.rooms.length !== slot.regularDuties) {
      errors.push(
        `Slot ${index + 1}: ${slot.rooms.length} rooms but ${slot.regularDuties} regular duties`
      );
    }

    // Check minimum duties
    if (slot.regularDuties < 1) {
      errors.push(`Slot ${index + 1}: Must have at least 1 regular duty`);
    }

    regularDuties += slot.regularDuties;
    relieverDuties += slot.relieverDuties || 0;
    squadDuties += slot.squadDuties || 0;
    bufferDuties += slot.bufferDuties;
  });

  const actualTotal =
    regularDuties + relieverDuties + squadDuties + bufferDuties;

  if (actualTotal !== totalDuties) {
    errors.push(
      `Total mismatch: generated ${actualTotal} duties, expected ${totalDuties}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    summary: {
      actualTotal,
      regularDuties,
      relieverDuties,
      squadDuties,
      bufferDuties,
    },
  };
}
