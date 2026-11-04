"""Refresh the bundled PH outlook files in app/providers/data/.

- ph_climatology.json: each river's alert thresholds (95/99/99.8th percentiles and
  median of the last five years of GloFAS daily discharge). The server uses this
  instead of downloading five years of history on every restart.
- ph_outlook_snapshot.json: one complete outlook, served (marked stale) only if
  Open-Meteo is unreachable and the server has no newer copy.

Run from backend/:  uv run python scripts/build_ph_outlook_data.py
"""

import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.providers import glofas  # noqa: E402


def main() -> None:
    glofas.DATA_DIR.mkdir(parents=True, exist_ok=True)
    thresholds = glofas._climatology_live()
    glofas.CLIMATOLOGY_FILE.write_text(json.dumps({
        "computed_on": date.today().isoformat(),
        "years": glofas.CLIMATOLOGY_YEARS,
        "percentiles": glofas.PERCENTILES,
        "source": glofas.SOURCE,
        "rivers": {r.id: t for r, t in zip(glofas.RIVERS, thresholds)},
    }, indent=1))
    print(f"wrote {glofas.CLIMATOLOGY_FILE.name}: {len(thresholds)} rivers")

    glofas._cache.clear()
    snapshot = glofas.outlook()
    if snapshot.get("stale"):
        raise SystemExit("live outlook failed; snapshot not written")
    glofas.SNAPSHOT_FILE.write_text(json.dumps(snapshot, separators=(",", ":")))
    print(f"wrote {glofas.SNAPSHOT_FILE.name}: {len(snapshot['rivers'])} rivers, fetched {snapshot['fetched_at']}")


if __name__ == "__main__":
    main()
