"""Write SYNTHETIC example CSVs to data/samples/ for trying the import workflow.

These are not observations. When importing them, tick "This dataset is simulated".
The 'messy' file deliberately contains malformed rows so validation can be seen.
"""

from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).resolve().parent.parent / "data" / "samples"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(7)
    end = datetime(2026, 10, 30, 0, tzinfo=timezone.utc)
    idx = pd.date_range(end=end, periods=24 * 45, freq="h").tz_convert("Asia/Manila")
    rain = np.zeros(len(idx))
    for start in rng.choice(len(idx) - 30, 9, replace=False):
        dur = int(rng.integers(5, 20))
        rain[start : start + dur] += rng.gamma(2, 3) * np.sin(np.linspace(0, np.pi, dur))
    kernel = np.exp(-np.arange(72) / 9.0) * (np.arange(72) / 5.0)
    kernel /= kernel.sum()
    level = 1.8 + 0.09 * np.convolve(rain, kernel)[: len(idx)] * 6 + rng.normal(0, 0.01, len(idx))
    clean = pd.DataFrame(
        {
            "timestamp": idx.strftime("%Y-%m-%d %H:%M"),
            "station_id": "synthetic-csv-01",
            "water_level_m": level.round(3),
            "rainfall_mm": rain.round(2),
        }
    )
    clean.to_csv(OUT / "synthetic_station_clean.csv", index=False)

    messy = clean.copy().astype(object)
    messy.loc[10, "timestamp"] = "not-a-date"
    messy.loc[20, "water_level_m"] = "n/a"
    messy.loc[30, "water_level_m"] = 999.0  # out of bounds
    messy.loc[40, "rainfall_mm"] = -4  # negative rainfall
    messy.loc[50, ["water_level_m", "rainfall_mm"]] = [None, None]
    messy.loc[60, "station_id"] = None
    messy.loc[70, "water_level_m"] = float(messy.loc[70, "water_level_m"]) + 3.5  # spike, removed at resampling
    messy = pd.concat([messy, messy.iloc[[100, 101]]])  # duplicates
    messy.to_csv(OUT / "synthetic_station_messy.csv", index=False)
    print(f"Wrote {len(clean)} clean and {len(messy)} messy rows to {OUT}")


if __name__ == "__main__":
    main()
