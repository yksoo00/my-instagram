TTF = b"\x00\x01\x00\x00" + b"fake-ttf-body"
OTF = b"OTTO" + b"fake-otf-body"
WOFF2 = b"wOF2" + b"fake-woff2-body"


def upload(client, content=TTF, name="내 글꼴", filename="a.ttf"):
    return client.post(
        "/api/fonts", data={"name": name}, files={"file": (filename, content, "font/ttf")}
    )


def test_upload_detects_type_by_content_not_extension(client):
    assert upload(client, TTF, "a", "x.txt").json()["file"].endswith(".ttf")
    assert upload(client, OTF, "b", "x.ttf").json()["file"].endswith(".otf")
    assert upload(client, WOFF2, "c", "x.otf").json()["file"].endswith(".woff2")


def test_upload_list_download_delete(client):
    font = upload(client, name=" 눈누 기초 ").json()
    assert font["name"] == "눈누 기초"

    assert [f["name"] for f in client.get("/api/fonts").json()] == ["눈누 기초"]

    res = client.get(f"/api/fonts/files/{font['file']}")
    assert res.status_code == 200
    assert res.content == TTF
    assert res.headers["content-type"] == "font/ttf"

    assert client.delete(f"/api/fonts/{font['id']}").status_code == 204
    assert client.get("/api/fonts").json() == []
    assert client.get(f"/api/fonts/files/{font['file']}").status_code == 404  # 파일도 지워짐


def test_upload_rejects_non_font_blank_name_and_duplicate(client, monkeypatch):
    assert upload(client, b"not a font").status_code == 422
    assert upload(client, name="  ").status_code == 422

    assert upload(client, name="같은 이름").status_code == 200
    assert upload(client, name="같은 이름").status_code == 409
    assert len(client.get("/api/fonts").json()) == 1

    monkeypatch.setattr("app.main.MAX_FONT_BYTES", 8)
    assert upload(client, name="큰 글꼴").status_code == 413


def test_download_rejects_bad_names(client):
    assert client.get("/api/fonts/files/nope.ttf").status_code == 404
    assert client.get("/api/fonts/files/0123456789abcdef0123456789abcdef.ttf").status_code == 404
    assert client.get("/api/fonts/files/..%2F..%2Fstudio.db").status_code == 404
