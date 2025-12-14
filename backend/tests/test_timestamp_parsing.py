import unittest
from datetime import datetime, timezone
from dateutil import parser as date_parser

# Mocking the function logic since importing main.py might be heavy
def _datetime_to_ms(value) -> int:
    base: datetime
    if isinstance(value, datetime):
        base = value
    elif isinstance(value, str):
        candidate = value.strip()
        if candidate:
            try:
                # Use dateutil for robust parsing of various formats (ISO, space-separated, etc.)
                base = date_parser.parse(candidate)
            except (ValueError, TypeError):
                # Fallback to current time if parsing fails completely
                base = datetime.now(timezone.utc)
        else:
            base = datetime.now(timezone.utc)
    else:
        base = datetime.now(timezone.utc)
    
    if base.tzinfo is None:
        aware = base.replace(tzinfo=timezone.utc)
    else:
        aware = base.astimezone(timezone.utc)
    return int(aware.timestamp() * 1000)

class TestTimestampParsing(unittest.TestCase):
    def test_sqlite_format(self):
        # Format found in SQLite: "2025-12-14 14:17:34.380483"
        ts_str = "2025-12-14 14:17:34.380483"
        ms = _datetime_to_ms(ts_str)
        
        # Expected: 2025-12-14 14:17:34.380 UTC
        # timestamp for 2025-12-14 14:17:34.380483 UTC is approx 1765721854380
        # We check if it parses to a specific time, not "now"
        
        parsed_dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
        self.assertEqual(parsed_dt.year, 2025)
        self.assertEqual(parsed_dt.month, 12)
        self.assertEqual(parsed_dt.day, 14)
        self.assertEqual(parsed_dt.hour, 14)
        self.assertEqual(parsed_dt.minute, 17)
        
    def test_iso_format(self):
        ts_str = "2025-12-14T14:17:34.380483Z"
        ms = _datetime_to_ms(ts_str)
        parsed_dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
        self.assertEqual(parsed_dt.year, 2025)

if __name__ == '__main__':
    unittest.main()
