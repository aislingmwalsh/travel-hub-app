// src/utils/dateUtils.js

export function addDaysToDate(startDateString, dayOffset) {
  if (!startDateString) return '';
  
  const [year, month, day] = startDateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + dayOffset);
  
  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}