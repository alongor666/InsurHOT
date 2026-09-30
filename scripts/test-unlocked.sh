#!/usr/bin/env sh
# Runs the backend invariant tests that can pass while the M0.3a paid lock is in place: whole files
# listed in tests/paid-lock-blocked.txt are left out, cases in tests/paid-lock-blocked-cases.txt are
# skipped by name. Same flags as `npm test`; needs DATABASE_URL on a *_test / *_ci database.
set -eu
cd "$(dirname "$0")/.."
strip() { sed -e 's/#.*$//' -e 's/[[:space:]]*$//' -e '/^$/d' "$1"; }
files=$(ls tests/*.test.ts | grep -vxF -f <(strip tests/paid-lock-blocked.txt) || true)
skip=$(strip tests/paid-lock-blocked-cases.txt | paste -sd '|' -)
echo "running: $(printf '%s\n' "$files" | wc -l | tr -d ' ') files; skipping cases: $skip"
# shellcheck disable=SC2086
exec node --test --test-concurrency=1 --test-timeout=120000 --test-skip-pattern="$skip" $files
