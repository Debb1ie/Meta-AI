"""Pre-fetch OpenStreetMap rivers and main roads for the preset spatial-mapping areas.

The public Overpass API is often overloaded, so the page ships these as static files and only
calls Overpass live for a spot the user picks. Run from frontend/ with Python 3.10+:  python3 scripts/build_spatial_osm.py [area ids]
Output: public/data/spatial/<id>.json with the marked cells delta-encoded, on the same grid the
page uses (see src/app/spatial/areas.ts and makeGrid in analysis.ts). Standard library only.
"""

import json, math, re, sys, time, urllib.parse, urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AREAS_TS = (ROOT / "src/app/spatial/areas.ts").read_text()
HALF = float(re.search(r"WINDOW_HALF_DEG = ([\d.]+)", AREAS_TS).group(1))
N = int(re.search(r"GRID_N = (\d+)", AREAS_TS).group(1))
AREAS = [dict(id=m[0], lat=float(m[1]), lon=float(m[2])) for m in re.findall(r'id: "([\w-]+)".*?lat: ([\d.]+), lon: ([\d.]+)', AREAS_TS)]
MIRRORS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.private.coffee/api/interpreter"]
OUT = ROOT / "public/data/spatial"
ROADS = ["motorway", "trunk", "primary", "secondary", "tertiary"]


def overpass(query: str) -> dict:
    for attempt in range(6):
        for url in MIRRORS:
            try:
                req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": query}).encode(), headers={"User-Agent": "HydroSentinel/1.0 (flood mapping)"})
                return json.loads(urllib.request.urlopen(req, timeout=120).read())
            except Exception as e:  # noqa: BLE001 - try the next mirror
                print(f"   {url.split('/')[2]}: {e}", file=sys.stderr)
        time.sleep(10 * (attempt + 1))
    raise RuntimeError("all Overpass mirrors failed")


def rasterise(elements, west, north, step):
    cells = set()
    for el in elements:
        g = el.get("geometry") or []
        for a, b in zip(g, g[1:]):
            steps = max(1, math.ceil(max(abs(b["lat"] - a["lat"]), abs(b["lon"] - a["lon"])) / step * 2.5))
            for s in range(steps + 1):
                lat = a["lat"] + (b["lat"] - a["lat"]) * s / steps
                lon = a["lon"] + (b["lon"] - a["lon"]) * s / steps
                i, j = math.floor((lon - west) / step), math.floor((north - lat) / step)
                if 0 <= i < N and 0 <= j < N:
                    cells.add(j * N + i)
    cells = sorted(cells)
    return ",".join(str(c - p) for c, p in zip(cells, [0] + cells[:-1]))


def main(only: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for a in AREAS:
        if only and a["id"] not in only:
            continue
        step = 2 * HALF / N
        west, east, south, north = a["lon"] - HALF, a["lon"] + HALF, a["lat"] - HALF, a["lat"] + HALF
        box = f"{south},{west},{north},{east}"
        print(a["id"], flush=True)
        rivers = overpass(f'[out:json][timeout:90];(way["waterway"="river"]({box});way["waterway"="canal"]({box}););out tags geom;')["elements"]
        roads = overpass("[out:json][timeout:90];(" + "".join(f'way["highway"="{h}"]({box});' for h in ROADS) + ");out skel geom;")["elements"]
        names: dict[str, int] = {}
        for el in rivers:
            t = el.get("tags", {})
            if t.get("waterway") == "river" and t.get("name"):
                names[t["name"]] = names.get(t["name"], 0) + len(el.get("geometry") or [])
        doc = {
            "id": a["id"], "lat": a["lat"], "lon": a["lon"], "half": HALF, "n": N,
            "fetched": date.today().isoformat(), "source": "OpenStreetMap contributors (ODbL), via Overpass API",
            "river_names": [k for k, _ in sorted(names.items(), key=lambda kv: -kv[1])][:5],
            "rivers": rasterise(rivers, west, north, step), "roads": rasterise(roads, west, north, step),
        }
        (OUT / f"{a['id']}.json").write_text(json.dumps(doc, separators=(",", ":")))
        print(f"   {len(rivers)} river ways, {len(roads)} road ways, {(OUT / (a['id'] + '.json')).stat().st_size // 1024} KB", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
