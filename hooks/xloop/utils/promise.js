/**
 * Promise Detection for XLoop
 *
 * Detects completion promises in Claude's output.
 * Looks for <promise>TEXT</promise> tags or exact phrase matches.
 *
 * @module @crateon/xloop/utils/promise
 */

/**
 * Regular expression to match promise tags
 * Matches: <promise>TEXT</promise> or <promise>TEXT</promise>
 */
const PROMISE_REGEX = /<promise>\s*([\s\S]*?)\s*<\/promise>/gi;

/**
 * Extract all promises from text
 * @param {string} text - Text to search for promises
 * @returns {string[]} Array of promise texts found
 */
export function extractPromises(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const promises = [];
  let match;

  // Reset regex lastIndex
  PROMISE_REGEX.lastIndex = 0;

  while ((match = PROMISE_REGEX.exec(text)) !== null) {
    const promiseText = match[1].trim();
    if (promiseText) {
      promises.push(promiseText);
    }
  }

  return promises;
}

/**
 * Extract the first promise from text
 * @param {string} text - Text to search
 * @returns {string|null} First promise text or null
 */
export function extractPromise(text) {
  const promises = extractPromises(text);
  return promises.length > 0 ? promises[0] : null;
}

/**
 * Normalize text for comparison
 * - Trims whitespace
 * - Collapses multiple spaces
 * - Optionally lowercases
 *
 * @param {string} text - Text to normalize
 * @param {boolean} [caseSensitive=true] - Whether to preserve case
 * @returns {string} Normalized text
 */
export function normalizeText(text, caseSensitive = true) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let normalized = text.trim().replace(/\s+/g, ' ');

  if (!caseSensitive) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * Check if text contains the completion promise
 *
 * Checks in order:
 * 1. Promise tags: <promise>EXPECTED</promise>
 * 2. Exact phrase match in text
 *
 * @param {string} text - Text to check (Claude's output)
 * @param {string} expectedPromise - Expected completion phrase
 * @param {Object} [options] - Options
 * @param {boolean} [options.caseSensitive=true] - Case sensitive matching
 * @param {boolean} [options.exactMatch=false] - Require exact match (not substring)
 * @returns {boolean} True if completion detected
 */
export function checkCompletion(text, expectedPromise, options = {}) {
  const { caseSensitive = true, exactMatch = false } = options;

  if (!text || !expectedPromise) {
    return false;
  }

  // Normalize expected promise
  const normalizedExpected = normalizeText(expectedPromise, caseSensitive);

  // 1. Check promise tags first
  const promises = extractPromises(text);
  for (const promise of promises) {
    const normalizedPromise = normalizeText(promise, caseSensitive);
    if (exactMatch) {
      if (normalizedPromise === normalizedExpected) {
        return true;
      }
    } else {
      if (normalizedPromise.includes(normalizedExpected) ||
          normalizedExpected.includes(normalizedPromise)) {
        return true;
      }
    }
  }

  // 2. Check for phrase in text (if not using tags)
  const normalizedText = normalizeText(text, caseSensitive);

  if (exactMatch) {
    // For exact match, check word boundaries
    const escapedPromise = normalizedExpected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedPromise}\\b`, caseSensitive ? '' : 'i');
    return regex.test(text);
  }

  return normalizedText.includes(normalizedExpected);
}

/**
 * Check if text indicates task completion
 * Looks for common completion indicators
 *
 * @param {string} text - Text to check
 * @returns {boolean} True if completion indicators found
 */
export function hasCompletionIndicators(text) {
  if (!text) return false;

  const lowerText = text.toLowerCase();

  // Common completion phrases
  const indicators = [
    'task complete',
    'task completed',
    'all done',
    'finished',
    'completed successfully',
    'no more tasks',
    'nothing left to do'
  ];

  return indicators.some(indicator => lowerText.includes(indicator));
}
