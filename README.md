# json-diff

Compare and diff two JSON files.

## Usage

```bash
python json_diff.py path/to/left.json path/to/right.json
```

Output format:

```json
{
  "equal": false,
  "differences": [
    {"path": "$.field", "type": "changed", "old": 1, "new": 2}
  ]
}
```
