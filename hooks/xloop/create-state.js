#!/usr/bin/env node
/**
 * XLoop State Creator
 *
 * Creates the xloop state file from command line arguments.
 * Usage: node create-state.js "prompt" [--max=N] [--promise="TEXT"]
 *
 * @module @crateon/xloop/create-state
 */

import { writeState, createInitialState, getStatePath } from './utils/state.js';

function parseArgs(args) {
  const result = {
    prompt: '',
    maxIterations: 10,
    completionPromise: 'DONE'
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    // --max=N or -m N
    if (arg.startsWith('--max=')) {
      result.maxIterations = parseInt(arg.split('=')[1], 10) || 10;
    } else if (arg === '--max' || arg === '-m') {
      i++;
      result.maxIterations = parseInt(args[i], 10) || 10;
    }
    // --promise="TEXT" or -p "TEXT"
    else if (arg.startsWith('--promise=')) {
      result.completionPromise = arg.split('=')[1].replace(/^["']|["']$/g, '');
    } else if (arg === '--promise' || arg === '-p') {
      i++;
      result.completionPromise = (args[i] || 'DONE').replace(/^["']|["']$/g, '');
    }
    // Prompt (first non-option argument)
    else if (!arg.startsWith('-') && !result.prompt) {
      result.prompt = arg.replace(/^["']|["']$/g, '');
    }

    i++;
  }

  return result;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node create-state.js "prompt" [--max=N] [--promise="TEXT"]');
    process.exit(1);
  }

  const options = parseArgs(args);

  if (!options.prompt) {
    console.error('Error: prompt is required');
    process.exit(1);
  }

  const state = createInitialState(options.prompt, {
    maxIterations: options.maxIterations,
    completionPromise: options.completionPromise
  });

  try {
    writeState(state);
  } catch (error) {
    console.error(`[xloop] Error: Failed to create state file: ${error.message}`);
    process.exit(1);
  }

  const statePath = getStatePath();
  console.log(`[xloop] Loop started:`);
  console.log(`  Prompt: ${options.prompt}`);
  console.log(`  Max iterations: ${options.maxIterations === 0 ? 'unlimited' : options.maxIterations}`);
  console.log(`  Completion promise: "${options.completionPromise}"`);
  console.log(`  State file: ${statePath}`);
}

main();
