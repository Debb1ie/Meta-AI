"""Muse Image posters: style choice is honoured and repeated requests vary."""

import pytest
from fastapi.testclient import TestClient

from app.ai import meta_client
from app.api import ai as ai_api
from app.main import app


@pytest.fixture()
def client(monkeypatch):
    prompts: list[str] = []

    def fake_generate(prompt: str, size: str = "1024x1024"):
        prompts.append(prompt)
        return {"b64": "iVBORw0KGgo=", "url": None}, {"model": "muse-image-1.0", "revised_prompt": None}

    monkeypatch.setattr(meta_client, "generate_image", fake_generate)
    with TestClient(app) as c:
        c.prompts = prompts
        yield c


def test_poster_honours_the_chosen_style(client):
    r = client.post("/api/ai/alert-poster", json={"headline": "Rivers are calm", "level": "normal", "style": "komiks"})
    assert r.status_code == 200
    assert r.json()["style"] == "komiks"
    assert ai_api.POSTER_STYLES["komiks"] in client.prompts[-1]
    assert "No words" in client.prompts[-1]


def test_repeated_posters_get_different_prompts(client):
    for _ in range(8):
        client.post("/api/ai/alert-poster", json={"headline": "Rivers are calm", "level": "warning"})
    assert len(set(client.prompts)) > 1
    styles = {client.post("/api/ai/preparedness-graphic", json={"topic": "go-bag"}).json()["style"] for _ in range(12)}
    assert styles <= set(ai_api.POSTER_STYLES) and len(styles) > 1


def test_unknown_style_is_rejected(client):
    assert client.post("/api/ai/alert-poster", json={"headline": "x" * 5, "style": "neon<script>"}).status_code == 422
    assert client.post("/api/ai/preparedness-graphic", json={"topic": "go-bag", "style": "nope"}).status_code == 422
