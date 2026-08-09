#!/usr/bin/env node
/**
 * XLoop Stop Hook
 *
 * Main loop control hook for Claude Code.
 * Intercepts exit attempts and decides whether to continue the loop.
 *
 * Input (stdin): JSON with hook_type, transcript_path, etc.
 * Output (stdout): JSON with decision (approve/block) and optional stopReason
 *
 * @module @crateon/xloop/hooks/stop-hook
 */

import fs from 'fs';
import path from 'path';
import { readState, writeState, deleteState } from './utils/state.js';
import { getLastAssistantMessageEfficient } from './utils/transcript.js';
import { checkCompletion } from './utils/promise.js';

/**
 * Debug flag - initialized once at module load
 * Checks XLOOP_DEBUG env var, then .xloop.json config file
 */
const DEBUG = (() => {
  if (process.env.XLOOP_DEBUG === '1' || process.env.XLOOP_DEBUG === 'true') {
    return true;
  }
  try {
    const configPath = path.join(process.cwd(), '.xloop.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.debug === true;
    }
  } catch (e) {
    // Ignore config read errors
  }
  return false;
})();

/**
 * Read JSON input from stdin
 * @returns {Promise<Object>} Parsed input object
 */
async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });

    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error(`Failed to parse stdin: ${error.message}`));
      }
    });

    process.stdin.on('error', reject);

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!data) {
        reject(new Error('Stdin read timeout'));
      }
    }, 5000);
  });
}

/**
 * Output decision to stdout
 * @param {Object} decision - Decision object
 * @param {string} decision.decision - 'approve' or 'block'
 * @param {string} [decision.reason] - Reason for decision
 * @param {string} [decision.stopReason] - Reason for stopping (shown to user)
 */
function output(decision) {
  console.log(JSON.stringify(decision));
}

/**
 * Debug logging (writes to file and stderr)
 * Uses module-level DEBUG constant (initialized once at load)
 */
function debug(msg) {
  if (!DEBUG) return;

  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${msg}\n`;

  // Write to file (primary - visible to user)
  try {
    const logPath = path.join(process.cwd(), '.claude', 'xloop.debug.log');
    fs.appendFileSync(logPath, logLine);
  } catch (e) {
    // Ignore write errors
  }

  // Also stderr
  console.error(`[xloop:debug] ${msg}`);
}

/**
 * Main hook logic
 */
async function main() {
  try {
    // Read hook input
    const input = await readStdin();
    debug(`Input: ${JSON.stringify(input)}`);
    debug(`transcript_path: ${input.transcript_path || 'NOT PROVIDED'}`);

    // Read current loop state
    const state = readState();
    debug(`State: ${state ? JSON.stringify(state) : 'null'}`);

    // No active loop - approve exit
    if (!state) {
      debug('No active loop state - approving exit');
      return output({ decision: 'approve' });
    }

    // Check max iterations
    if (state.maxIterations > 0 && state.iteration >= state.maxIterations) {
      debug(`Max iterations reached: ${state.iteration}/${state.maxIterations}`);
      deleteState();
      return output({
        decision: 'approve',
        stopReason: `Max iterations reached (${state.maxIterations})`
      });
    }

    // Get last assistant message from transcript
    const transcriptPath = input.transcript_path;
    let lastMessage = null;

    if (transcriptPath) {
      lastMessage = getLastAssistantMessageEfficient(transcriptPath);
      debug(`Last message length: ${lastMessage ? lastMessage.length : 0}`);
      debug(`Last message preview: ${lastMessage ? lastMessage.substring(0, 200) : 'null'}...`);
    } else {
      debug('No transcript_path in input!');
    }

    // Check for completion promise in output
    debug(`Checking for promise: "${state.completionPromise}"`);
    const hasPromise = lastMessage && checkCompletion(lastMessage, state.completionPromise);
    debug(`Promise detected: ${hasPromise}`);

    if (hasPromise) {
      deleteState();
      return output({
        decision: 'approve',
        stopReason: `Task complete: detected "${state.completionPromise}"`
      });
    }

    // Continue loop - increment iteration and block exit
    state.iteration++;
    writeState(state);

    const iterationInfo = state.maxIterations > 0
      ? `${state.iteration}/${state.maxIterations}`
      : `${state.iteration}`;

    return output({
      decision: 'block',
      reason: `[xloop] Iteration ${iterationInfo} - ${state.prompt}`
    });

  } catch (error) {
    // On error, approve exit to prevent infinite loops
    console.error(`[xloop] Error: ${error.message}`);
    return output({
      decision: 'approve',
      stopReason: `Hook error: ${error.message}`
    });
  }
}

// Run main function
main().catch(error => {
  console.error(`[xloop] Fatal error: ${error.message}`);
  output({ decision: 'approve', stopReason: 'Fatal error' });
  process.exit(1);
});
