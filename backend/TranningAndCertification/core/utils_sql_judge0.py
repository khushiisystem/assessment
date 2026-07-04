import json
import re
import requests
from django.conf import settings

# Deny queries that contain mutating keywords (quick heuristic)
SQL_MUTATING_PATTERN = re.compile(
    r'\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|ATTACH|GRANT|REVOKE)\b',
    re.I
)

def is_select_only(sql: str) -> bool:
    """Return True if the SQL appears to be SELECT-only (heuristic)."""
    return not SQL_MUTATING_PATTERN.search(sql)


def build_sqlite_script(schema: str, seed: str, extra_setup: str, user_sql: str, max_rows: int) -> str:
    """
    Build a single script that:
      1) creates schema and inserts seed data,
      2) runs optional per-test setup,
      3) sets query-only (readonly) mode,
      4) runs the user's SELECT (with enforced LIMIT if not present).
    """
    user_sql_clean = (user_sql or "").strip().rstrip(";")
    if not re.search(r'\blimit\b', user_sql_clean, re.I):
        user_sql_clean += f" LIMIT {max_rows}"

    parts = [
        # Ensure foreign keys before creating/insert
        "PRAGMA foreign_keys=ON;",
        (schema or "").strip(),
        (seed or "").strip(),
        (extra_setup or "").strip(),
        # After schema & seed & setup, switch to readonly for candidate query
        "PRAGMA query_only=ON;",
        f"{user_sql_clean};",
    ]
    return "\n\n".join([p for p in parts if p])


def submit_to_judge0_sql(sql_script: str):
    """
    Submit SQL script to Judge0 and return JSON response.
    Uses settings:
      JUDGE0_API_URL (required), JUDGE0_API_KEY (optional), JUDGE0_LANGUAGE_MAPPING
    """
    base_url = getattr(settings, "JUDGE0_API_URL", None) or getattr(settings, "JUDGE0_BASE_URL", None)
    if not base_url:
        raise RuntimeError("Judge0 base URL missing (set JUDGE0_API_URL).")

    # prefer explicit mapping, fallback to 82 (SQLite)
    lang_id = (
        getattr(settings, "JUDGE0_LANGUAGE_MAPPING", {}).get("sqlite")
        or getattr(settings, "JUDGE0_LANG_IDS", {}).get("sqlite")
        or 82
    )

    url = f"{base_url.rstrip('/')}/submissions?base64_encoded=false&wait=true"
    payload = {
        "source_code": sql_script,
        "language_id": lang_id,
        "stdin": "",
        "redirect_stderr_to_stdout": False,
        "cpu_time_limit": (getattr(settings, "JUDGE0_RUN_OPTS", {}).get("time_limit_ms", 8000) / 1000.0),
        "memory_limit": getattr(settings, "JUDGE0_RUN_OPTS", {}).get("memory_limit_kb", 256000),
    }
    headers = {"Content-Type": "application/json"}
    api_key = getattr(settings, "JUDGE0_API_KEY", "") or ""
    if api_key:
        headers["X-Auth-Token"] = api_key

    # Safety: enforce a reasonable maximum script size
    max_len = getattr(settings, "JUDGE0_RUN_OPTS", {}).get("max_sql_len", 100_000)
    if len(sql_script) > max_len:
        raise RuntimeError("SQL script too large.")

    r = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
    if r.status_code >= 400:
        raise RuntimeError(f"Judge0 HTTP {r.status_code}: {r.text[:400]}")
    return r.json()


def parse_rows(stdout: str):
    """
    Parse Judge0 stdout into rows.
    Handles common separators: tab, pipe, comma, fallback whitespace split.
    Returns (columns, rows) where columns may be None for MVP.
    """
    if not stdout:
        return None, []

    lines = [ln for ln in stdout.splitlines() if ln.strip() != ""]
    rows = []
    for ln in lines:
        if "\t" in ln:
            rows.append(ln.split("\t"))
        elif "|" in ln:
            rows.append([c.strip() for c in ln.split("|")])
        elif "," in ln:
            rows.append([c.strip() for c in ln.split(",")])
        else:
            rows.append([ln.strip()])
            # rows.append(ln.split())
    return None, rows


def rowset_equal(a_rows, b_rows, strict_order=False, float_tol=0.0):
    """
    Compare two row-sets. By default compares as unordered multisets.
    float_tol: allowed absolute difference for numeric comparisons.
    """
    def normalize(val):
        try:
            v = float(val)
            return ("__float__", round(v, 6))
        except Exception:
            return ("__str__", (val or "").strip())

    if strict_order:
        if len(a_rows) != len(b_rows):
            return False
        for ra, rb in zip(a_rows, b_rows):
            if len(ra) != len(rb):
                return False
            for va, vb in zip(ra, rb):
                try:
                    fa, fb = float(va), float(vb)
                    if abs(fa - fb) > float_tol:
                        return False
                except Exception:
                    if (va or "").strip() != (vb or "").strip():
                        return False
        return True

    from collections import Counter
    def norm_row(r):
        return tuple(normalize(v) for v in r)
    return Counter([norm_row(r) for r in a_rows]) == Counter([norm_row(r) for r in b_rows])
