#!/usr/bin/env bash
# Bisection script to find which test creates unwanted files/state.
#
# Usage:   ./find-polluter.sh <file_or_dir_to_check> <test_pattern>
# Example: ./find-polluter.sh '.git' 'src/**/*.test.ts'
#
# Pattern uses bash globstar, so '**' matches any number of directories.
# Quote the pattern so the shell passes it through unexpanded; this script
# expands it using globstar so the behaviour is consistent across macOS
# (BSD find) and Linux (GNU find), which disagree on how '-path' treats '**'.

set -eu
shopt -s globstar nullglob

if [ $# -ne 2 ]; then
  echo "Usage: $0 <file_to_check> <test_pattern>"
  echo "Example: $0 '.git' 'src/**/*.test.ts'"
  exit 1
fi

POLLUTION_CHECK="$1"
TEST_PATTERN="$2"

echo "🔍 Searching for test that creates: $POLLUTION_CHECK"
echo "Test pattern: $TEST_PATTERN"
echo ""

# Expand the pattern via bash globstar, then sort.
# Word-splitting on the unquoted variable is intentional: it triggers glob
# expansion of the pattern contained in the variable.
# shellcheck disable=SC2206
TEST_FILES=( $TEST_PATTERN )
IFS=$'\n' read -r -d '' -a TEST_FILES < <(printf '%s\n' "${TEST_FILES[@]}" | sort && printf '\0')
TOTAL=${#TEST_FILES[@]}

if [ "$TOTAL" -eq 0 ]; then
  echo "❌ No files matched pattern: $TEST_PATTERN"
  exit 1
fi

echo "Found $TOTAL test files"
echo ""

COUNT=0
for TEST_FILE in "${TEST_FILES[@]}"; do
  COUNT=$((COUNT + 1))

  # Skip if pollution already exists
  if [ -e "$POLLUTION_CHECK" ]; then
    echo "⚠️  Pollution already exists before test $COUNT/$TOTAL"
    echo "   Skipping: $TEST_FILE"
    continue
  fi

  echo "[$COUNT/$TOTAL] Testing: $TEST_FILE"

  # Run the test
  npm test "$TEST_FILE" > /dev/null 2>&1 || true

  # Check if pollution appeared
  if [ -e "$POLLUTION_CHECK" ]; then
    echo ""
    echo "🎯 FOUND POLLUTER!"
    echo "   Test: $TEST_FILE"
    echo "   Created: $POLLUTION_CHECK"
    echo ""
    echo "Pollution details:"
    ls -la "$POLLUTION_CHECK"
    echo ""
    echo "To investigate:"
    echo "  npm test $TEST_FILE    # Run just this test"
    echo "  cat $TEST_FILE         # Review test code"
    exit 1
  fi
done

echo ""
echo "✅ No polluter found - all tests clean!"
exit 0
