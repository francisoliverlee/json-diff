#!/usr/bin/env python3
"""Compare and diff two JSON documents."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict, List


def compare_json(left: Any, right: Any) -> bool:
    """Return True when two JSON values are structurally equal."""
    return left == right


def diff_json(left: Any, right: Any, path: str = "$") -> List[Dict[str, Any]]:
    """Return a list of differences between two JSON values."""
    differences: List[Dict[str, Any]] = []

    if isinstance(left, dict) and isinstance(right, dict):
        left_keys = set(left.keys())
        right_keys = set(right.keys())

        for key in sorted(left_keys - right_keys):
            differences.append({"path": f"{path}.{key}", "type": "removed", "old": left[key]})
        for key in sorted(right_keys - left_keys):
            differences.append({"path": f"{path}.{key}", "type": "added", "new": right[key]})
        for key in sorted(left_keys & right_keys):
            differences.extend(diff_json(left[key], right[key], f"{path}.{key}"))
        return differences

    if isinstance(left, list) and isinstance(right, list):
        common_length = min(len(left), len(right))
        for index in range(common_length):
            differences.extend(diff_json(left[index], right[index], f"{path}[{index}]"))
        for index in range(common_length, len(left)):
            differences.append({"path": f"{path}[{index}]", "type": "removed", "old": left[index]})
        for index in range(common_length, len(right)):
            differences.append({"path": f"{path}[{index}]", "type": "added", "new": right[index]})
        return differences

    if left != right:
        if type(left) is not type(right):
            differences.append(
                {
                    "path": path,
                    "type": "type_changed",
                    "old": left,
                    "new": right,
                    "old_type": type(left).__name__,
                    "new_type": type(right).__name__,
                }
            )
        else:
            differences.append({"path": path, "type": "changed", "old": left, "new": right})

    return differences


def _load_json(path: str) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Invalid JSON in '{path}': {exc.msg} at line {exc.lineno}, column {exc.colno}"
        ) from exc


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare and diff two JSON files")
    parser.add_argument("left", help="Path to first JSON file")
    parser.add_argument("right", help="Path to second JSON file")
    args = parser.parse_args()

    try:
        left = _load_json(args.left)
        right = _load_json(args.right)
    except (OSError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 2

    is_equal = compare_json(left, right)
    differences = diff_json(left, right)

    print(json.dumps({"equal": is_equal, "differences": differences}, indent=2))
    return 0 if is_equal else 1


if __name__ == "__main__":
    raise SystemExit(main())
