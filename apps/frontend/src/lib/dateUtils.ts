/**
 * Safely converts Firestore timestamps, Date objects, or date strings to Date objects
 * Returns a Date object in local timezone (for display)
 */
export function toDate(value: any): Date {
  if (!value) return new Date();
  
  let date: Date;
  
  // If it's already a Date object
  if (value instanceof Date) {
    date = value;
  }
  // If it's a Firestore Timestamp (has toDate method)
  else if (value && typeof value.toDate === 'function') {
    date = value.toDate();
  }
  // If it's a timestamp object with seconds/nanoseconds (Firestore format)
  else if (value && typeof value.seconds === 'number') {
    date = new Date(value.seconds * 1000);
  }
  // If it's a Firestore timestamp with _seconds and _nanoseconds (serialized format)
  else if (value && typeof value._seconds === 'number') {
    date = new Date(value._seconds * 1000 + (value._nanoseconds || 0) / 1000000);
  }
  // If it's a string or number, try to parse it
  else {
    date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn('Invalid date value:', value);
      return new Date();
    }
  }
  
  // Date is already in local time when parsed from UTC string
  // Firestore timestamps are already in local time when converted
  return date;
}

/**
 * Converts a Date object to UTC ISO string for storage
 * This ensures dates are stored in UTC format
 */
export function toUTCString(date: Date): string {
  return date.toISOString();
}

/**
 * Converts a UTC date string to local Date object for display
 */
export function fromUTCString(utcString: string): Date {
  return new Date(utcString);
}

/**
 * Formats a date for datetime-local input (converts UTC to local time)
 */
export function formatDateTimeLocalForInput(date: Date | string): string {
  const localDate = typeof date === 'string' ? fromUTCString(date) : date;
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a datetime-local input value to UTC Date for storage
 * datetime-local input is in local time, Date constructor interprets it as local
 * and stores internally as UTC, which is what we want
 */
export function parseDateTimeLocalToUTC(dateTimeLocal: string): Date {
  // new Date() with datetime-local string interprets it as local time
  // and stores internally as UTC, which is correct for storage
  return new Date(dateTimeLocal);
}

