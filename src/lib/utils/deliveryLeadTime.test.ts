import { describe, expect, it } from 'vitest';
import {
  getDisabledTimeSlotsForLeadTime,
  getLeadTimeReadyAt,
  isDateAvailableForLeadTime,
  type DeliveryTimeSlot,
} from '@/lib/utils/deliveryLeadTime';

const TIME_SLOTS: DeliveryTimeSlot[] = [
  { slot: '10AM - 12NN', startHour: 10, endHour: 12 },
  { slot: '12NN - 2PM', startHour: 12, endHour: 14 },
  { slot: '2PM - 4PM', startHour: 14, endHour: 16 },
  { slot: '4PM - 6PM', startHour: 16, endHour: 18 },
  { slot: '6PM - 8PM', startHour: 18, endHour: 20 },
];

describe('delivery lead time', () => {
  it('starts rush lead time from tomorrow at 10 AM after the cutoff', () => {
    const readyAt = getLeadTimeReadyAt({
      availability: 'rush',
      now: new Date('2026-04-23T09:00:00.000Z'),
    });

    expect(readyAt.readyDate).toBe('2026-04-24');
    expect(readyAt.readyHour).toBe(11);
    expect(readyAt.readyMinute).toBe(0);
    expect(isDateAvailableForLeadTime('2026-04-23', TIME_SLOTS, {
      availability: 'rush',
      now: new Date('2026-04-23T09:00:00.000Z'),
    })).toBe(false);
    expect(getDisabledTimeSlotsForLeadTime('2026-04-24', TIME_SLOTS, {
      availability: 'rush',
      now: new Date('2026-04-23T09:00:00.000Z'),
    })).toEqual([]);
  });

  it('keeps the first same-day slot on tomorrow at 12NN - 2PM after the cutoff', () => {
    expect(getDisabledTimeSlotsForLeadTime('2026-04-24', TIME_SLOTS, {
      availability: 'same-day',
      now: new Date('2026-04-23T09:00:00.000Z'),
    })).toEqual(['10AM - 12NN']);
  });

  it('moves a normal 1-day lead time to the day after tomorrow after the cutoff', () => {
    expect(isDateAvailableForLeadTime('2026-04-24', TIME_SLOTS, {
      availability: 'normal',
      minimumLeadTimeDays: 1,
      now: new Date('2026-04-23T09:00:00.000Z'),
    })).toBe(false);

    expect(isDateAvailableForLeadTime('2026-04-25', TIME_SLOTS, {
      availability: 'normal',
      minimumLeadTimeDays: 1,
      now: new Date('2026-04-23T09:00:00.000Z'),
    })).toBe(true);
  });

  it('uses the real ready time for normal orders before the cutoff', () => {
    expect(getDisabledTimeSlotsForLeadTime('2026-04-24', TIME_SLOTS, {
      availability: 'normal',
      minimumLeadTimeDays: 1,
      now: new Date('2026-04-23T07:00:00.000Z'),
    })).toEqual(['10AM - 12NN', '12NN - 2PM']);
  });
});
