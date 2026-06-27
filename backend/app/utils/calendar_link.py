from urllib.parse import urlencode
from datetime import datetime, timedelta, timezone


def build_calendar_url(title: str, description: str, start_dt: datetime, duration_minutes: int = 60) -> str:
    base = "https://calendar.google.com/calendar/render"
    params = {
        "action": "TEMPLATE",
        "text": title,
        "details": description,
        "dates": _format_dates(start_dt, duration_minutes),
        "sprop": "",
        "sprop_name": "Skill Swap",
    }
    return f"{base}?{urlencode(params)}"


def _format_dates(dt: datetime, duration_minutes: int) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    end = dt + timedelta(minutes=duration_minutes)
    start = dt.strftime("%Y%m%dT%H%M%SZ")
    end_str = end.strftime("%Y%m%dT%H%M%SZ")
    return f"{start}/{end_str}"
