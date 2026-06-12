/**
 * Transcript Parser for XLoop
 *
 * Parses Claude Code's JSONL transcript format to extract messages.
 * Efficiently reads large files by streaming from the end.
 *
 * @module @crateon/xloop/utils/transcript
 */

import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';

/**
 * Parse a JSONL transcript file
 * @param {string} transcriptPath - Path to transcript.jsonl file
 * @returns {Array<Object>} Array of parsed message objects
 */
export function parseTranscript(transcriptPath) {
  if (!existsSync(transcriptPath)) {
    return [];
  }

  try {
    const content = readFileSync(transcriptPath, 'utf8');
    const lines = content.trim().split('\n');

    return lines
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    console.error(`[xloop] Warning: failed to parse transcript: ${error.message}`);
    return [];
  }
}

/**
 * Get the last assistant message from transcript
 * @param {string} transcriptPath - Path to transcript.jsonl file
 * @returns {string|null} Text content of last assistant message, or null
 */
export function getLastAssistantMessage(transcriptPath) {
  const messages = parseTranscript(transcriptPath);

  // Find last assistant message (search from end)
  // Claude Code uses "type" field, not "role" field at top level
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === 'assistant') {
      return extractTextContent(msg);
    }
  }

  return null;
}

/**
 * Extract text content from a message object
 * Handles both Claude Code format (message.message.content) and legacy format (message.content)
 *
 * @param {Object} message - Message object
 * @returns {string} Extracted text content
 */
export function extractTextContent(message) {
  if (!message) {
    return '';
  }

  // Claude Code format: content is in message.message.content
  // Legacy format: content is in message.content
  const content = message.message?.content || message.content;

  if (!content) {
    return '';
  }

  // Simple string content
  if (typeof content === 'string') {
    return content;
  }

  // Content blocks array
  if (Array.isArray(content)) {
    return content
      .filter(block => block.type === 'text')
      .map(block => block.text || '')
      .join('\n');
  }

  return '';
}

/**
 * Get last N lines from a file efficiently (for large files)
 * @param {string} filePath - Path to file
 * @param {number} [n=100] - Number of lines to read
 * @returns {string[]} Array of last N lines
 */
export function getLastLines(filePath, n = 100) {
  if (!existsSync(filePath)) {
    return [];
  }

  const stats = statSync(filePath);
  const fileSize = stats.size;

  // For small files, just read the whole thing
  if (fileSize < 1024 * 1024) {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    return lines.slice(-n);
  }

  // For large files, read from the end
  const chunkSize = Math.min(fileSize, 64 * 1024); // 64KB chunks
  const buffer = Buffer.alloc(chunkSize);
  const fd = openSync(filePath, 'r');

  try {
    let position = fileSize - chunkSize;
    if (position < 0) position = 0;

    readSync(fd, buffer, 0, chunkSize, position);
    const content = buffer.toString('utf8');
    const lines = content.trim().split('\n');

    // If we didn't get enough lines and there's more file, recursively get more
    if (lines.length < n && position > 0) {
      // For simplicity, fall back to full read for now
      closeSync(fd);
      const fullContent = readFileSync(filePath, 'utf8');
      return fullContent.trim().split('\n').slice(-n);
    }

    return lines.slice(-n);
  } finally {
    closeSync(fd);
  }
}

/**
 * Get last assistant message efficiently (for large transcripts)
 * @param {string} transcriptPath - Path to transcript.jsonl file
 * @returns {string|null} Text content of last assistant message, or null
 */
export function getLastAssistantMessageEfficient(transcriptPath) {
  const lastLines = getLastLines(transcriptPath, 50);

  // Parse and find last assistant message
  // Claude Code uses "type" field, not "role" field at top level
  for (let i = lastLines.length - 1; i >= 0; i--) {
    try {
      const msg = JSON.parse(lastLines[i]);
      if (msg.type === 'assistant') {
        return extractTextContent(msg);
      }
    } catch {
      // Skip unparseable lines
    }
  }

  // Fall back to full parse if not found in last 50 lines
  return getLastAssistantMessage(transcriptPath);
}
