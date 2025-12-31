/**
 * Parse @mentions from comment text and return highlighted HTML
 */
export function highlightMentions(text: string): string {
  // Match @username patterns (alphanumeric, underscore, hyphen, dot)
  const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
  
  return text.replace(mentionRegex, (match) => {
    return `<span class="text-blue-400 font-semibold">${match}</span>`;
  });
}

/**
 * Check if text contains @mentions
 */
export function hasMentions(text: string): boolean {
  const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
  return mentionRegex.test(text);
}


