import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

import { initializeFirebase, getFirestore } from '../src/config/firebase.js';
import type { Trip, TripPlace, TripExpense, TripRoute, User, ModeOfTravel } from '@tripmatrix/types';
import admin from 'firebase-admin';

// Free high-quality travel images from Unsplash
const DUMMY_IMAGES = {
  covers: [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200&h=800&fit=crop',
  ],
  places: [
    'https://images.unsplash.com/photo-1512343879784-a960bf40e4f2?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1512343879784-a960bf40e4f2?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop',
  ],
};

const DUMMY_TRIPS = [
  {
    title: 'European Adventure',
    description: 'An amazing journey through the heart of Europe, exploring historic cities and beautiful landscapes.',
    places: [
      { name: 'Paris, France', lat: 48.8566, lng: 2.3522, country: 'FR', comment: 'The City of Light never disappoints! Beautiful architecture and amazing food.', rating: 5 },
      { name: 'Amsterdam, Netherlands', lat: 52.3676, lng: 4.9041, country: 'NL', comment: 'Charming canals and vibrant culture. Loved the bike-friendly streets!', rating: 5 },
      { name: 'Berlin, Germany', lat: 52.5200, lng: 13.4050, country: 'DE', comment: 'Rich history and amazing nightlife. The Berlin Wall was a powerful experience.', rating: 4 },
      { name: 'Prague, Czech Republic', lat: 50.0755, lng: 14.4378, country: 'CZ', comment: 'Stunning medieval architecture. The Old Town Square is breathtaking!', rating: 5 },
      { name: 'Vienna, Austria', lat: 48.2082, lng: 16.3738, country: 'AT', comment: 'Elegant city with incredible music scene. The coffee culture is amazing!', rating: 5 },
    ],
    modes: ['flight', 'train', 'train', 'train', 'train'] as ModeOfTravel[],
    expenses: [
      { description: 'Hotel in Paris', amount: 450, currency: 'EUR', paidBy: 'user1' },
      { description: 'Dinner at Le Jules Verne', amount: 320, currency: 'EUR', paidBy: 'user2' },
      { description: 'Train to Amsterdam', amount: 120, currency: 'EUR', paidBy: 'user1' },
      { description: 'Museum tickets', amount: 85, currency: 'EUR', paidBy: 'user2' },
      { description: 'Hotel in Berlin', amount: 380, currency: 'EUR', paidBy: 'user1' },
    ],
  },
  {
    title: 'Southeast Asia Backpacking',
    description: 'Exploring the vibrant cultures, delicious food, and stunning beaches of Southeast Asia.',
    places: [
      { name: 'Bangkok, Thailand', lat: 13.7563, lng: 100.5018, country: 'TH', comment: 'Incredible street food and bustling markets. The temples are absolutely stunning!', rating: 5 },
      { name: 'Chiang Mai, Thailand', lat: 18.7883, lng: 98.9853, country: 'TH', comment: 'Peaceful mountain city with amazing temples and elephant sanctuaries.', rating: 5 },
      { name: 'Luang Prabang, Laos', lat: 19.8833, lng: 102.1333, country: 'LA', comment: 'Beautiful UNESCO World Heritage site. The morning alms ceremony was unforgettable.', rating: 5 },
      { name: 'Siem Reap, Cambodia', lat: 13.4125, lng: 103.8670, country: 'KH', comment: 'Angkor Wat at sunrise is a once-in-a-lifetime experience!', rating: 5 },
      { name: 'Ho Chi Minh City, Vietnam', lat: 10.8231, lng: 106.6297, country: 'VN', comment: 'Vibrant city with amazing food scene. The War Remnants Museum was very moving.', rating: 4 },
    ],
    modes: ['flight', 'bus', 'bus', 'bus', 'bus'] as ModeOfTravel[],
    expenses: [
      { description: 'Hostel in Bangkok', amount: 25, currency: 'USD', paidBy: 'user1' },
      { description: 'Street food tour', amount: 45, currency: 'USD', paidBy: 'user2' },
      { description: 'Flight to Chiang Mai', amount: 85, currency: 'USD', paidBy: 'user1' },
      { description: 'Elephant sanctuary', amount: 120, currency: 'USD', paidBy: 'user2' },
      { description: 'Bus to Laos', amount: 35, currency: 'USD', paidBy: 'user1' },
    ],
  },
  {
    title: 'Iceland Ring Road',
    description: 'A road trip around Iceland, witnessing incredible natural wonders and Northern Lights.',
    places: [
      { name: 'Reykjavik, Iceland', lat: 64.1466, lng: -21.9426, country: 'IS', comment: 'Charming capital city. The Blue Lagoon was the perfect start!', rating: 5 },
      { name: 'Golden Circle', lat: 64.3265, lng: -20.1211, country: 'IS', comment: 'Geysers, waterfalls, and tectonic plates. Nature at its finest!', rating: 5 },
      { name: 'Vik, Iceland', lat: 63.4187, lng: -19.0064, country: 'IS', comment: 'Black sand beaches and dramatic cliffs. Absolutely stunning!', rating: 5 },
      { name: 'Jökulsárlón Glacier Lagoon', lat: 64.0479, lng: -16.1794, country: 'IS', comment: 'Icebergs floating in a glacial lagoon. One of the most beautiful places on Earth!', rating: 5 },
      { name: 'Akureyri, Iceland', lat: 65.6839, lng: -18.1105, country: 'IS', comment: 'Northern lights were incredible here! The whale watching was amazing too.', rating: 5 },
    ],
    modes: ['flight', 'car', 'car', 'car', 'car'] as ModeOfTravel[],
    expenses: [
      { description: 'Car rental', amount: 850, currency: 'USD', paidBy: 'user1' },
      { description: 'Hotel in Reykjavik', amount: 280, currency: 'USD', paidBy: 'user2' },
      { description: 'Northern Lights tour', amount: 150, currency: 'USD', paidBy: 'user1' },
      { description: 'Glacier hike', amount: 200, currency: 'USD', paidBy: 'user2' },
      { description: 'Whale watching', amount: 120, currency: 'USD', paidBy: 'user1' },
    ],
  },
  {
    title: 'Japan Cherry Blossom Season',
    description: 'Chasing sakura across Japan during the beautiful cherry blossom season.',
    places: [
      { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, country: 'JP', comment: 'Incredible city! The cherry blossoms in Ueno Park were magical.', rating: 5 },
      { name: 'Kyoto, Japan', lat: 35.0116, lng: 135.7681, country: 'JP', comment: 'Traditional temples and gardens. The Philosopher\'s Path during sakura was breathtaking!', rating: 5 },
      { name: 'Osaka, Japan', lat: 34.6937, lng: 135.5023, country: 'JP', comment: 'Amazing food scene! Dotonbori at night is an experience.', rating: 5 },
      { name: 'Nara, Japan', lat: 34.6851, lng: 135.8048, country: 'JP', comment: 'Friendly deer and ancient temples. The Great Buddha was impressive!', rating: 5 },
      { name: 'Hiroshima, Japan', lat: 34.3853, lng: 132.4553, country: 'JP', comment: 'Peaceful and moving. The Peace Memorial Park was very powerful.', rating: 5 },
    ],
    modes: ['flight', 'train', 'train', 'train', 'train'] as ModeOfTravel[],
    expenses: [
      { description: 'JR Pass', amount: 450, currency: 'USD', paidBy: 'user1' },
      { description: 'Ryokan in Kyoto', amount: 350, currency: 'USD', paidBy: 'user2' },
      { description: 'Sushi dinner', amount: 180, currency: 'USD', paidBy: 'user1' },
      { description: 'Temple entrance fees', amount: 60, currency: 'USD', paidBy: 'user2' },
      { description: 'Hotel in Tokyo', amount: 420, currency: 'USD', paidBy: 'user1' },
    ],
  },
  {
    title: 'Patagonia Adventure',
    description: 'Hiking through the stunning landscapes of Patagonia, from glaciers to mountains.',
    places: [
      { name: 'El Calafate, Argentina', lat: -50.3378, lng: -72.2641, country: 'AR', comment: 'Gateway to glaciers. Perito Moreno Glacier was absolutely massive!', rating: 5 },
      { name: 'El Chaltén, Argentina', lat: -49.3303, lng: -72.8861, country: 'AR', comment: 'Hiking capital of Argentina. Fitz Roy sunrise was unforgettable!', rating: 5 },
      { name: 'Torres del Paine, Chile', lat: -50.9423, lng: -73.4068, country: 'CL', comment: 'One of the most beautiful national parks in the world. The W Trek was challenging but amazing!', rating: 5 },
      { name: 'Ushuaia, Argentina', lat: -54.8019, lng: -68.3030, country: 'AR', comment: 'End of the world! The Beagle Channel cruise was incredible.', rating: 5 },
    ],
    modes: ['flight', 'bus', 'bus', 'bus'] as ModeOfTravel[],
    expenses: [
      { description: 'Flight to El Calafate', amount: 450, currency: 'USD', paidBy: 'user1' },
      { description: 'Glacier tour', amount: 120, currency: 'USD', paidBy: 'user2' },
      { description: 'Hiking gear rental', amount: 180, currency: 'USD', paidBy: 'user1' },
      { description: 'National park entrance', amount: 80, currency: 'USD', paidBy: 'user2' },
      { description: 'Hostel in El Chaltén', amount: 45, currency: 'USD', paidBy: 'user1' },
    ],
  },
];

async function deleteAllFirebaseData() {
  const db = getFirestore();
  console.log('🗑️  Deleting all Firebase data...');

  const collections = ['trips', 'tripPlaces', 'tripExpenses', 'tripRoutes', 'users'];
  
  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).get();
      const batch = db.batch();
      let count = 0;
      
      snapshot.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
        count++;
      });
      
      if (count > 0) {
        await batch.commit();
        console.log(`✅ Deleted ${count} documents from ${collectionName}`);
      } else {
        console.log(`ℹ️  No documents found in ${collectionName}`);
      }
    } catch (error: any) {
      console.error(`❌ Error deleting ${collectionName}:`, error.message);
    }
  }
  
  console.log('✅ All Firebase data deleted!\n');
}

async function createDummyUsers() {
  const db = getFirestore();
  console.log('👥 Creating dummy users...');

  const users: User[] = [
    {
      uid: 'user1',
      name: 'Alex Johnson',
      email: 'alex.johnson@example.com',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
      country: 'US',
      defaultCurrency: 'USD',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    },
    {
      uid: 'user2',
      name: 'Sarah Chen',
      email: 'sarah.chen@example.com',
      photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
      country: 'CA',
      defaultCurrency: 'CAD',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    },
  ];

  const batch = db.batch();
  users.forEach((user) => {
    const userRef = db.collection('users').doc(user.uid);
    batch.set(userRef, user);
  });

  await batch.commit();
  console.log(`✅ Created ${users.length} users\n`);
  return users;
}

async function createDummyTrips(users: User[]) {
  const db = getFirestore();
  console.log('✈️  Creating dummy trips...');

  const trips: Trip[] = [];
  const now = new Date();
  
  DUMMY_TRIPS.forEach((tripData, index) => {
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - (index + 1) * 2);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + tripData.places.length * 2);
    
    const isCompleted = index < 3; // First 3 trips are completed
    
    const tripData_obj: any = {
      tripId: `trip-${index + 1}`,
      creatorId: users[0].uid,
      title: tripData.title,
      description: tripData.description,
      participants: [
        { uid: users[0].uid, isGuest: false },
        { uid: users[1].uid, isGuest: false },
      ],
      isPublic: index < 2, // First 2 trips are public
      status: isCompleted ? 'completed' : 'in_progress',
      startTime: admin.firestore.Timestamp.fromDate(startDate),
      coverImage: DUMMY_IMAGES.covers[index % DUMMY_IMAGES.covers.length],
      totalExpense: tripData.expenses.reduce((sum, e) => sum + e.amount, 0),
      totalDistance: tripData.places.length * 500, // Rough estimate
      defaultPhotoSharing: 'members',
      expenseVisibility: 'members',
      createdAt: admin.firestore.Timestamp.fromDate(startDate),
      updatedAt: admin.firestore.Timestamp.now(),
    };
    
    // Only add endTime if trip is completed
    if (isCompleted) {
      tripData_obj.endTime = admin.firestore.Timestamp.fromDate(endDate);
    }
    
    const trip: Trip = tripData_obj;
    trips.push(trip);
  });

  const batch = db.batch();
  trips.forEach((trip) => {
    const tripRef = db.collection('trips').doc(trip.tripId);
    batch.set(tripRef, trip);
  });

  await batch.commit();
  console.log(`✅ Created ${trips.length} trips\n`);
  return trips;
}

async function createDummyPlaces(trips: Trip[]) {
  const db = getFirestore();
  console.log('📍 Creating dummy places...');

  const places: TripPlace[] = [];
  let placeIndex = 0;

  trips.forEach((trip, tripIndex) => {
    const tripData = DUMMY_TRIPS[tripIndex];
    const startDate = trip.startTime instanceof admin.firestore.Timestamp 
      ? trip.startTime.toDate() 
      : trip.startTime instanceof Date
      ? trip.startTime
      : new Date(trip.startTime);
    
    tripData.places.forEach((placeData, index) => {
      const visitedAt = new Date(startDate);
      visitedAt.setDate(visitedAt.getDate() + index * 2);
      
      const placeData_obj: any = {
        placeId: `place-${placeIndex + 1}`,
        tripId: trip.tripId,
        name: placeData.name,
        coordinates: {
          lat: placeData.lat,
          lng: placeData.lng,
        },
        visitedAt: admin.firestore.Timestamp.fromDate(visitedAt),
        comment: placeData.comment,
        rewrittenComment: placeData.comment, // Same for dummy data
        rating: placeData.rating,
        imageMetadata: [
          {
            url: DUMMY_IMAGES.places[placeIndex % DUMMY_IMAGES.places.length],
            isPublic: trip.isPublic,
          },
          {
            url: DUMMY_IMAGES.places[(placeIndex + 1) % DUMMY_IMAGES.places.length],
            isPublic: trip.isPublic,
          },
        ],
        modeOfTravel: index === 0 ? 'flight' : tripData.modes[index] || 'car',
        country: placeData.country,
        createdAt: admin.firestore.Timestamp.fromDate(visitedAt),
      };
      
      // Only add distanceFromPrevious and timeFromPrevious if not the first place
      if (index > 0) {
        placeData_obj.distanceFromPrevious = 500;
        placeData_obj.timeFromPrevious = 7200; // 2 hours
      }
      
      const place: TripPlace = placeData_obj;
      
      places.push(place);
      placeIndex++;
    });
  });

  const batch = db.batch();
  places.forEach((place) => {
    const placeRef = db.collection('tripPlaces').doc(place.placeId);
    batch.set(placeRef, place);
  });

  await batch.commit();
  console.log(`✅ Created ${places.length} places\n`);
  return places;
}

async function createDummyExpenses(trips: Trip[], users: User[]) {
  const db = getFirestore();
  console.log('💰 Creating dummy expenses...');

  const expenses: TripExpense[] = [];
  let expenseIndex = 0;

  trips.forEach((trip, tripIndex) => {
    const tripData = DUMMY_TRIPS[tripIndex];
    
    tripData.expenses.forEach((expenseData, index) => {
      const paidByUid = expenseData.paidBy === 'user1' ? users[0].uid : users[1].uid;
      const splitBetween = trip.participants.map(p => p.uid || p.guestName || '').filter(Boolean);
      const shareAmount = expenseData.amount / splitBetween.length;
      
      const calculatedShares: Record<string, number> = {};
      splitBetween.forEach(uid => {
        calculatedShares[uid] = shareAmount;
      });

      const expense: TripExpense = {
        expenseId: `expense-${expenseIndex + 1}`,
        tripId: trip.tripId,
        amount: expenseData.amount,
        currency: expenseData.currency,
        paidBy: paidByUid,
        splitBetween: splitBetween,
        calculatedShares: calculatedShares,
        description: expenseData.description,
        placeId: `place-${expenseIndex + 1}`, // Link to first place of trip
        createdAt: admin.firestore.Timestamp.now(),
      };
      
      expenses.push(expense);
      expenseIndex++;
    });
  });

  const batch = db.batch();
  expenses.forEach((expense) => {
    const expenseRef = db.collection('tripExpenses').doc(expense.expenseId);
    batch.set(expenseRef, expense);
  });

  await batch.commit();
  console.log(`✅ Created ${expenses.length} expenses\n`);
  return expenses;
}

async function createDummyRoutes(trips: Trip[], places: TripPlace[]) {
  const db = getFirestore();
  console.log('🛣️  Creating dummy routes...');

  const routes: TripRoute[] = [];
  let routeIndex = 0;

  trips.forEach((trip) => {
    const tripPlaces = places.filter(p => p.tripId === trip.tripId);
    
    // Create routes between consecutive places
    for (let i = 0; i < tripPlaces.length - 1; i++) {
      const fromPlace = tripPlaces[i];
      const toPlace = tripPlaces[i + 1];
      const mode = fromPlace.modeOfTravel || 'car';
      
      // Generate route points (simplified - just start and end)
      const routePoints = [
        {
          lat: fromPlace.coordinates.lat,
          lng: fromPlace.coordinates.lng,
          timestamp: fromPlace.visitedAt instanceof admin.firestore.Timestamp 
            ? fromPlace.visitedAt 
            : fromPlace.visitedAt instanceof Date
            ? admin.firestore.Timestamp.fromDate(fromPlace.visitedAt)
            : admin.firestore.Timestamp.fromDate(new Date(fromPlace.visitedAt)),
          modeOfTravel: mode,
        },
        {
          lat: toPlace.coordinates.lat,
          lng: toPlace.coordinates.lng,
          timestamp: toPlace.visitedAt instanceof admin.firestore.Timestamp 
            ? toPlace.visitedAt 
            : toPlace.visitedAt instanceof Date
            ? admin.firestore.Timestamp.fromDate(toPlace.visitedAt)
            : admin.firestore.Timestamp.fromDate(new Date(toPlace.visitedAt)),
          modeOfTravel: mode,
        },
      ];

      const route: TripRoute = {
        routeId: `route-${routeIndex + 1}`,
        tripId: trip.tripId,
        points: routePoints,
        modeOfTravel: mode,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };
      
      routes.push(route);
      routeIndex++;
    }
  });

  const batch = db.batch();
  routes.forEach((route) => {
    const routeRef = db.collection('tripRoutes').doc(route.routeId);
    batch.set(routeRef, route);
  });

  await batch.commit();
  console.log(`✅ Created ${routes.length} routes\n`);
  return routes;
}

async function main() {
  try {
    console.log('🚀 Starting dummy data seeding...\n');
    
    // Initialize Firebase Admin
    initializeFirebase();
    
    // Delete all existing data
    await deleteAllFirebaseData();
    
    // Create dummy data
    const users = await createDummyUsers();
    const trips = await createDummyTrips(users);
    const places = await createDummyPlaces(trips);
    const expenses = await createDummyExpenses(trips, users);
    const routes = await createDummyRoutes(trips, places);
    
    console.log('✨ Seeding complete!');
    console.log(`📊 Summary:`);
    console.log(`   - ${users.length} users`);
    console.log(`   - ${trips.length} trips`);
    console.log(`   - ${places.length} places`);
    console.log(`   - ${expenses.length} expenses`);
    console.log(`   - ${routes.length} routes`);
    console.log('\n🎉 All dummy data has been created successfully!');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

main();

