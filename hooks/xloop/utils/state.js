/**
 * State Management for XLoop
 *
 * Handles reading, writing, and deleting the loop state file.
 * Uses atomic writes (temp file + rename) to prevent corruption.
 *
 * State file location: .claude/xloop.state.json
 *
 * @module @crateon/xloop/utils/state
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, renameSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

/** Default state file name */
const STATE_FILE = 'xloop.state.json';

/** Default state directory */
const STATE_DIR = '.claude';

/**
 * Get the path to the state file
 * @param {string} [workDir=process.cwd()] - Working directory
 * @returns {string} Full path to state file
 */
export function getStatePath(workDir = process.cwd()) {
  return join(workDir, STATE_DIR, STATE_FILE);
}

/**
 * Read the current loop state
 * @param {string} [workDir=process.cwd()] - Working directory
 * @returns {Object|null} State object or null if no state exists
 */
export function readState(workDir = process.cwd()) {
  const statePath = getStatePath(workDir);

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    // State file is corrupted - treat as no state
    console.error(`[xloop] Warning: corrupted state file: ${error.message}`);
    return null;
  }
}

/**
 * Write loop state to file
 * Uses atomic write (temp file + rename) to prevent corruption
 *
 * @param {Object} state - State object to write
 * @param {string} state.prompt - Original task prompt
 * @param {number} state.iteration - Current iteration number
 * @param {number} state.maxIterations - Maximum iterations allowed
 * @param {string} state.completionPromise - Phrase to detect completion
 * @param {string} [state.startedAt] - ISO timestamp when loop started
 * @param {string} [workDir=process.cwd()] - Working directory
 */
export function writeState(state, workDir = process.cwd()) {
  const statePath = getStatePath(workDir);
  const stateDir = dirname(statePath);

  // Ensure directory exists
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  // Add timestamp if not present
  if (!state.startedAt) {
    state.startedAt = new Date().toISOString();
  }

  // Atomic write: write to temp file, then rename
  const tempPath = `${statePath}.${randomBytes(4).toString('hex')}.tmp`;

  try {
    writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
    renameSync(tempPath, statePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Delete the state file (stop the loop)
 * @param {string} [workDir=process.cwd()] - Working directory
 * @returns {boolean} True if file was deleted, false if it didn't exist
 */
export function deleteState(workDir = process.cwd()) {
  const statePath = getStatePath(workDir);

  if (!existsSync(statePath)) {
    return false;
  }

  try {
    unlinkSync(statePath);
    return true;
  } catch (error) {
    console.error(`[xloop] Warning: failed to delete state: ${error.message}`);
    return false;
  }
}

/**
 * Check if a loop is currently active
 * @param {string} [workDir=process.cwd()] - Working directory
 * @returns {boolean}
 */
export function isLoopActive(workDir = process.cwd()) {
  return readState(workDir) !== null;
}

/**
 * Create initial state for a new loop
 * @param {string} prompt - Task prompt
 * @param {Object} [options] - Loop options
 * @param {number} [options.maxIterations=10] - Maximum iterations
 * @param {string} [options.completionPromise='DONE'] - Completion phrase
 * @returns {Object} Initial state object
 */
export function createInitialState(prompt, options = {}) {
  return {
    prompt,
    iteration: 0,
    maxIterations: options.maxIterations ?? 10,
    completionPromise: options.completionPromise ?? 'DONE',
    startedAt: new Date().toISOString()
  };
}
