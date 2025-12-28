import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

import { initializeFirebase, getFirestore } from '../src/config/firebase.js';
import type { Trip, TripPlace, TripExpense, TripRoute, User, ModeOfTravel, PlaceComment } from '@tripmatrix/types';
import admin from 'firebase-admin';

// Free high-quality travel images from Unsplash
const DUMMY_IMAGES = {
  covers: [
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=1200&h=800&fit=crop',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&h=800&fit=crop',
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

const COMMENT_TEXTS = [
  'Amazing place! Would definitely visit again.',
  'Stunning views and great atmosphere. Highly recommend!',
  'The food here was incredible. Best meal of the trip!',
  'Beautiful architecture and rich history. Loved it!',
  'Perfect spot for photos. The sunset was breathtaking!',
  'Great experience! The locals were so friendly.',
  'One of the highlights of my trip. Unforgettable!',
  'Beautiful location with amazing vibes. Will come back!',
  'The culture here is fascinating. Learned so much!',
  'Absolutely loved this place! Worth every moment.',
  'Incredible destination. The memories will last forever!',
  'Perfect blend of nature and culture. Amazing!',
  'The best part of my journey. Truly special!',
  'Stunning location with so much to explore.',
  'An experience I will never forget. Magical!',
];

async function deleteAllData() {
  const db = getFirestore();
  console.log('🗑️  Deleting all data...');

  const collections = [
    'users', 
    'trips', 
    'tripPlaces', 
    'tripExpenses', 
    'tripRoutes', 
    'placeComments',
    'tripLikes',
    'placeLikes',
  ];
  
  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).get();
      const batchSize = 500; // Firestore batch limit
      let totalDeleted = 0;
      
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        const batchDocs = docs.slice(i, i + batchSize);
        
        batchDocs.forEach((docSnapshot) => {
          batch.delete(docSnapshot.ref);
        });
        
        await batch.commit();
        totalDeleted += batchDocs.length;
        console.log(`   Deleted ${totalDeleted}/${docs.length} from ${collectionName}...`);
      }
      
      if (totalDeleted > 0) {
        console.log(`✅ Deleted ${totalDeleted} documents from ${collectionName}`);
      } else {
        console.log(`ℹ️  No documents found in ${collectionName}`);
      }
    } catch (error: any) {
      console.error(`❌ Error deleting ${collectionName}:`, error.message);
    }
  }
  
  console.log('✅ All data deleted!\n');
}

async function createDummyUsers() {
  const db = getFirestore();
  console.log('👥 Creating 100 dummy users...');

  const firstNames = [
    'Alex', 'Sarah', 'Michael', 'Emily', 'James', 'Olivia', 'William', 'Sophia', 'Benjamin', 'Isabella',
    'Daniel', 'Mia', 'Matthew', 'Charlotte', 'David', 'Amelia', 'Joseph', 'Harper', 'Andrew', 'Evelyn',
    'Ryan', 'Grace', 'Christopher', 'Lily', 'Joshua', 'Ava', 'Nathan', 'Zoe', 'Jonathan', 'Chloe',
    'Samuel', 'Emma', 'Nicholas', 'Maya', 'Tyler', 'Sofia', 'Brandon', 'Aria', 'Justin', 'Scarlett',
    'Kevin', 'Victoria', 'Eric', 'Madison', 'Brian', 'Luna', 'Jacob', 'Aurora', 'Noah', 'Hazel',
    'Ethan', 'Nora', 'Lucas', 'Penelope', 'Mason', 'Eleanor', 'Logan', 'Stella', 'Jackson', 'Layla',
    'Aiden', 'Riley', 'Carter', 'Natalie', 'Owen', 'Zoe', 'Wyatt', 'Lillian', 'Luke', 'Addison',
    'Henry', 'Aubrey', 'Jack', 'Ellie', 'Levi', 'Hannah', 'Sebastian', 'Aaliyah', 'Julian', 'Natalia',
    'Aaron', 'Savannah', 'Eli', 'Leah', 'Landon', 'Audrey', 'Connor', 'Bella', 'Caleb', 'Skylar',
  ];

  const lastNames = [
    'Johnson', 'Chen', 'Brown', 'Davis', 'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Jackson',
    'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Rodriguez', 'Lewis', 'Walker', 'Hall', 'Allen',
    'Young', 'King', 'Wright', 'Lopez', 'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Nelson',
    'Carter', 'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards',
    'Collins', 'Stewart', 'Sanchez', 'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan', 'Bell', 'Murphy',
    'Bailey', 'Rivera', 'Cooper', 'Richardson', 'Cox', 'Howard', 'Ward', 'Torres', 'Peterson', 'Gray',
    'Ramirez', 'James', 'Watson', 'Brooks', 'Kelly', 'Sanders', 'Price', 'Bennett', 'Wood', 'Barnes',
  ];

  const countries = ['US', 'CA', 'GB', 'AU', 'FR', 'DE', 'IT', 'ES', 'JP', 'KR', 'SG', 'IN', 'BR', 'MX', 'AR', 'CL', 'NZ', 'NL', 'BE', 'CH'];
  const currencies = ['USD', 'CAD', 'GBP', 'AUD', 'EUR', 'EUR', 'EUR', 'EUR', 'JPY', 'KRW', 'SGD', 'INR', 'BRL', 'MXN', 'ARS', 'CLP', 'NZD', 'EUR', 'EUR', 'CHF'];
  const photoUrls = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
  ];

  const users: User[] = [];
  const numUsers = 100;

  for (let i = 0; i < numUsers; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
    const name = `${firstName} ${lastName}`;
    
    // Create following relationships - each user follows 5-15 random users
    const follows: string[] = [];
    const numFollows = Math.floor(Math.random() * 11) + 5; // 5-15 follows
    const followedIndices = new Set<number>();
    
    while (follows.length < numFollows && followedIndices.size < numUsers - 1) {
      const followIndex = Math.floor(Math.random() * numUsers);
      if (followIndex !== i && !followedIndices.has(followIndex)) {
        followedIndices.add(followIndex);
        follows.push(`user${followIndex + 1}`);
      }
    }

    users.push({
      uid: `user${i + 1}`,
      name,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
      photoUrl: photoUrls[i % photoUrls.length],
      country: countries[i % countries.length],
      defaultCurrency: currencies[i % currencies.length],
      isProfilePublic: true,
      follows,
      createdAt: admin.firestore.Timestamp.now(),
    });
  }

  // Write in batches
  const batchSize = 500;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = db.batch();
    const batchUsers = users.slice(i, i + batchSize);
    batchUsers.forEach((user) => {
      const userRef = db.collection('users').doc(user.uid);
      batch.set(userRef, user);
    });
    await batch.commit();
    console.log(`   Created ${Math.min(i + batchSize, users.length)}/${users.length} users...`);
  }

  console.log(`✅ Created ${users.length} users with following relationships\n`);
  return users;
}

// Generate trip templates for 250+ trips
function generateTripTemplates(): Array<{
  title: string;
  description: string;
  places: Array<{ name: string; lat: number; lng: number; country: string; comment: string; rating: number }>;
  modes: ModeOfTravel[];
  expenses: Array<{ description: string; amount: number; currency: string }>;
}> {
  const cities = [
    // Europe
    { name: 'Paris, France', lat: 48.8566, lng: 2.3522, country: 'FR' },
    { name: 'London, UK', lat: 51.5074, lng: -0.1278, country: 'GB' },
    { name: 'Rome, Italy', lat: 41.9028, lng: 12.4964, country: 'IT' },
    { name: 'Barcelona, Spain', lat: 41.3851, lng: 2.1734, country: 'ES' },
    { name: 'Amsterdam, Netherlands', lat: 52.3676, lng: 4.9041, country: 'NL' },
    { name: 'Berlin, Germany', lat: 52.5200, lng: 13.4050, country: 'DE' },
    { name: 'Vienna, Austria', lat: 48.2082, lng: 16.3738, country: 'AT' },
    { name: 'Prague, Czech Republic', lat: 50.0755, lng: 14.4378, country: 'CZ' },
    { name: 'Budapest, Hungary', lat: 47.4979, lng: 19.0402, country: 'HU' },
    { name: 'Lisbon, Portugal', lat: 38.7223, lng: -9.1393, country: 'PT' },
    { name: 'Istanbul, Turkey', lat: 41.0082, lng: 28.9784, country: 'TR' },
    { name: 'Athens, Greece', lat: 37.9838, lng: 23.7275, country: 'GR' },
    { name: 'Dublin, Ireland', lat: 53.3498, lng: -6.2603, country: 'IE' },
    { name: 'Stockholm, Sweden', lat: 59.3293, lng: 18.0686, country: 'SE' },
    { name: 'Copenhagen, Denmark', lat: 55.6761, lng: 12.5683, country: 'DK' },
    // Asia
    { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, country: 'JP' },
    { name: 'Seoul, South Korea', lat: 37.5665, lng: 126.9780, country: 'KR' },
    { name: 'Bangkok, Thailand', lat: 13.7563, lng: 100.5018, country: 'TH' },
    { name: 'Singapore', lat: 1.3521, lng: 103.8198, country: 'SG' },
    { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, country: 'HK' },
    { name: 'Bali, Indonesia', lat: -8.3405, lng: 115.0920, country: 'ID' },
    { name: 'Mumbai, India', lat: 19.0760, lng: 72.8777, country: 'IN' },
    { name: 'Dubai, UAE', lat: 25.2048, lng: 55.2708, country: 'AE' },
    { name: 'Beijing, China', lat: 39.9042, lng: 116.4074, country: 'CN' },
    { name: 'Shanghai, China', lat: 31.2304, lng: 121.4737, country: 'CN' },
    { name: 'Kyoto, Japan', lat: 35.0116, lng: 135.7681, country: 'JP' },
    { name: 'Taipei, Taiwan', lat: 25.0330, lng: 121.5654, country: 'TW' },
    // Americas
    { name: 'New York, USA', lat: 40.7128, lng: -74.0060, country: 'US' },
    { name: 'Los Angeles, USA', lat: 34.0522, lng: -118.2437, country: 'US' },
    { name: 'San Francisco, USA', lat: 37.7749, lng: -122.4194, country: 'US' },
    { name: 'Miami, USA', lat: 25.7617, lng: -80.1918, country: 'US' },
    { name: 'Chicago, USA', lat: 41.8781, lng: -87.6298, country: 'US' },
    { name: 'Toronto, Canada', lat: 43.6532, lng: -79.3832, country: 'CA' },
    { name: 'Vancouver, Canada', lat: 49.2827, lng: -123.1207, country: 'CA' },
    { name: 'Mexico City, Mexico', lat: 19.4326, lng: -99.1332, country: 'MX' },
    { name: 'Rio de Janeiro, Brazil', lat: -22.9068, lng: -43.1729, country: 'BR' },
    { name: 'Buenos Aires, Argentina', lat: -34.6037, lng: -58.3816, country: 'AR' },
    { name: 'Lima, Peru', lat: -12.0464, lng: -77.0428, country: 'PE' },
    { name: 'Santiago, Chile', lat: -33.4489, lng: -70.6693, country: 'CL' },
    // Oceania
    { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, country: 'AU' },
    { name: 'Melbourne, Australia', lat: -37.8136, lng: 144.9631, country: 'AU' },
    { name: 'Auckland, New Zealand', lat: -36.8485, lng: 174.7633, country: 'NZ' },
    // Africa
    { name: 'Cape Town, South Africa', lat: -33.9249, lng: 18.4241, country: 'ZA' },
    { name: 'Marrakech, Morocco', lat: 31.6295, lng: -7.9811, country: 'MA' },
    { name: 'Cairo, Egypt', lat: 30.0444, lng: 31.2357, country: 'EG' },
  ];

  const tripTitles = [
    'Amazing Adventure', 'Epic Journey', 'Unforgettable Trip', 'Dream Destination', 'Incredible Experience',
    'Wonderful Escape', 'Magical Tour', 'Spectacular Voyage', 'Fantastic Expedition', 'Memorable Getaway',
    'Beautiful Discovery', 'Stunning Exploration', 'Remarkable Travel', 'Extraordinary Trip', 'Inspiring Journey',
    'Breathtaking Adventure', 'Magnificent Tour', 'Phenomenal Experience', 'Astonishing Voyage', 'Marvelous Escape',
    'Enchanting Expedition', 'Captivating Journey', 'Mesmerizing Adventure', 'Fascinating Discovery', 'Exhilarating Trip',
  ];

  const comments = [
    'Absolutely stunning! One of the best places I\'ve ever visited.',
    'Incredible experience! The culture and food were amazing.',
    'Beautiful architecture and friendly people. Highly recommend!',
    'A must-visit destination! The views were breathtaking.',
    'Perfect blend of history and modernity. Loved every moment!',
    'Amazing food scene and vibrant nightlife. Will definitely return!',
    'Stunning natural beauty and peaceful atmosphere.',
    'Rich history and incredible landmarks. Truly unforgettable!',
    'The perfect getaway! Relaxing beaches and warm hospitality.',
    'Incredible city with so much to explore. Already planning my next visit!',
  ];

  const modes: ModeOfTravel[] = ['flight', 'train', 'bus', 'car', 'walk', 'bike'];
  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'INR', 'BRL', 'MXN'];

  const templates: Array<{
    title: string;
    description: string;
    places: Array<{ name: string; lat: number; lng: number; country: string; comment: string; rating: number }>;
    modes: ModeOfTravel[];
    expenses: Array<{ description: string; amount: number; currency: string }>;
  }> = [];

  const numTrips = 250;
  for (let i = 0; i < numTrips; i++) {
    const numPlaces = Math.floor(Math.random() * 4) + 3; // 3-6 places
    const selectedCities = [];
    const usedIndices = new Set<number>();
    
    while (selectedCities.length < numPlaces) {
      const idx = Math.floor(Math.random() * cities.length);
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx);
        selectedCities.push(cities[idx]);
      }
    }

    const tripPlaces = selectedCities.map((city, idx) => ({
      name: city.name,
      lat: city.lat + (Math.random() - 0.5) * 0.1, // Slight variation
      lng: city.lng + (Math.random() - 0.5) * 0.1,
      country: city.country,
      comment: comments[Math.floor(Math.random() * comments.length)],
      rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
    }));

    const tripModes: ModeOfTravel[] = [];
    for (let j = 0; j < numPlaces; j++) {
      if (j === 0) {
        tripModes.push('flight');
      } else {
        tripModes.push(modes[Math.floor(Math.random() * modes.length)]);
      }
    }

    const currency = currencies[Math.floor(Math.random() * currencies.length)];
    const numExpenses = Math.floor(Math.random() * 4) + 3; // 3-6 expenses
    const expenses = [];
    for (let j = 0; j < numExpenses; j++) {
      expenses.push({
        description: ['Hotel', 'Restaurant', 'Transport', 'Activity', 'Shopping', 'Food', 'Museum', 'Tour'][Math.floor(Math.random() * 8)],
        amount: Math.floor(Math.random() * 500) + 50,
        currency,
      });
    }

    templates.push({
      title: `${tripTitles[i % tripTitles.length]} ${i + 1}`,
      description: `An incredible journey exploring ${selectedCities.map(c => c.name.split(',')[0]).join(', ')}. ${comments[Math.floor(Math.random() * comments.length)]}`,
      places: tripPlaces,
      modes: tripModes,
      expenses,
    });
  }

  return templates;
}

async function createDummyTrips(users: User[], templates: Array<{
  title: string;
  description: string;
  places: Array<{ name: string; lat: number; lng: number; country: string; comment: string; rating: number }>;
  modes: ModeOfTravel[];
  expenses: Array<{ description: string; amount: number; currency: string }>;
}>) {
  const db = getFirestore();
  console.log('✈️  Creating 250+ dummy trips...');

  const trips: Trip[] = [];
  const now = new Date();
  
  templates.forEach((tripData, index) => {
    const startDate = new Date(now);
    // Spread trips across past 12 months and future 3 months
    const monthsAgo = index % 15; // 0-14 months
    if (monthsAgo < 3) {
      // Future trips (upcoming)
      startDate.setMonth(startDate.getMonth() + (3 - monthsAgo));
    } else {
      // Past trips
      startDate.setMonth(startDate.getMonth() - (monthsAgo - 3));
    }
    startDate.setDate(startDate.getDate() - (index % 30)); // Spread over days
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + tripData.places.length * 2);
    
    // Determine status: 20% upcoming, 10% active, 70% completed
    let status: 'upcoming' | 'in_progress' | 'completed';
    if (monthsAgo < 3) {
      status = 'upcoming';
    } else if (monthsAgo === 3 && (index % 10) < 1) {
      status = 'in_progress';
    } else {
      status = 'completed';
    }
    
    const creatorIndex = index % users.length;
    const numParticipants = Math.floor(Math.random() * 3) + 1; // 1-3 participants
    const participants = [{ uid: users[creatorIndex].uid, isGuest: false }];
    
    for (let i = 1; i < numParticipants; i++) {
      const participantIndex = (creatorIndex + i) % users.length;
      participants.push({ uid: users[participantIndex].uid, isGuest: false });
    }
    
    const tripData_obj: any = {
      tripId: `trip-${index + 1}`,
      creatorId: users[creatorIndex].uid,
      title: tripData.title,
      description: tripData.description,
      participants,
      isPublic: true, // ALL trips are public
      status,
      startTime: admin.firestore.Timestamp.fromDate(startDate),
      coverImage: DUMMY_IMAGES.covers[index % DUMMY_IMAGES.covers.length],
      totalExpense: tripData.expenses.reduce((sum, e) => sum + e.amount, 0),
      totalDistance: tripData.places.length * (500 + Math.random() * 1000), // Varied distance
      defaultPhotoSharing: 'everyone',
      expenseVisibility: 'everyone',
      createdAt: admin.firestore.Timestamp.fromDate(startDate),
      updatedAt: admin.firestore.Timestamp.now(),
    };
    
    // Only add endTime if trip is completed
    if (status === 'completed') {
      tripData_obj.endTime = admin.firestore.Timestamp.fromDate(endDate);
    }
    
    const trip: Trip = tripData_obj;
    trips.push(trip);
  });

  // Write in batches (Firestore batch limit is 500)
  const batchSize = 500;
  for (let i = 0; i < trips.length; i += batchSize) {
    const batch = db.batch();
    const batchTrips = trips.slice(i, i + batchSize);
    batchTrips.forEach((trip) => {
      const tripRef = db.collection('trips').doc(trip.tripId);
      batch.set(tripRef, trip);
    });
    await batch.commit();
    console.log(`   Created ${Math.min(i + batchSize, trips.length)}/${trips.length} trips...`);
  }

  console.log(`✅ Created ${trips.length} trips\n`);
  return trips;
}

async function createDummyPlaces(trips: Trip[], templates: Array<{
  places: Array<{ name: string; lat: number; lng: number; country: string; comment: string; rating: number }>;
  modes: ModeOfTravel[];
}>) {
  const db = getFirestore();
  console.log('📍 Creating dummy places...');

  const places: TripPlace[] = [];
  let placeIndex = 0;

  trips.forEach((trip, tripIndex) => {
    const tripTemplate = templates[tripIndex];
    const startDate = trip.startTime instanceof admin.firestore.Timestamp 
      ? trip.startTime.toDate() 
      : trip.startTime instanceof Date
      ? trip.startTime
      : new Date(trip.startTime);
    
    tripTemplate.places.forEach((placeData, index) => {
      const visitedAt = new Date(startDate);
      visitedAt.setDate(visitedAt.getDate() + index * 2);
      
      // Add 1-3 images per place
      const numImages = Math.floor(Math.random() * 3) + 1;
      const imageMetadata = [];
      for (let i = 0; i < numImages; i++) {
        imageMetadata.push({
          url: DUMMY_IMAGES.places[(placeIndex + i) % DUMMY_IMAGES.places.length],
          isPublic: trip.isPublic,
        });
      }
      
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
        rewrittenComment: placeData.comment,
        rating: placeData.rating,
        imageMetadata,
        modeOfTravel: index === 0 ? 'flight' : tripTemplate.modes[index] || 'car',
        country: placeData.country,
        createdAt: admin.firestore.Timestamp.fromDate(visitedAt),
      };
      
      // Only add distanceFromPrevious and timeFromPrevious if not the first place
      if (index > 0) {
        placeData_obj.distanceFromPrevious = 500 + Math.random() * 1000;
        placeData_obj.timeFromPrevious = 3600 + Math.random() * 10800; // 1-4 hours
      }
      
      const place: TripPlace = placeData_obj;
      places.push(place);
      placeIndex++;
    });
  });

  // Write in batches
  const batchSize = 500;
  for (let i = 0; i < places.length; i += batchSize) {
    const batch = db.batch();
    const batchPlaces = places.slice(i, i + batchSize);
    batchPlaces.forEach((place) => {
      const placeRef = db.collection('tripPlaces').doc(place.placeId);
      batch.set(placeRef, place);
    });
    await batch.commit();
    console.log(`   Created ${Math.min(i + batchSize, places.length)}/${places.length} places...`);
  }

  console.log(`✅ Created ${places.length} places\n`);
  return places;
}

async function createDummyExpenses(trips: Trip[], users: User[], templates: Array<{
  expenses: Array<{ description: string; amount: number; currency: string }>;
}>) {
  const db = getFirestore();
  console.log('💰 Creating dummy expenses...');

  const expenses: TripExpense[] = [];
  let expenseIndex = 0;
  let placeIndex = 0;

  trips.forEach((trip, tripIndex) => {
    const tripTemplate = templates[tripIndex];
    
    tripTemplate.expenses.forEach((expenseData, index) => {
      const paidByIndex = Math.floor(Math.random() * trip.participants.length);
      const paidByUid = trip.participants[paidByIndex]?.uid || users[0].uid;
      const splitBetween = trip.participants.map(p => p.uid || p.guestName || '').filter(Boolean);
      const shareAmount = expenseData.amount / splitBetween.length;
      
      const calculatedShares: Record<string, number> = {};
      splitBetween.forEach(uid => {
        calculatedShares[uid] = shareAmount;
      });

      // Link expense to a place in the trip
      const placeId = `place-${placeIndex + 1 + index}`;

      const expense: TripExpense = {
        expenseId: `expense-${expenseIndex + 1}`,
        tripId: trip.tripId,
        amount: expenseData.amount,
        currency: expenseData.currency,
        paidBy: paidByUid,
        splitBetween: splitBetween,
        calculatedShares: calculatedShares,
        description: expenseData.description,
        placeId: placeId,
        createdAt: admin.firestore.Timestamp.now(),
      };
      
      expenses.push(expense);
      expenseIndex++;
    });
    
    placeIndex += tripTemplate.places.length;
  });

  // Write in batches
  const batchSize = 500;
  for (let i = 0; i < expenses.length; i += batchSize) {
    const batch = db.batch();
    const batchExpenses = expenses.slice(i, i + batchSize);
    batchExpenses.forEach((expense) => {
      const expenseRef = db.collection('tripExpenses').doc(expense.expenseId);
      batch.set(expenseRef, expense);
    });
    await batch.commit();
    console.log(`   Created ${Math.min(i + batchSize, expenses.length)}/${expenses.length} expenses...`);
  }

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

async function createDummyLikesAndComments(trips: Trip[], places: TripPlace[], users: User[]) {
  const db = getFirestore();
  console.log('❤️  Creating dummy likes and comments...');

  let tripLikeIndex = 0;
  let placeLikeIndex = 0;
  let commentIndex = 0;
  const batchSize = 500;

  // Collect all trip likes first
  const tripLikes: Array<{ tripId: string; userId: string; createdAt: admin.firestore.Timestamp }> = [];
  for (const trip of trips) {
    const numLikes = Math.floor(Math.random() * 46) + 5; // 5-50 likes
    const likedBy = new Set<string>();
    
    while (likedBy.size < numLikes && likedBy.size < users.length) {
      const userIndex = Math.floor(Math.random() * users.length);
      const userId = users[userIndex].uid;
      
      // Don't like own trips
      if (userId !== trip.creatorId && !likedBy.has(userId)) {
        likedBy.add(userId);
        tripLikes.push({
          tripId: trip.tripId,
          userId,
          createdAt: admin.firestore.Timestamp.now(),
        });
      }
    }
  }

  // Write trip likes in batches
  for (let i = 0; i < tripLikes.length; i += batchSize) {
    const batch = db.batch();
    const batchLikes = tripLikes.slice(i, i + batchSize);
    batchLikes.forEach((like) => {
      const likeRef = db.collection('tripLikes').doc();
      batch.set(likeRef, like);
    });
    await batch.commit();
    tripLikeIndex += batchLikes.length;
    console.log(`   Created ${tripLikeIndex}/${tripLikes.length} trip likes...`);
  }

  // Collect all place likes first
  const placeLikes: Array<{ placeId: string; userId: string; createdAt: admin.firestore.Timestamp }> = [];
  for (const place of places) {
    const numLikes = Math.floor(Math.random() * 19) + 2; // 2-20 likes
    const likedBy = new Set<string>();
    
    // Get trip to find creator
    const trip = trips.find(t => t.tripId === place.tripId);
    const creatorId = trip?.creatorId || '';
    
    while (likedBy.size < numLikes && likedBy.size < users.length) {
      const userIndex = Math.floor(Math.random() * users.length);
      const userId = users[userIndex].uid;
      
      // Don't like own places
      if (userId !== creatorId && !likedBy.has(userId)) {
        likedBy.add(userId);
        placeLikes.push({
          placeId: place.placeId,
          userId,
          createdAt: admin.firestore.Timestamp.now(),
        });
      }
    }
  }

  // Write place likes in batches
  for (let i = 0; i < placeLikes.length; i += batchSize) {
    const batch = db.batch();
    const batchLikes = placeLikes.slice(i, i + batchSize);
    batchLikes.forEach((like) => {
      const likeRef = db.collection('placeLikes').doc();
      batch.set(likeRef, like);
    });
    await batch.commit();
    placeLikeIndex += batchLikes.length;
    console.log(`   Created ${placeLikeIndex}/${placeLikes.length} place likes...`);
  }

  // Collect all comments first
  const comments: PlaceComment[] = [];
  for (const place of places) {
    const numComments = Math.floor(Math.random() * 10) + 1; // 1-10 comments
    const commentedBy = new Set<string>();
    
    while (commentedBy.size < numComments && commentedBy.size < users.length) {
      const userIndex = Math.floor(Math.random() * users.length);
      const userId = users[userIndex].uid;
      
      if (!commentedBy.has(userId)) {
        commentedBy.add(userId);
        comments.push({
          commentId: `comment-${commentIndex + 1}`,
          placeId: place.placeId,
          userId,
          text: COMMENT_TEXTS[Math.floor(Math.random() * COMMENT_TEXTS.length)],
          createdAt: new Date(),
        });
        commentIndex++;
      }
    }
  }

  // Write comments in batches
  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = db.batch();
    const batchComments = comments.slice(i, i + batchSize);
    batchComments.forEach((comment) => {
      const commentRef = db.collection('placeComments').doc(comment.commentId);
      batch.set(commentRef, comment);
    });
    await batch.commit();
    console.log(`   Created ${Math.min(i + batchSize, comments.length)}/${comments.length} comments...`);
  }

  console.log(`✅ Created ${tripLikeIndex} trip likes, ${placeLikeIndex} place likes, and ${comments.length} comments\n`);
}

async function main() {
  try {
    console.log('🚀 Starting comprehensive dummy data seeding...\n');
    
    // Initialize Firebase Admin
    initializeFirebase();
    
    // Delete all data
    await deleteAllData();
    
    // Create users with following relationships
    const users = await createDummyUsers();
    
    // Generate trip templates
    const templates = generateTripTemplates();
    
    // Create dummy data
    const trips = await createDummyTrips(users, templates);
    const places = await createDummyPlaces(trips, templates);
    const expenses = await createDummyExpenses(trips, users, templates);
    const routes = await createDummyRoutes(trips, places);
    
    // Create likes and comments
    await createDummyLikesAndComments(trips, places, users);
    
    console.log('✨ Seeding complete!');
    console.log(`📊 Summary:`);
    console.log(`   - ${users.length} users (with following relationships)`);
    console.log(`   - ${trips.length} trips (ALL PUBLIC, mixed statuses)`);
    console.log(`   - ${places.length} places`);
    console.log(`   - ${expenses.length} expenses`);
    console.log(`   - ${routes.length} routes`);
    console.log(`   - Likes and comments on trips and places`);
    console.log('\n🎉 All dummy data has been created successfully!');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

main();
