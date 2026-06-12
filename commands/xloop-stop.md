# /xloop-stop - Stop Current Loop

Immediately stop the current xloop execution.

## Usage

```
/xloop-stop
```

## What It Does

1. Deletes the state file `.claude/xloop.state.json`
2. The next exit attempt will succeed normally

## When to Use

- Task is complete but completion phrase wasn't detected
- Want to abort the loop early
- Loop is stuck or not progressing

## Instructions for Claude

When this command is invoked:

1. Check if `.claude/xloop.state.json` exists
2. If exists:
   - Delete the file
   - Report: "XLoop stopped. Loop was at iteration N/M."
3. If not exists:
   - Report: "No active xloop to stop."

$ARGUMENTS
