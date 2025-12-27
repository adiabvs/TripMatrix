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

async function deleteAllTripsData() {
  const db = getFirestore();
  console.log('🗑️  Deleting all trips data...');

  const collections = ['trips', 'tripPlaces', 'tripExpenses', 'tripRoutes', 'placeComments'];
  
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
  
  console.log('✅ All trips data deleted!\n');
}

async function createDummyUsers() {
  const db = getFirestore();
  console.log('👥 Creating dummy users...');

  const userNames = [
    'Alex Johnson', 'Sarah Chen', 'Michael Brown', 'Emily Davis', 'James Wilson',
    'Olivia Martinez', 'William Anderson', 'Sophia Taylor', 'Benjamin Thomas', 'Isabella Jackson',
    'Daniel White', 'Mia Harris', 'Matthew Martin', 'Charlotte Thompson', 'David Garcia',
    'Amelia Martinez', 'Joseph Rodriguez', 'Harper Lewis', 'Andrew Walker', 'Evelyn Hall',
  ];

  const countries = ['US', 'CA', 'GB', 'AU', 'FR', 'DE', 'IT', 'ES', 'JP', 'KR', 'SG', 'IN', 'BR', 'MX', 'AR', 'CL', 'NZ', 'NL', 'BE', 'CH'];
  const currencies = ['USD', 'CAD', 'GBP', 'AUD', 'EUR', 'EUR', 'EUR', 'EUR', 'JPY', 'KRW', 'SGD', 'INR', 'BRL', 'MXN', 'ARS', 'CLP', 'NZD', 'EUR', 'EUR', 'CHF'];
  const photoUrls = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
  ];

  const users: User[] = userNames.map((name, index) => ({
    uid: `user${index + 1}`,
    name,
    email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
    photoUrl: photoUrls[index % photoUrls.length],
    country: countries[index % countries.length],
    defaultCurrency: currencies[index % currencies.length],
    isProfilePublic: true, // All users have public profiles
    follows: index > 0 ? [`user${index}`] : [], // Each user follows the previous one
    createdAt: admin.firestore.Timestamp.now(),
  }));

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
  }

  console.log(`✅ Created ${users.length} users\n`);
  return users;
}

// Generate trip templates for 200+ trips
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
    // Asia
    { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, country: 'JP' },
    { name: 'Seoul, South Korea', lat: 37.5665, lng: 126.9780, country: 'KR' },
    { name: 'Bangkok, Thailand', lat: 13.7563, lng: 100.5018, country: 'TH' },
    { name: 'Singapore', lat: 1.3521, lng: 103.8198, country: 'SG' },
    { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, country: 'HK' },
    { name: 'Bali, Indonesia', lat: -8.3405, lng: 115.0920, country: 'ID' },
    { name: 'Mumbai, India', lat: 19.0760, lng: 72.8777, country: 'IN' },
    { name: 'Dubai, UAE', lat: 25.2048, lng: 55.2708, country: 'AE' },
    // Americas
    { name: 'New York, USA', lat: 40.7128, lng: -74.0060, country: 'US' },
    { name: 'Los Angeles, USA', lat: 34.0522, lng: -118.2437, country: 'US' },
    { name: 'San Francisco, USA', lat: 37.7749, lng: -122.4194, country: 'US' },
    { name: 'Toronto, Canada', lat: 43.6532, lng: -79.3832, country: 'CA' },
    { name: 'Mexico City, Mexico', lat: 19.4326, lng: -99.1332, country: 'MX' },
    { name: 'Rio de Janeiro, Brazil', lat: -22.9068, lng: -43.1729, country: 'BR' },
    { name: 'Buenos Aires, Argentina', lat: -34.6037, lng: -58.3816, country: 'AR' },
    // Oceania
    { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, country: 'AU' },
    { name: 'Melbourne, Australia', lat: -37.8136, lng: 144.9631, country: 'AU' },
    { name: 'Auckland, New Zealand', lat: -36.8485, lng: 174.7633, country: 'NZ' },
    // Africa
    { name: 'Cape Town, South Africa', lat: -33.9249, lng: 18.4241, country: 'ZA' },
    { name: 'Marrakech, Morocco', lat: 31.6295, lng: -7.9811, country: 'MA' },
  ];

  const tripTitles = [
    'Amazing Adventure', 'Epic Journey', 'Unforgettable Trip', 'Dream Destination', 'Incredible Experience',
    'Wonderful Escape', 'Magical Tour', 'Spectacular Voyage', 'Fantastic Expedition', 'Memorable Getaway',
    'Beautiful Discovery', 'Stunning Exploration', 'Remarkable Travel', 'Extraordinary Trip', 'Inspiring Journey',
    'Breathtaking Adventure', 'Magnificent Tour', 'Phenomenal Experience', 'Astonishing Voyage', 'Marvelous Escape',
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

  for (let i = 0; i < 200; i++) {
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
        description: ['Hotel', 'Restaurant', 'Transport', 'Activity', 'Shopping', 'Food'][Math.floor(Math.random() * 6)],
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
  console.log('✈️  Creating 200+ dummy trips...');

  const trips: Trip[] = [];
  const now = new Date();
  
  templates.forEach((tripData, index) => {
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - Math.floor(index / 10)); // Spread over months
    startDate.setDate(startDate.getDate() - (index % 30)); // Spread over days
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + tripData.places.length * 2);
    
    const isCompleted = index % 3 !== 0; // Most trips are completed
    const creatorIndex = index % users.length;
    
    const tripData_obj: any = {
      tripId: `trip-${index + 1}`,
      creatorId: users[creatorIndex].uid,
      title: tripData.title,
      description: tripData.description,
      participants: [
        { uid: users[creatorIndex].uid, isGuest: false },
        ...(index % 2 === 0 ? [{ uid: users[(creatorIndex + 1) % users.length].uid, isGuest: false }] : []),
      ],
      isPublic: true, // ALL trips are public
      status: isCompleted ? 'completed' : 'in_progress',
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
    if (isCompleted) {
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

async function main() {
  try {
    console.log('🚀 Starting dummy data seeding...\n');
    
    // Initialize Firebase Admin
    initializeFirebase();
    
    // Delete all trips data (keep users)
    await deleteAllTripsData();
    
    // Get or create users
    const db = getFirestore();
    const usersSnapshot = await db.collection('users').limit(20).get();
    let users: User[] = [];
    
    if (usersSnapshot.empty) {
      users = await createDummyUsers();
    } else {
      users = usersSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      })) as User[];
      console.log(`ℹ️  Using existing ${users.length} users\n`);
    }
    
    // Generate trip templates
    const templates = generateTripTemplates();
    
    // Create dummy data
    const trips = await createDummyTrips(users, templates);
    const places = await createDummyPlaces(trips, templates);
    const expenses = await createDummyExpenses(trips, users, templates);
    const routes = await createDummyRoutes(trips, places);
    
    console.log('✨ Seeding complete!');
    console.log(`📊 Summary:`);
    console.log(`   - ${users.length} users`);
    console.log(`   - ${trips.length} trips (ALL PUBLIC)`);
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

