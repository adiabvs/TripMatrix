/**
 * Converts a Firestore Timestamp or Date to a JavaScript Date object
 */
export function toDate(value: any): Date {
  if (!value) {
    throw new Error('Date value is required');
  }

  // If it's already a Date object
  if (value instanceof Date) {
    return value;
  }

  // If it's a Firestore Timestamp
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  // If it's a string or number, try to parse it
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date value: ${value}`);
    }
    return date;
  }

  // If it has seconds and nanoseconds (Firestore Timestamp structure)
  if (value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
  }

  throw new Error(`Cannot convert to Date: ${JSON.stringify(value)}`);
}

/**
 * Safely converts a value to a Date, returning null if conversion fails
 */
export function toDateSafe(value: any): Date | null {
  try {
    return toDate(value);
  } catch (error) {
    console.warn('Failed to convert date:', value, error);
    return null;
  }
}

