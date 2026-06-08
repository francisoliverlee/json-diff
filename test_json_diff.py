import unittest

from json_diff import compare_json, diff_json


class JsonDiffTests(unittest.TestCase):
    def test_compare_json_equal(self):
        self.assertTrue(compare_json({"a": 1, "b": [1, 2]}, {"b": [1, 2], "a": 1}))

    def test_compare_json_not_equal(self):
        self.assertFalse(compare_json({"a": 1}, {"a": 2}))

    def test_diff_json_reports_nested_changes(self):
        left = {"a": 1, "b": {"x": 1, "y": [1, 2]}, "c": True}
        right = {"a": 1, "b": {"x": 2, "y": [1, 3], "z": 9}, "d": "new"}

        differences = diff_json(left, right)

        self.assertEqual(
            differences,
            [
                {"path": "$.c", "type": "removed", "old": True},
                {"path": "$.d", "type": "added", "new": "new"},
                {"path": "$.b.z", "type": "added", "new": 9},
                {"path": "$.b.x", "type": "changed", "old": 1, "new": 2},
                {"path": "$.b.y[1]", "type": "changed", "old": 2, "new": 3},
            ],
        )

    def test_diff_json_reports_type_change(self):
        self.assertEqual(
            diff_json({"a": 1}, {"a": "1"}),
            [
                {
                    "path": "$.a",
                    "type": "type_changed",
                    "old": 1,
                    "new": "1",
                    "old_type": "int",
                    "new_type": "str",
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
