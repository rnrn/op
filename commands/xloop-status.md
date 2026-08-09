# /xloop-status - Check Loop Status

Display the current xloop status and configuration.

## Usage

```
/xloop-status
```

## Output

Shows:
- Whether a loop is active
- Current iteration number
- Maximum iterations
- Completion phrase being monitored
- When the loop started
- Original task prompt

## Example Output

```
XLoop Status: ACTIVE

  Iteration:    3/10
  Started:      2026-01-04 12:30:00
  Promise:      "DONE"
  Task:         "Process all markdown files in docs/"
```

Or if no loop:

```
XLoop Status: INACTIVE

No active loop. Start one with:
  /xloop "Your task" --max=10 --promise="DONE"
```

## Instructions for Claude

When this command is invoked:

1. Check if `.claude/xloop.state.json` exists
2. If exists:
   - Read the state file
   - Display formatted status with all fields
3. If not exists:
   - Report no active loop
   - Show usage hint

$ARGUMENTS
