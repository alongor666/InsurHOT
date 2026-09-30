#!/usr/bin/env bash
# Runs the backend invariant tests that can pass while the M0.3a paid lock is in place: whole files
# listed in tests/paid-lock-blocked.txt are left out, cases in tests/paid-lock-blocked-cases.txt are
# skipped by name. Same flags as `npm test`; needs DATABASE_URL on a *_test / *_ci database.
set -eu
cd "$(dirname "$0")/.."
strip() { sed -e 's/#.*$//' -e 's/[[:space:]]*$//' -e '/^$/d' "$1"; }
files=$(ls tests/*.test.ts | grep -vxF -f <(strip tests/paid-lock-blocked.txt) || true)
# Case names are matched as a regular expression: escape their metacharacters, then join with '|'.
skip=$(strip tests/paid-lock-blocked-cases.txt | sed -e 's/[][\\.^$*+?(){}|]/\\&/g' | paste -sd '|' -)
echo "running: $(printf '%s\n' "$files" | wc -l | tr -d ' ') files; skipping $(strip tests/paid-lock-blocked-cases.txt | wc -l | tr -d ' ') cases"
# An empty pattern would skip every test, so it is only passed when the list has entries.
skip_args=(); [ -n "$skip" ] && skip_args=(--test-skip-pattern="$skip")
# shellcheck disable=SC2086
# ${arr[@]+...}: an empty array is "unbound" under set -u before bash 4.4 (macOS ships 3.2).
exec node --test --test-concurrency=1 --test-timeout=120000 ${skip_args[@]+"${skip_args[@]}"} $files
