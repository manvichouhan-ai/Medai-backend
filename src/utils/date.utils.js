import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, startOfDay, endOfDay } from 'date-fns';

export function toUserTimezone(date, timezone = 'UTC') {
  return toZonedTime(date, timezone);
}

export function fromUserTimezone(date, timezone = 'UTC') {
  return fromZonedTime(date, timezone);
}

export function formatInTimezone(date, timezone = 'UTC', fmt = 'yyyy-MM-dd HH:mm:ss') {
  return format(toZonedTime(date, timezone), fmt);
}

export function getDayStartUTC(date = new Date()) {
  return startOfDay(date);
}

export function getDayEndUTC(date = new Date()) {
  return endOfDay(date);
}

export function dayOfWeekShort(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}
