import type { AvailabilityType } from '@/lib/utils/availability';

export interface DeliveryTimeSlot {
  slot: string;
  startHour: number;
  endHour: number;
}

export interface DeliveryLeadTimeOptions {
  availability: AvailabilityType;
  minimumLeadTimeDays?: number;
  now?: Date;
  cutoffHour?: number;
  nextDayStartHour?: number;
}

export interface DeliveryReadyAt {
  readyAtWallClockMs: number;
  readyDate: string;
  readyHour: number;
  readyMinute: number;
}

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const DELIVERY_CUTOFF_HOUR = 16;
export const DELIVERY_DAY_START_HOUR = 10;

function toManilaWallClockMs(date: Date): number {
  return date.getTime() + MANILA_OFFSET_MS;
}

function getManilaWallClockDate(date: Date): Date {
  return new Date(toManilaWallClockMs(date));
}

function formatWallClockDate(ms: number): string {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLeadTimeDurationMs(
  availability: AvailabilityType,
  minimumLeadTimeDays: number
): number {
  if (availability === 'rush') {
    return HOUR_MS;
  }

  if (availability === 'same-day') {
    return 3 * HOUR_MS;
  }

  return Math.max(minimumLeadTimeDays, 1) * DAY_MS;
}

function getLeadTimeAnchorWallClockMs(
  now: Date,
  cutoffHour: number,
  nextDayStartHour: number
): number {
  const manilaNow = getManilaWallClockDate(now);
  const minutesOfDay = manilaNow.getUTCHours() * 60 + manilaNow.getUTCMinutes();

  if (minutesOfDay >= cutoffHour * 60) {
    return Date.UTC(
      manilaNow.getUTCFullYear(),
      manilaNow.getUTCMonth(),
      manilaNow.getUTCDate() + 1,
      nextDayStartHour,
      0,
      0,
      0
    );
  }

  return toManilaWallClockMs(now);
}

function buildWallClockMs(date: string, hour: number, minute = 0): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day, hour, minute, 0, 0);
}

export function getLeadTimeReadyAt(options: DeliveryLeadTimeOptions): DeliveryReadyAt {
  const {
    availability,
    minimumLeadTimeDays = 1,
    now = new Date(),
    cutoffHour = DELIVERY_CUTOFF_HOUR,
    nextDayStartHour = DELIVERY_DAY_START_HOUR,
  } = options;

  const anchorWallClockMs = getLeadTimeAnchorWallClockMs(now, cutoffHour, nextDayStartHour);
  const readyAtWallClockMs =
    anchorWallClockMs + getLeadTimeDurationMs(availability, minimumLeadTimeDays);
  const readyAt = new Date(readyAtWallClockMs);

  return {
    readyAtWallClockMs,
    readyDate: formatWallClockDate(readyAtWallClockMs),
    readyHour: readyAt.getUTCHours(),
    readyMinute: readyAt.getUTCMinutes(),
  };
}

export function getDisabledTimeSlotsForLeadTime(
  date: string,
  slots: DeliveryTimeSlot[],
  options: DeliveryLeadTimeOptions
): string[] {
  if (!date) {
    return [];
  }

  const { readyAtWallClockMs } = getLeadTimeReadyAt(options);

  return slots
    .filter((slot) => buildWallClockMs(date, slot.endHour) < readyAtWallClockMs)
    .map((slot) => slot.slot);
}

export function isDateAvailableForLeadTime(
  date: string,
  slots: DeliveryTimeSlot[],
  options: DeliveryLeadTimeOptions
): boolean {
  if (!date || slots.length === 0) {
    return false;
  }

  const { readyAtWallClockMs } = getLeadTimeReadyAt(options);
  const latestSlotEndHour = Math.max(...slots.map((slot) => slot.endHour));

  return buildWallClockMs(date, latestSlotEndHour) >= readyAtWallClockMs;
}
