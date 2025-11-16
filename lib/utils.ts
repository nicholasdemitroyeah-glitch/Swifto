import { Trip, Settings, Load } from './db';
import { startOfWeek, endOfWeek, isWithinInterval, format } from 'date-fns';

export function calculateTripPay(
  mileage: number,
  loads: Load[],
  settings: Settings,
  nightMiles: number = 0
): number {
  const effectiveNightExtra = settings.nightPayEnabled ? (settings.nightExtraCpm || 0) : 0;
  const nightMilesCapped = Math.max(0, Math.min(nightMiles, mileage));
  const dayMiles = Math.max(0, mileage - nightMilesCapped);

  const mileagePay =
    dayMiles * settings.cpm +
    nightMilesCapped * (settings.cpm + effectiveNightExtra); // CPM is in dollars
  const loadsPay = loads.length * settings.payPerLoad;
  const totalStops = loads.reduce((sum, load) => sum + load.stops.length, 0);
  const stopsPay = totalStops * settings.payPerStop;
  
  return mileagePay + loadsPay + stopsPay;
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function isInTimeWindow(nowMinutes: number, startMinutes: number, endMinutes: number): boolean {
  const normStart = ((startMinutes % 1440) + 1440) % 1440;
  const normEnd = ((endMinutes % 1440) + 1440) % 1440;
  if (normStart === normEnd) {
    // Full-day window if enabled
    return true;
  }
  if (normStart < normEnd) {
    // Same-day window
    return nowMinutes >= normStart && nowMinutes < normEnd;
  }
  // Overnight window (e.g., 19:00 -> 03:00)
  return nowMinutes >= normStart || nowMinutes < normEnd;
}

export function isInNightWindow(now: Date, settings: Settings): boolean {
  if (!settings.nightPayEnabled) return false;
  const start = settings.nightStartMinutes ?? (19 * 60);
  const end = settings.nightEndMinutes ?? (3 * 60);
  const nowMin = minutesSinceMidnight(now);
  return isInTimeWindow(nowMin, start, end);
}

export function getWeekStartDate(date: Date = new Date()): Date {
  // Week starts on Friday (day 5, where Sunday = 0, Monday = 1, ..., Friday = 5, Saturday = 6)
  const day = date.getDay();
  // Calculate days to subtract to get to the most recent Friday
  let diff = 0;
  if (day === 5) {
    diff = 0; // Today is Friday
  } else if (day === 6) {
    diff = 1; // Saturday - go back 1 day to Friday
  } else if (day === 0) {
    diff = 2; // Sunday - go back 2 days to Friday
  } else {
    // Monday (1) through Thursday (4) - go back to last Friday
    // Monday: 1 + 2 = 3 days back, Tuesday: 2 + 2 = 4, etc.
    diff = day + 2;
  }
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

export function getWeekEndDate(date: Date = new Date()): Date {
  const weekStart = getWeekStartDate(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

export function isInCurrentWeek(tripDate: Date): boolean {
  const weekStart = getWeekStartDate();
  const weekEnd = getWeekEndDate();
  return isWithinInterval(tripDate, { start: weekStart, end: weekEnd });
}

export function getWeeklyTrips(trips: Trip[]): Trip[] {
  return trips.filter(trip => {
    const tripDate = trip.createdAt?.toDate() || new Date();
    return isInCurrentWeek(tripDate);
  });
}

export function getWeeklyEarnings(trips: Trip[]): number {
  const weeklyTrips = getWeeklyTrips(trips);
  return weeklyTrips.reduce((sum, trip) => sum + trip.totalPay, 0);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(date: Date): string {
  return format(date, 'MMM d, yyyy');
}

export function formatDateTime(date: Date): string {
  return format(date, 'MMM d, yyyy h:mm a');
}

export function formatTime(date: Date): string {
  return format(date, 'h:mm a');
}

