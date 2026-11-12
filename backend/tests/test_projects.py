import copy

from tests.test_api import SETTINGS

PNG = b"\x89PNG\r\n\x1a\n" + b"fake-png-body"
JPG = b"\xff\xd8\xff\xe0" + b"fake-jpg-body"

IMAGE_NAME = "0123456789abcdef0123456789abcdef.png"

PROJECT_DATA = {
    "ratio": "4:5",
    "gradient": SETTINGS["gradient"],
    "title": SETTINGS["title"],
    "footer": {"text": "@me", "fontSize": 32},
    "numbering": True,
    "slides": [
        {
            "image": {
                "file": IMAGE_NAME,
                "x": -10.5,
                "y": 0,
                "scale": 1.2,
                "crop": {"x": 10, "y": 20, "width": 500, "height": 400},
            },
            "adjust": {"brightness": 0.1, "contrast": -5},
            "text": "첫 장",
        },
        {"image": None, "adjust": {"brightness": 0, "contrast": 0}, "text": "둘째 장"},
    ],
}


def test_upload_detects_type_by_content(client):
    png = client.post("/api/images", files={"file": ("a.txt", PNG, "text/plain")})
    assert png.status_code == 200
    assert png.json()["file"].endswith(".png")

    jpg = client.post("/api/images", files={"file": ("a.png", JPG, "image/png")})
    assert jpg.json()["file"].endswith(".jpg")


def test_upload_then_download_same_bytes(client):
    name = client.post("/api/images", files={"file": ("a.png", PNG, "image/png")}).json()["file"]
    res = client.get(f"/api/images/{name}")
    assert res.status_code == 200
    assert res.content == PNG
    assert res.headers["content-type"] == "image/png"


def test_upload_rejects_non_image_and_too_large(client, monkeypatch):
    bad = client.post("/api/images", files={"file": ("a.png", b"not an image", "image/png")})
    assert bad.status_code == 422

    monkeypatch.setattr("app.main.MAX_UPLOAD_BYTES", 10)
    big = client.post("/api/images", files={"file": ("a.png", PNG, "image/png")})
    assert big.status_code == 413


def test_download_rejects_bad_names(client):
    assert client.get("/api/images/nope.png").status_code == 404
    assert client.get(f"/api/images/{IMAGE_NAME}").status_code == 404  # 모양은 맞지만 없는 파일
    assert client.get("/api/images/..%2F..%2Fstudio.db").status_code == 404


def test_project_save_load_overwrite_delete(client):
    saved = client.post("/api/projects", json={"name": " 카드뉴스 ", "data": PROJECT_DATA})
    assert saved.status_code == 200
    project_id = saved.json()["id"]
    assert saved.json()["name"] == "카드뉴스"

    loaded = client.get(f"/api/projects/{project_id}").json()
    assert loaded["data"] == PROJECT_DATA

    changed = copy.deepcopy(PROJECT_DATA)
    changed["slides"][1]["text"] = "고침"
    again = client.post("/api/projects", json={"name": "카드뉴스", "data": changed})
    assert again.json()["id"] == project_id
    assert client.get(f"/api/projects/{project_id}").json()["data"]["slides"][1]["text"] == "고침"

    listed = client.get("/api/projects").json()
    assert [p["name"] for p in listed] == ["카드뉴스"]
    assert "data" not in listed[0]

    assert client.delete(f"/api/projects/{project_id}").status_code == 204
    assert client.get(f"/api/projects/{project_id}").status_code == 404


def test_project_rejects_invalid_input(client):
    def post(mutate):
        data = copy.deepcopy(PROJECT_DATA)
        mutate(data)
        return client.post("/api/projects", json={"name": "a", "data": data}).status_code

    assert post(lambda d: d.update(slides=[])) == 422
    assert post(lambda d: d.update(slides=d["slides"][:1] * 31)) == 422
    assert post(lambda d: d["slides"][0]["image"].update(file="../../etc/passwd")) == 422
    assert post(lambda d: d["slides"][0]["image"].update(scale=0)) == 422
    assert post(lambda d: d["slides"][0].update(text="가" * 501)) == 422


def test_project_crop_is_optional_and_validated(client):
    # 자르기가 생기기 전에 저장한 프로젝트는 crop 이 없어도 읽히고 None 으로 채워진다
    old = copy.deepcopy(PROJECT_DATA)
    del old["slides"][0]["image"]["crop"]
    saved = client.post("/api/projects", json={"name": "옛것", "data": old}).json()
    loaded = client.get(f"/api/projects/{saved['id']}").json()["data"]
    assert loaded["slides"][0]["image"]["crop"] is None

    def post(crop):
        data = copy.deepcopy(PROJECT_DATA)
        data["slides"][0]["image"]["crop"] = crop
        return client.post("/api/projects", json={"name": "x", "data": data}).status_code

    assert post({"x": 0, "y": 0, "width": 0, "height": 10}) == 422
    assert post({"x": -1, "y": 0, "width": 10, "height": 10}) == 422
    assert post({"x": 0, "y": 0, "width": 10, "height": 10, "extra": 1}) == 422