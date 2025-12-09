import type { RoutePoint, ExpenseSummary, Settlement, TripExpense } from '@tripmatrix/types';

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate total distance from route points
 */
export function calculateTotalDistance(points: RoutePoint[]): number {
  if (points.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    totalDistance += calculateDistance(
      prev.lat,
      prev.lng,
      curr.lat,
      curr.lng
    );
  }
  return totalDistance;
}

/**
 * Calculate duration in seconds between two timestamps
 */
export function calculateDuration(
  startTime: Date | string,
  endTime: Date | string
): number {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  return Math.floor((end.getTime() - start.getTime()) / 1000);
}

/**
 * Calculate expense shares for participants
 */
export function calculateExpenseShares(
  amount: number,
  participants: string[]
): Record<string, number> {
  if (participants.length === 0) return {};
  
  const sharePerPerson = amount / participants.length;
  const shares: Record<string, number> = {};
  
  participants.forEach((participant) => {
    shares[participant] = sharePerPerson;
  });
  
  return shares;
}

/**
 * Calculate simplified expense settlements (minimize transfers)
 */
export function calculateSettlements(expenses: TripExpense[]): Settlement[] {
  // Calculate net balance for each participant
  const balances: Record<string, number> = {};
  
  expenses.forEach((expense) => {
    // Person who paid gets credited
    if (!balances[expense.paidBy]) {
      balances[expense.paidBy] = 0;
    }
    balances[expense.paidBy] += expense.amount;
    
    // People who owe get debited
    expense.splitBetween.forEach((participant) => {
      if (!balances[participant]) {
        balances[participant] = 0;
      }
      balances[participant] -= expense.calculatedShares[participant] || 0;
    });
  });
  
  // Separate creditors and debtors
  const creditors: Array<{ name: string; amount: number }> = [];
  const debtors: Array<{ name: string; amount: number }> = [];
  
  Object.entries(balances).forEach(([name, balance]) => {
    if (balance > 0.01) {
      creditors.push({ name, amount: balance });
    } else if (balance < -0.01) {
      debtors.push({ name, amount: Math.abs(balance) });
    }
  });
  
  // Sort by amount (largest first)
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);
  
  // Minimize transfers using greedy algorithm
  const settlements: Settlement[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    
    const settlementAmount = Math.min(creditor.amount, debtor.amount);
    
    settlements.push({
      from: debtor.name,
      to: creditor.name,
      amount: Math.round(settlementAmount * 100) / 100, // Round to 2 decimals
    });
    
    creditor.amount -= settlementAmount;
    debtor.amount -= settlementAmount;
    
    if (creditor.amount < 0.01) creditorIndex++;
    if (debtor.amount < 0.01) debtorIndex++;
  }
  
  return settlements;
}

/**
 * Calculate expense summary for a trip
 */
export function calculateExpenseSummary(
  expenses: TripExpense[],
  places: Array<{ placeId: string; name: string }>
): ExpenseSummary {
  const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  const expensePerPlace: Record<string, number> = {};
  expenses.forEach((exp) => {
    if (exp.placeId) {
      if (!expensePerPlace[exp.placeId]) {
        expensePerPlace[exp.placeId] = 0;
      }
      expensePerPlace[exp.placeId] += exp.amount;
    }
  });
  
  // Calculate split due for each person
  const splitDue: Record<string, number> = {};
  expenses.forEach((expense) => {
    expense.splitBetween.forEach((participant) => {
      if (!splitDue[participant]) {
        splitDue[participant] = 0;
      }
      splitDue[participant] += expense.calculatedShares[participant] || 0;
    });
    
    // Subtract what they paid
    if (!splitDue[expense.paidBy]) {
      splitDue[expense.paidBy] = 0;
    }
    splitDue[expense.paidBy] -= expense.amount;
  });
  
  const settlements = calculateSettlements(expenses);
  
  return {
    totalSpent,
    expensePerPlace,
    expensePerCategory: {}, // Can be extended later
    splitDue,
    settlements,
  };
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.length > 0 ? parts.join(' ') : '0m';
}

/**
 * Format distance in kilometers to human-readable string
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(2)}km`;
}

/**
 * Extract username mentions from text (e.g., @username)
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Replace mentions with user links or guest names
 */
export function processMentions(
  text: string,
  userMap: Record<string, { uid: string; name: string }>
): string {
  return text.replace(/@(\w+)/g, (match, username) => {
    const user = userMap[username.toLowerCase()];
    if (user) {
      return `@${user.name}`;
    }
    return match; // Keep as-is if user not found
  });
}

