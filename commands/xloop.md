# /xloop - Start Long-Running Loop

Start a loop that will continue executing until completion or max iterations.

## Usage

```
/xloop "Your task description" [options]
```

## Options

- `--max=N` or `-m N` - Maximum iterations (default: 10, 0 = unlimited)
- `--promise="TEXT"` or `-p "TEXT"` - Completion phrase to detect (default: "DONE")

## Examples

```
/xloop "Process all markdown files in docs/"
/xloop "Refactor the API endpoints" --max=20
/xloop "Fix all lint errors" --promise="All errors fixed"
/xloop "Run tests and fix failures" -m 5 -p "All tests pass"
```

## How It Works

1. Creates a state file at `.claude/xloop.state.json`
2. Executes your task
3. When Claude attempts to exit, the stop hook intercepts
4. If completion phrase found in output OR max iterations reached → exit
5. Otherwise → continue with original prompt

## Completion Detection

The loop ends when:
- Claude outputs `<promise>DONE</promise>` (or your custom phrase)
- The phrase appears anywhere in Claude's response
- Max iterations is reached

## Instructions for Claude

When this command is invoked, you MUST follow these steps:

### Step 1: Parse arguments from $ARGUMENTS

Extract from the arguments:
- **prompt**: The task description (text not starting with `-`)
- **maxIterations**: Value after `--max=` or `-m` (default: 10)
- **completionPromise**: Value after `--promise=` or `-p` (default: "DONE")

### Step 2: Create the state file

Use the **Write tool** to create `.claude/xloop.state.json`:

```json
{
  "prompt": "<EXTRACTED_PROMPT>",
  "maxIterations": <EXTRACTED_MAX>,
  "completionPromise": "<EXTRACTED_PROMISE>",
  "iteration": 0,
  "startedAt": "<CURRENT_ISO_TIMESTAMP>"
}
```

**IMPORTANT**: Do NOT use Bash to create this file. Use the Write tool directly.

### Step 3: Confirm and execute

After creating the state file, output:
```
[xloop] Loop started:
  Prompt: <prompt>
  Max iterations: <max>
  Completion promise: "<promise>"
```

Then begin working on the task.

### Step 4: Signal completion

When the task is FULLY complete, output:
```
<promise>DONE</promise>
```

Or use your custom completion phrase if specified.

### Step 5: If not complete

If you cannot complete in one iteration, finish your current step. The Stop hook will automatically continue the loop.

$ARGUMENTS
