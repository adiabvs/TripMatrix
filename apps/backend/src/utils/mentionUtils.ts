import { UserModel } from '../models/User.js';

/**
 * Parse @mentions from comment text
 * Returns an array of unique mention strings (without the @ symbol)
 */
export function parseMentions(text: string): string[] {
  // Match @username patterns (alphanumeric, underscore, hyphen, dot)
  // Username pattern: @username (no spaces, can contain alphanumeric, underscore, hyphen, dot)
  const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
  const matches = text.match(mentionRegex);
  
  if (!matches) {
    return [];
  }
  
  // Extract unique mentions (remove @ symbol and convert to lowercase)
  const mentions = [...new Set(matches.map(match => match.substring(1).toLowerCase()))];
  return mentions;
}

/**
 * Find users by mention (username, email, or name)
 * Returns an array of user UIDs
 */
export async function findUsersByMention(mention: string): Promise<string[]> {
  const mentionLower = mention.toLowerCase().trim();
  
  if (!mentionLower) {
    return [];
  }
  
  try {
    // Search by username (exact match, case-insensitive)
    let users = await UserModel.find({
      username: { $regex: new RegExp(`^${mentionLower}$`, 'i') }
    });
    
    // If no username match, search by email (exact match, case-insensitive)
    if (users.length === 0) {
      users = await UserModel.find({
        email: { $regex: new RegExp(`^${mentionLower}$`, 'i') }
      });
    }
    
    // If still no match, search by name (contains match, case-insensitive)
    if (users.length === 0) {
      users = await UserModel.find({
        name: { $regex: new RegExp(mentionLower, 'i') }
      });
    }
    
    // Return unique UIDs
    const uids = users.map(user => user.uid).filter(Boolean);
    return [...new Set(uids)];
  } catch (error) {
    console.error('Error finding users by mention:', error);
    return [];
  }
}

/**
 * Find all mentioned users in a comment text
 * Returns an array of user UIDs
 */
export async function findMentionedUsers(text: string): Promise<string[]> {
  const mentions = parseMentions(text);
  
  if (mentions.length === 0) {
    return [];
  }
  
  // Find users for each mention
  const userPromises = mentions.map(mention => findUsersByMention(mention));
  const userArrays = await Promise.all(userPromises);
  
  // Flatten and get unique UIDs
  const allUids = userArrays.flat();
  return [...new Set(allUids)];
}

