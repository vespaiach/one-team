#!/bin/bash
set -e

# Check if directory argument is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-spec-directory>"
  echo "Example: $0 specs/007-comments-activity-feeds"
  exit 1
fi

SPEC_DIR="$1"

if [ ! -d "$SPEC_DIR" ]; then
  echo "Error: Directory $SPEC_DIR does not exist."
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
SPEC_DIR="$(cd "$SPEC_DIR" && pwd)"
SPEC_NAME="$(basename "$SPEC_DIR")"

PROGRESS_DIR="$REPO_ROOT/.claude/spec-to-tasks"
STATE_FILE="$PROGRESS_DIR/$SPEC_NAME.state"
mkdir -p "$PROGRESS_DIR"

LAST_STEP=0

if [ -f "$STATE_FILE" ]; then
  echo "Found saved progress for $SPEC_NAME, resuming..."
  # shellcheck disable=SC1090
  source "$STATE_FILE"

  if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    if [ -d "$WORKTREE_DIR" ]; then
      echo "Reusing existing worktree at $WORKTREE_DIR..."
    else
      echo "Recreating worktree at $WORKTREE_DIR for branch $BRANCH..."
      git -C "$REPO_ROOT" worktree add "$WORKTREE_DIR" "$BRANCH"
      if [ -f "$REPO_ROOT/package.json" ]; then
        (cd "$WORKTREE_DIR" && npm install)
      fi
    fi
  else
    echo "Saved branch $BRANCH no longer exists; starting over."
    rm -f "$STATE_FILE"
    LAST_STEP=0
  fi
fi

if [ ! -f "$STATE_FILE" ]; then
  SUFFIX="$(date +%s)-$$"
  BRANCH="tasks/$SPEC_NAME-$SUFFIX"
  WORKTREE_DIR="$REPO_ROOT/.claude/worktrees/$SPEC_NAME-$SUFFIX"
  LAST_STEP=0

  echo "Setting up isolated worktree for $SPEC_NAME..."

  if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "Error: branch $BRANCH already exists. Remove it or choose a different spec." >&2
    exit 1
  fi

  git -C "$REPO_ROOT" worktree add "$WORKTREE_DIR" -b "$BRANCH"

  if [ -f "$REPO_ROOT/package.json" ]; then
    (cd "$WORKTREE_DIR" && npm install)
  fi

  {
    echo "BRANCH=$BRANCH"
    echo "WORKTREE_DIR=$WORKTREE_DIR"
    echo "LAST_STEP=$LAST_STEP"
  } > "$STATE_FILE"
fi

WORKTREE_SPEC_DIR="$WORKTREE_DIR/specs/$SPEC_NAME"

cd "$WORKTREE_DIR"

echo "Starting task building for $WORKTREE_SPEC_DIR..."

# Optimized prompts for clarity, context, and direct action
PROMPTS=(
  "Run the speckit-checklist skill for specs/$SPEC_NAME to generate a comprehensive checklist."
  "Review the generated checklist and existing documentation in specs/$SPEC_NAME. Mark checklist items as 'true' or 'resolved' if they are already covered."
  "Review the remaining unresolved checklist items in specs/$SPEC_NAME. Generate solutions and directly update the relevant documentation files to incorporate these fixes."
  "Run the speckit-tasks skill for specs/$SPEC_NAME to generate tasks.md based on the updated spec."
  "Run the speckit-analyze skill for specs/$SPEC_NAME to evaluate documentation consistency."
  "Review the speckit-analyze report for specs/$SPEC_NAME. Directly update spec.md, plan.md, and tasks.md to resolve any identified conflicts, gaps, or ambiguities."
)

for PROMPT_NUMBER in "${!PROMPTS[@]}"; do
  PROMPT_INDEX=$((PROMPT_NUMBER + 1))

  if [ "$PROMPT_INDEX" -le "$LAST_STEP" ]; then
    echo "Skipping Prompt $PROMPT_INDEX (already completed): ${PROMPTS[$PROMPT_NUMBER]}"
    continue
  fi

  echo "Running Prompt $PROMPT_INDEX: ${PROMPTS[$PROMPT_NUMBER]}"
  claude --dangerously-skip-permissions -p "${PROMPTS[$PROMPT_NUMBER]}"

  {
    echo "BRANCH=$BRANCH"
    echo "WORKTREE_DIR=$WORKTREE_DIR"
    echo "LAST_STEP=$PROMPT_INDEX"
  } > "$STATE_FILE"
done

echo "Task building complete."

if [ -z "$(git -C "$WORKTREE_DIR" status --porcelain)" ]; then
  echo "No changes produced; skipping commit and PR."
  rm -f "$STATE_FILE"
  exit 0
fi

echo "Committing and pushing changes..."
git -C "$WORKTREE_DIR" add -A
git -C "$WORKTREE_DIR" commit -m "Build tasks for $SPEC_NAME"
git -C "$WORKTREE_DIR" push -u origin "$BRANCH"

echo "Opening pull request..."
gh pr create \
  --repo vespaiach/one-team \
  --base main \
  --head "$BRANCH" \
  --title "Build tasks for $SPEC_NAME" \
  --body "Automated checklist resolution and task generation for \`specs/$SPEC_NAME\`."

rm -f "$STATE_FILE"

echo "Done."
