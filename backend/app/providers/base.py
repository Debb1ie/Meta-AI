"""Provider abstraction for river-level sources.

A provider yields station metadata and long-format observations
(observed_at UTC, station_id, water_level_m, rainfall_mm). The importer in
services.py persists them with a Dataset provenance record, so adding a real
agency feed means implementing this protocol, not touching the pipeline.
"""

from dataclasses import dataclass
from typing import Protocol

import pandas as pd


@dataclass
class StationMetadata:
    id: str
    name: str
    latitude: float
    longitude: float
    river: str = ""
    timezone: str = "UTC"


class RiverLevelProvider(Protocol):
    name: str
    is_simulated: bool

    def stations(self) -> list[StationMetadata]: ...

    def observations(self) -> pd.DataFrame: ...
