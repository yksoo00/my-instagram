import copy

SETTINGS = {
    "ratio": "4:5",
    "gradient": {"height": 0.5, "opacity": 0.9},
    "title": {
        "fontFamily": "Pretendard",
        "fontSize": 84,
        "bold": True,
        "color": "#ffffff",
        "accentColor": "#ffd400",
        "align": "center",
        "y": 1030,
        "lineHeight": 1.25,
        "letterSpacing": 0,
        "strokeWidth": 0,
        "strokeColor": "#000000",
        "shadow": True,
    },
}


def test_template_save_list_delete(client):
    saved = client.post("/api/templates", json={"name": " 기본 ", "settings": SETTINGS})
    assert saved.status_code == 200
    assert saved.json()["name"] == "기본"
    assert saved.json()["settings"] == {**SETTINGS, "footer": {"text": "", "fontSize": 32}}

    assert [t["name"] for t in client.get("/api/templates").json()] == ["기본"]

    assert client.delete(f"/api/templates/{saved.json()['id']}").status_code == 204
    assert client.get("/api/templates").json() == []


def test_template_footer_defaults_for_old_templates(client):
    saved = client.post("/api/templates", json={"name": "옛것", "settings": SETTINGS})
    assert saved.json()["settings"]["footer"] == {"text": "", "fontSize": 32}

    with_footer = {**SETTINGS, "footer": {"text": "@me", "fontSize": 40}}
    saved = client.post("/api/templates", json={"name": "옛것", "settings": with_footer})
    assert saved.json()["settings"]["footer"] == {"text": "@me", "fontSize": 40}


def test_template_same_name_overwrites(client):
    first = client.post("/api/templates", json={"name": "기본", "settings": SETTINGS})
    changed = copy.deepcopy(SETTINGS)
    changed["ratio"] = "1:1"
    second = client.post("/api/templates", json={"name": "기본", "settings": changed})

    assert second.json()["id"] == first.json()["id"]
    templates = client.get("/api/templates").json()
    assert len(templates) == 1
    assert templates[0]["settings"]["ratio"] == "1:1"


def test_template_rejects_invalid_input(client):
    blank_name = client.post("/api/templates", json={"name": "  ", "settings": SETTINGS})
    assert blank_name.status_code == 422

    bad = copy.deepcopy(SETTINGS)
    bad["title"]["color"] = "red"
    assert client.post("/api/templates", json={"name": "a", "settings": bad}).status_code == 422

    bad = copy.deepcopy(SETTINGS)
    bad["title"]["fontSize"] = 999
    assert client.post("/api/templates", json={"name": "a", "settings": bad}).status_code == 422

    bad = copy.deepcopy(SETTINGS)
    bad["extra"] = 1
    assert client.post("/api/templates", json={"name": "a", "settings": bad}).status_code == 422


def test_phrase_save_is_idempotent_and_delete(client):
    first = client.post("/api/phrases", json={"text": "오늘의 문구"})
    second = client.post("/api/phrases", json={"text": "오늘의 문구"})
    assert first.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert len(client.get("/api/phrases").json()) == 1

    assert client.delete(f"/api/phrases/{first.json()['id']}").status_code == 204
    assert client.get("/api/phrases").json() == []


def test_phrase_rejects_blank_and_too_long(client):
    assert client.post("/api/phrases", json={"text": " "}).status_code == 422
    assert client.post("/api/phrases", json={"text": "가" * 101}).status_code == 422
