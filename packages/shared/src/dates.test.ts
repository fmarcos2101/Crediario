import { describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  addCalendarMonths,
  calendarDayDiff,
  formatIsoDatePtBr,
} from './dates';

describe('dates', () => {
  it('avança meses e corta dia inexistente', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addCalendarMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addCalendarMonths('2026-03-15', 12)).toBe('2027-03-15');
  });

  it('avança dias em UTC de calendário', () => {
    expect(addCalendarDays('2026-01-30', 2)).toBe('2026-02-01');
    expect(addCalendarDays('2026-03-01', 14)).toBe('2026-03-15');
  });

  it('calcula diferença em dias de calendário', () => {
    expect(calendarDayDiff('2026-04-10', '2026-04-10')).toBe(0);
    expect(calendarDayDiff('2026-04-10', '2026-04-11')).toBe(1);
    expect(calendarDayDiff('2026-04-10', '2026-04-07')).toBe(-3);
    expect(formatIsoDatePtBr('2026-04-01')).toBe('01/04/2026');
  });
});
