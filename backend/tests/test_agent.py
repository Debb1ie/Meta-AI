from app.ai.agent import verify


def _briefing(*claims):
    return {"situation": [{"text": t, "evidence": e} for t, e in claims], "watchlist": []}


def test_verify_accepts_rounded_numbers_counts_and_dates():
    evidence = {"E1": {"result": {"basins": [{"peak_m3s": 850.1, "pct_of_watch": 35, "date": "2026-11-04"}] * 17}}}
    v = verify(_briefing(("All 17 basins normal; Mindanao peaks near 850 m³/s on Nov 4 (35% of Watch).", ["E1"])), evidence)
    assert v["numbers_checked"] == 3
    assert v["score"] == 1.0


def test_verify_flags_invented_numbers_and_unknown_evidence():
    evidence = {"E1": {"result": {"flow_today_m3s": 463.5}}}
    v = verify(_briefing(("Flow is 464 m³/s today.", ["E1"]), ("Flow will reach 2,000 m³/s.", ["E1", "E9"])), evidence)
    assert v["numbers_verified"] == 1
    assert [u["number"] for u in v["unverified"]] == [2000.0]
    assert v["unknown_evidence_ids"] == ["E9"]


def test_verify_ignores_negative_signs_and_iso_timestamps():
    evidence = {"E1": {"result": {"rise_m_per_h": -0.11, "at": "2026-11-03T06:00:00Z"}}}
    v = verify(_briefing(("Falling 0.11 m/h as of 2026-11-03T06:00:00Z.", ["E1"])), evidence)
    assert v["score"] == 1.0
