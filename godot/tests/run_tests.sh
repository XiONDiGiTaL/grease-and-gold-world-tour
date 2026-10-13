#!/bin/sh
# Imports assets, runs the headless suite, and FAILS on any SCRIPT ERROR (not just failed asserts).
GD="${GODOT:-godot}"
cd "$(dirname "$0")/.." || exit 1
"$GD" --headless --path . --import >/dev/null 2>&1
OUT=$("$GD" --headless --path . --script res://tests/test.gd 2>&1)
echo "$OUT" | grep -E "^(PASS|FAIL|==|[0-9]+ passed)|SCRIPT ERROR|Parse Error"
if echo "$OUT" | grep -q -E "SCRIPT ERROR|Parse Error|^FAIL"; then echo "TESTS FAILED"; exit 1; fi
echo "TESTS OK"
