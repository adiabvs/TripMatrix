/**
 * Safely converts Firestore timestamps, Date objects, or date strings to Date objects
 */
export function toDate(value: any): Date {
  if (!value) return new Date();
  
  // If it's already a Date object
  if (value instanceof Date) {
    return value;
  }
  
  // If it's a Firestore Timestamp (has toDate method)
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // If it's a timestamp object with seconds/nanoseconds
  if (value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  
  // If it's a string or number, try to parse it
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    console.warn('Invalid date value:', value);
    return new Date();
  }
  
  return parsed;
}

