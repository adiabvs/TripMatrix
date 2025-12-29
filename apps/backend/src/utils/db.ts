// Database helper utilities for Supabase
// Provides a similar interface to Firestore for easier migration

import { getSupabase } from '../config/supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export function getDb(): SupabaseClient {
  return getSupabase();
}

// Helper to convert Supabase row to Firestore-like document format
export function rowToDoc<T>(row: any, idField: string = 'id'): T {
  const { [idField]: id, ...data } = row;
  return {
    [idField.replace('_id', 'Id')]: id, // Convert trip_id to tripId, etc.
    ...data,
  } as T;
}

// Helper to convert Firestore-like document to Supabase row format
export function docToRow<T>(doc: any, idField: string = 'id'): T {
  const { [idField.replace('_id', 'Id')]: id, ...data } = doc;
  return {
    [idField]: id,
    ...data,
  } as T;
}

// Map collection names to table names
export const collectionToTable: Record<string, string> = {
  users: 'users',
  trips: 'trips',
  tripPlaces: 'trip_places',
  tripExpenses: 'trip_expenses',
  tripRoutes: 'trip_routes',
  tripLikes: 'trip_likes',
  placeComments: 'place_comments',
  travelDiaries: 'travel_diaries',
};

// Map Firestore field names to Supabase column names
export function mapFieldToColumn(field: string): string {
  // Convert camelCase to snake_case
  return field.replace(/([A-Z])/g, '_$1').toLowerCase();
}

// Map Supabase column names to Firestore field names
export function mapColumnToField(column: string): string {
  // Convert snake_case to camelCase
  return column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Convert Firestore document to Supabase row format
export function convertDocToRow(doc: any, collection: string): any {
  const table = collectionToTable[collection];
  if (!table) {
    throw new Error(`Unknown collection: ${collection}`);
  }

  const row: any = {};
  
  // Handle special ID fields
  if (doc[`${collection.slice(0, -1)}Id`]) {
    // e.g., tripId -> trip_id
    const idField = `${collection.slice(0, -1)}_id`;
    row[idField] = doc[`${collection.slice(0, -1)}Id`];
  } else if (doc.uid) {
    row.uid = doc.uid;
  }

  // Convert all other fields
  Object.keys(doc).forEach((key) => {
    if (key.endsWith('Id') && key !== 'uid') {
      // Convert tripId -> trip_id, creatorId -> creator_id, etc.
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      row[snakeKey] = doc[key];
    } else if (key === 'createdAt' || key === 'updatedAt') {
      row[mapFieldToColumn(key)] = doc[key];
    } else if (key === 'startTime' || key === 'endTime' || key === 'visitedAt') {
      row[mapFieldToColumn(key)] = doc[key];
    } else {
      // Keep as-is for JSON fields or already snake_case
      row[key] = doc[key];
    }
  });

  return row;
}

// Convert Supabase row to Firestore document format
export function convertRowToDoc(row: any, collection: string): any {
  const doc: any = {};
  
  // Handle special ID fields
  const idField = `${collection.slice(0, -1)}_id`;
  if (row[idField]) {
    doc[`${collection.slice(0, -1)}Id`] = row[idField];
  } else if (row.uid) {
    doc.uid = row.uid;
  }

  // Convert all other fields
  Object.keys(row).forEach((key) => {
    if (key === idField || key === 'uid') {
      // Already handled
      return;
    }
    
    // Convert snake_case to camelCase for date fields
    if (key === 'created_at' || key === 'updated_at') {
      doc[mapColumnToField(key)] = row[key];
    } else if (key === 'start_time' || key === 'end_time' || key === 'visited_at') {
      doc[mapColumnToField(key)] = row[key];
    } else if (key.includes('_')) {
      // Convert other snake_case fields
      doc[mapColumnToField(key)] = row[key];
    } else {
      // Keep as-is
      doc[key] = row[key];
    }
  });

  return doc;
}

