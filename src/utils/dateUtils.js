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

export function formatTripCardDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[monthIdx] || '';
  
  // Ordinal suffix
  let suffix = 'th';
  if (day === 1 || day === 21 || day === 31) suffix = 'st';
  else if (day === 2 || day === 22) suffix = 'nd';
  else if (day === 3 || day === 23) suffix = 'rd';
  
  return `${day}${suffix} ${monthName} ${year}`;
}

export function formatHeaderDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0].slice(-2);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2]; // preserve original padding (e.g. "06")
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[monthIdx] || '';
  
  return `${day}-${monthName}-${year}`;
}

export function addMinutesToTimeString(timeStr, minutesToAdd) {
  if (!timeStr || timeStr === 'Flexible') return timeStr;
  const parts = String(timeStr).split(':');
  if (parts.length !== 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;

  const totalMinutes = hours * 60 + minutes + (Number(minutesToAdd) || 0);
  
  // If overflows past midnight (1439 mins = 23:59), cap at 23:59 to avoid day wrapping confusion
  if (totalMinutes >= 24 * 60) {
    return '23:59';
  }
  if (totalMinutes < 0) {
    return '00:00';
  }

  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;

  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}

export function calculateDynamicCheckInTime(accommodation, dayItems = [], travelCache = {}, travelModes = {}) {
  if (!accommodation) return '15:00';
  const baseCheckIn = accommodation.checkInTime || '15:00';
  if (baseCheckIn === 'Flexible') return 'Flexible';

  const accDate = accommodation.date;
  const accLocation = (accommodation.location || '').trim();

  // Find all transit items on the check-in day
  const transitItems = (dayItems || []).filter(item => {
    if (!item || item.id === accommodation.id) return false;
    const cat = String(item.category || '').toLowerCase();
    const isTransit = cat.includes('flight') || cat.includes('train') || cat.includes('drive') || cat.includes('transport') || cat.includes('ferry') || cat.includes('bus');
    return isTransit && item.date === accDate;
  });

  if (transitItems.length === 0) {
    return baseCheckIn;
  }

  let latestEffectiveArrival = null;

  transitItems.forEach(transit => {
    const arrivalTime = transit.arrivalTime || transit.time;
    if (!arrivalTime || arrivalTime === 'Flexible') return;

    const arrivalLocation = (transit.destination || transit.location || '').trim();
    
    // Determine travel duration from arrival location to hotel
    let travelDurationMins = 0;
    if (arrivalLocation && accLocation && arrivalLocation.toLowerCase() !== accLocation.toLowerCase()) {
      const segmentKey = `${transit.id}-${accommodation.id}`;
      const preferredMode = travelModes[segmentKey] || travelModes[`${segmentKey}-checkin`] || 'DRIVE';
      
      // Look up in travelCache
      const cacheKey = `${arrivalLocation}||${accLocation}||${preferredMode}`;
      const cached = travelCache[cacheKey];
      
      if (cached && typeof cached.duration === 'number') {
        travelDurationMins = cached.duration;
      } else {
        // Fallback: check if ANY mode (TRANSIT/DRIVE/WALK) is cached
        const driveCached = travelCache[`${arrivalLocation}||${accLocation}||DRIVE`];
        const transitCached = travelCache[`${arrivalLocation}||${accLocation}||TRANSIT`];
        const walkCached = travelCache[`${arrivalLocation}||${accLocation}||WALK`];
        const anyCached = driveCached || transitCached || walkCached;
        if (anyCached && typeof anyCached.duration === 'number') {
          travelDurationMins = anyCached.duration;
        } else {
          // Reasonable default estimate (30 mins) until Google Routes API finishes caching
          travelDurationMins = 30;
        }
      }
    }

    const estimatedArrivalAtHotel = addMinutesToTimeString(arrivalTime, travelDurationMins);
    
    if (!latestEffectiveArrival || estimatedArrivalAtHotel.localeCompare(latestEffectiveArrival) > 0) {
      latestEffectiveArrival = estimatedArrivalAtHotel;
    }
  });

  if (!latestEffectiveArrival) {
    return baseCheckIn;
  }

  // If effective arrival at hotel is later than base check-in time (e.g. 18:15 > 15:00), auto-adjust!
  if (latestEffectiveArrival.localeCompare(baseCheckIn) > 0) {
    return latestEffectiveArrival;
  }

  return baseCheckIn;
}