/**
 * Message Formatting Utility for XLoop
 *
 * Loads messages from messages.json and provides formatting functions.
 * Supports variable substitution with {key} placeholders.
 *
 * @module @crateon/xloop/utils/messages
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load messages from JSON file
 * @returns {Object} Messages object
 */
function loadMessages() {
  try {
    const messagesPath = join(__dirname, '..', 'messages.json');
    const content = readFileSync(messagesPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`[xloop] Failed to load messages: ${error.message}`);
    return {};
  }
}

/** Cached messages object */
const messages = loadMessages();

/**
 * Get a message by dot-notation key and format with variables
 *
 * @param {string} key - Dot-notation key (e.g., 'loop.iteration')
 * @param {Object} [vars={}] - Variables to substitute
 * @returns {string} Formatted message
 *
 * @example
 * msg('loop.iteration', { current: 5, max: 10 })
 * // Returns: "🔄 Iteration 5/10"
 */
export function msg(key, vars = {}) {
  // Navigate to nested key
  let text = key.split('.').reduce((obj, k) => obj?.[k], messages);

  // Return key if not found
  if (text === undefined || text === null) {
    return key;
  }

  // Handle arrays (return joined)
  if (Array.isArray(text)) {
    return text.join('\n');
  }

  // Handle objects (return JSON for debugging)
  if (typeof text === 'object') {
    return JSON.stringify(text);
  }

  // Convert to string and substitute variables
  text = String(text);
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }

  return text;
}

/**
 * Get help text formatted for display
 * @returns {string} Formatted help text
 */
export function getHelpText() {
  const help = messages.help || {};

  const lines = [
    help.title || 'XLoop',
    '',
    help.usage || 'Usage: /xloop "task" [options]',
    '',
    'Options:',
    `  ${help.options?.max || '--max=N'}`,
    `  ${help.options?.promise || '--promise="TEXT"'}`,
    '',
    'Examples:'
  ];

  if (help.examples) {
    for (const example of help.examples) {
      lines.push(`  ${example}`);
    }
  }

  if (help.runEpic) {
    lines.push('');
    lines.push('With /run-epic:');
    lines.push(`  ${help.runEpic}`);
  }

  lines.push('');
  lines.push('Loop ends when:');
  if (help.stopConditions) {
    for (const condition of help.stopConditions) {
      lines.push(`  • ${condition}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get status text for active loop
 * @param {Object} state - Loop state object
 * @returns {string} Formatted status text
 */
export function getStatusText(state) {
  if (!state) {
    return msg('status.inactive') + '\n\nNo active loop. Start one with:\n  /xloop "Your task" --max=10 --promise="DONE"';
  }

  const maxDisplay = state.maxIterations > 0 ? state.maxIterations : '∞';

  return [
    msg('status.active'),
    '',
    msg('status.iteration', { current: state.iteration, max: maxDisplay }),
    msg('status.task', { prompt: truncate(state.prompt, 50) }),
    msg('status.promise', { promise: state.completionPromise }),
    state.startedAt ? msg('status.started', { time: formatTime(state.startedAt) }) : ''
  ].filter(Boolean).join('\n');
}

/**
 * Get iteration banner for systemMessage
 * @param {number} current - Current iteration
 * @param {number|string} max - Max iterations or '∞'
 * @param {string} promise - Completion promise
 * @returns {string} Formatted banner
 */
export function getIterationBanner(current, max, promise) {
  const BOX_WIDTH = 37; // Inner width (between │ borders)

  const iterStr = `${current}/${max}`;
  const promiseStr = truncate(promise, 20);

  // Build content lines and pad to BOX_WIDTH
  // Note: 🔄 emoji counts as 1 char in string but 2 visually, so subtract 1
  const line1Content = `  🔄 XLOOP  ${iterStr}`;
  const line2Content = `  Promise: ${promiseStr}`;

  const line1 = '│' + line1Content.padEnd(BOX_WIDTH - 1) + '│'; // -1 for emoji width
  const line2 = '│' + line2Content.padEnd(BOX_WIDTH) + '│';

  const border = '─'.repeat(BOX_WIDTH);

  return [
    '', // Leading newline for proper display after "Stop says:"
    `┌${border}┐`,
    line1,
    line2,
    `└${border}┘`
  ].join('\n');
}

/**
 * Truncate string to max length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLen - Maximum length
 * @returns {string} Truncated string
 */
function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Format ISO timestamp for display
 * @param {string} isoTime - ISO timestamp
 * @returns {string} Formatted time
 */
function formatTime(isoTime) {
  try {
    const date = new Date(isoTime);
    return date.toLocaleString();
  } catch {
    return isoTime;
  }
}

export { messages };
