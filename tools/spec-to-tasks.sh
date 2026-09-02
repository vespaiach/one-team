#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path-to-spec-directory>"
  echo "Example: $0 specs/007-comments-activity-feeds"
  exit 1
fi

if [ ! -d "$1" ]; then
  echo "Error: Directory $1 does not exist." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
SPEC_DIR="$(cd "$1" && pwd)"
SPEC_NAME="$(basename "$SPEC_DIR")"

case "$SPEC_DIR" in
  "$REPO_ROOT"/*) ;;
  *)
    echo "Error: $SPEC_DIR is outside the repository at $REPO_ROOT." >&2
    exit 1
    ;;
esac

PROGRESS_DIR="$REPO_ROOT/.claude/spec-to-tasks"
STATE_FILE="$PROGRESS_DIR/$SPEC_NAME.state"
mkdir -p "$PROGRESS_DIR"

BRANCH=""
WORKTREE_DIR=""
BASE_SHA=""

save_state() {
  local tmp="$STATE_FILE.tmp"
  {
    printf 'BRANCH=%q\n' "$BRANCH"
    printf 'WORKTREE_DIR=%q\n' "$WORKTREE_DIR"
    printf 'BASE_SHA=%q\n' "$BASE_SHA"
  } > "$tmp"
  mv "$tmp" "$STATE_FILE"
}

install_dependencies() {
  if [ -f "$WORKTREE_DIR/package.json" ]; then
    (cd "$WORKTREE_DIR" && npm install)
  fi
}

if [ -f "$STATE_FILE" ]; then
  echo "Found saved progress for $SPEC_NAME, resuming..."
  # shellcheck disable=SC1090
  source "$STATE_FILE"

  if [ -z "$BRANCH" ] || [ -z "$WORKTREE_DIR" ] || [ -z "$BASE_SHA" ]; then
    echo "Saved progress is incomplete; starting over."
    rm -f "$STATE_FILE"
  elif ! git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "Saved branch $BRANCH no longer exists; starting over."
    rm -f "$STATE_FILE"
  fi
fi

if [ -f "$STATE_FILE" ]; then
  if [ "$(git -C "$WORKTREE_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || true)" = "$BRANCH" ]; then
    echo "Reusing existing worktree at $WORKTREE_DIR..."
  elif [ -e "$WORKTREE_DIR" ]; then
    echo "Error: $WORKTREE_DIR exists but is not a worktree for $BRANCH." >&2
    echo "Remove it, or delete $STATE_FILE to start over." >&2
    exit 1
  else
    echo "Recreating worktree at $WORKTREE_DIR for branch $BRANCH..."
    git -C "$REPO_ROOT" worktree prune
    git -C "$REPO_ROOT" worktree add "$WORKTREE_DIR" "$BRANCH"
    install_dependencies
  fi
else
  SUFFIX="$(date +%s)-$$"
  BRANCH="tasks/$SPEC_NAME-$SUFFIX"
  WORKTREE_DIR="$REPO_ROOT/.claude/worktrees/$SPEC_NAME-$SUFFIX"

  echo "Setting up isolated worktree for $SPEC_NAME..."
  git -C "$REPO_ROOT" fetch --quiet origin main
  BASE_SHA="$(git -C "$REPO_ROOT" rev-parse origin/main)"

  if ! git -C "$REPO_ROOT" cat-file -e "$BASE_SHA:specs/$SPEC_NAME" 2>/dev/null; then
    echo "Error: specs/$SPEC_NAME is not on origin/main, which the worktree branches from." >&2
    echo "Commit and push the spec to main first." >&2
    exit 1
  fi

  git -C "$REPO_ROOT" worktree add "$WORKTREE_DIR" -b "$BRANCH" "$BASE_SHA"
  install_dependencies
  save_state
fi

WORKTREE_SPEC_DIR="$WORKTREE_DIR/specs/$SPEC_NAME"

cd "$WORKTREE_DIR"

COMPLETED_STEPS="$(git rev-list --count "$BASE_SHA..HEAD")"

if [ -n "$(git status --porcelain)" ]; then
  ABANDONED_STEP=$((COMPLETED_STEPS + 1))
  git add -A
  git commit --quiet --message "spec-to-tasks: abandoned partial step $ABANDONED_STEP"
  echo "Discarded partial output from step $ABANDONED_STEP; recoverable at $(git rev-parse HEAD)"
  git reset --quiet --hard HEAD~1
fi

verify_step_artifact() {
  case "$1" in
    1)
      if [ -z "$(find "specs/$SPEC_NAME/checklists" -type f -print -quit 2>/dev/null)" ]; then
        echo "Error: step 1 produced no checklist in specs/$SPEC_NAME/checklists." >&2
        exit 1
      fi
      ;;
    4)
      if [ ! -f "specs/$SPEC_NAME/tasks.md" ]; then
        echo "Error: step 4 produced no specs/$SPEC_NAME/tasks.md." >&2
        exit 1
      fi
      ;;
  esac
}

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

for PROMPT_INDEX in "${!PROMPTS[@]}"; do
  STEP_NUMBER=$((PROMPT_INDEX + 1))

  if [ "$STEP_NUMBER" -le "$COMPLETED_STEPS" ]; then
    echo "Skipping step $STEP_NUMBER (already completed): ${PROMPTS[$PROMPT_INDEX]}"
    continue
  fi

  echo "Running step $STEP_NUMBER: ${PROMPTS[$PROMPT_INDEX]}"
  claude --dangerously-skip-permissions -p "${PROMPTS[$PROMPT_INDEX]}"

  verify_step_artifact "$STEP_NUMBER"

  git add -A
  git commit --quiet --allow-empty --message "spec-to-tasks: step $STEP_NUMBER for $SPEC_NAME"
done

echo "Task building complete."

if git diff --quiet "$BASE_SHA" HEAD; then
  echo "No changes produced; skipping push and pull request."
  rm -f "$STATE_FILE"
  exit 0
fi

echo "Pushing $BRANCH..."
git push --quiet -u origin "$BRANCH"

EXISTING_PR="$(gh pr list --repo vespaiach/one-team --head "$BRANCH" --state open --json url --jq '.[0].url // empty')"

if [ -n "$EXISTING_PR" ]; then
  echo "Pull request already open: $EXISTING_PR"
else
  echo "Opening pull request..."
  gh pr create \
    --repo vespaiach/one-team \
    --base main \
    --head "$BRANCH" \
    --title "Build tasks for $SPEC_NAME" \
    --body "Automated checklist resolution and task generation for \`specs/$SPEC_NAME\`."
fi

rm -f "$STATE_FILE"

echo "Done."
