# Firebase Firestore to MongoDB Migration Guide

This document outlines the migration from Firebase Firestore to MongoDB using Mongoose.

## Setup

### 1. Install MongoDB
- Local: Install MongoDB locally or use Docker
- Cloud: Use MongoDB Atlas (free tier available)
- Connection string format: `mongodb://localhost:27017/tripmatrix` or MongoDB Atlas connection string

### 2. Environment Variables
Add to `apps/backend/.env`:
```
MONGODB_URI=mongodb://localhost:27017/tripmatrix
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/tripmatrix?retryWrites=true&w=majority
```

### 3. Install Dependencies
```bash
cd apps/backend
pnpm add mongoose
```

## Migration Status

### ✅ Completed

1. **MongoDB Configuration**
   - Created `apps/backend/src/config/mongodb.ts` with connection setup
   - Integrated into `apps/backend/src/index.ts`

2. **Mongoose Models**
   - `User.ts` - User model with all fields
   - `Trip.ts` - Trip model with participants, status, etc.
   - `TripPlace.ts` - Places model with coordinates, images, etc.
   - `TripExpense.ts` - Expenses model with calculated shares
   - `TripRoute.ts` - Routes model with points
   - `TripLike.ts` - Likes model
   - `PlaceComment.ts` - Comments model
   - `TravelDiary.ts` - Diaries model

3. **All Routes Migrated**
   - ✅ **trips.ts** - All endpoints migrated
   - ✅ **users.ts** - All endpoints migrated
   - ✅ **places.ts** - All endpoints migrated (including likes and comments)
   - ✅ **expenses.ts** - All endpoints migrated
   - ✅ **routes.ts** - All endpoints migrated
   - ✅ **diary.ts** - All endpoints migrated
   - ✅ **canva-oauth.ts** - All endpoints migrated (uses CanvaToken and CanvaOAuthState models)

4. **Additional Models Created**
   - ✅ `CanvaToken.ts` - For Canva OAuth token storage
   - ✅ `CanvaOAuthState.ts` - For OAuth state management
   - ✅ `PlaceLike.ts` - For place likes

5. **Package Updates**
   - ✅ Removed `firebase-admin` from package.json
   - ✅ Added `mongoose` to package.json
   - ✅ Updated SETUP.md with MongoDB instructions

## Migration Pattern

### Query Conversion Examples

#### Find by ID
**Firestore:**
```typescript
const doc = await db.collection('trips').doc(tripId).get();
if (!doc.exists) return 404;
const data = doc.data();
```

**MongoDB:**
```typescript
const trip = await TripModel.findById(tripId);
if (!trip) return 404;
const data = trip.toJSON();
```

#### Find with Filter
**Firestore:**
```typescript
const snapshot = await db.collection('trips')
  .where('isPublic', '==', true)
  .get();
const trips = snapshot.docs.map(doc => ({ tripId: doc.id, ...doc.data() }));
```

**MongoDB:**
```typescript
const tripsDocs = await TripModel.find({ isPublic: true });
const trips = tripsDocs.map(doc => doc.toJSON());
```

#### Create Document
**Firestore:**
```typescript
const ref = await db.collection('trips').add(tripData);
const tripId = ref.id;
```

**MongoDB:**
```typescript
const tripDoc = new TripModel(tripData);
const savedTrip = await tripDoc.save();
const tripId = savedTrip._id.toString();
```

#### Update Document
**Firestore:**
```typescript
await db.collection('trips').doc(tripId).update(updates);
```

**MongoDB:**
```typescript
const trip = await TripModel.findById(tripId);
Object.assign(trip, updates);
await trip.save();
// OR
await TripModel.findByIdAndUpdate(tripId, updates);
```

#### Delete Document
**Firestore:**
```typescript
await db.collection('trips').doc(tripId).delete();
```

**MongoDB:**
```typescript
await TripModel.findByIdAndDelete(tripId);
```

#### Delete Multiple
**Firestore:**
```typescript
const batch = db.batch();
snapshot.docs.forEach(doc => batch.delete(doc.ref));
await batch.commit();
```

**MongoDB:**
```typescript
await TripModel.deleteMany({ tripId });
```

#### Array Queries
**Firestore:**
```typescript
// Check if user is in participants array
trip.participants?.some((p) => p.uid === uid)
```

**MongoDB:**
```typescript
// Same - works with Mongoose
trip.participants?.some((p) => p.uid === uid)
// OR query directly
await TripModel.find({ 'participants.uid': uid });
```

## Key Differences

1. **IDs**: MongoDB uses `_id` (ObjectId), models transform to `tripId`, `placeId`, etc. in JSON
2. **Timestamps**: Mongoose can auto-manage `createdAt` and `updatedAt` with `timestamps: true`
3. **Nested Objects**: Mongoose supports nested schemas (participants, coordinates, etc.)
4. **Queries**: MongoDB queries are more flexible than Firestore
5. **Transactions**: MongoDB supports transactions for complex operations
6. **Indexes**: Defined in schema, automatically created

## Model Features

- Automatic `_id` to `tripId`/`placeId`/etc. conversion in JSON
- Automatic timestamp management
- Indexes for common queries
- Type safety with TypeScript interfaces
- Validation built into schemas

## Migration Complete! ✅

All backend routes have been successfully migrated from Firebase Firestore to MongoDB. The migration includes:

1. ✅ All Mongoose models created and configured
2. ✅ All backend routes migrated
3. ✅ Auth middleware updated to use Firebase Admin SDK (for authentication)
4. ✅ Firebase Admin SDK kept for authentication (removed only from data storage)
5. ✅ Documentation updated (SETUP.md, MONGODB_MIGRATION.md)

## Remaining Tasks

1. **Frontend Migration** (Optional)
   - Frontend still uses Firebase client SDK for authentication
   - This is fine - Firebase Auth can still be used for authentication
   - All data operations go through the backend API, so no frontend changes needed for data access
   - If desired, can migrate to a different auth solution later

2. **Testing**
   - Test all endpoints to ensure they work correctly
   - Verify data migration if migrating existing data
   - Test authentication flow

3. **Data Migration** (If migrating existing data)
   - Export data from Firestore
   - Transform data to match MongoDB schema
   - Import into MongoDB
   - Verify data integrity

## Notes

- Keep Firebase Auth for authentication (or migrate to another auth solution)
- Supabase storage is still used for image uploads
- All data access goes through backend API, so frontend changes are minimal
- MongoDB is more flexible than Firestore for complex queries
- Better performance for relational-like queries

