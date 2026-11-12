from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import mount_frontend


def make_app(dist) -> FastAPI:
    app = FastAPI()

    @app.get("/api/ping")
    def ping() -> dict[str, str]:
        return {"ok": "yes"}

    mount_frontend(app, dist)
    return app


def test_serves_built_frontend_and_keeps_api_first(tmp_path):
    (tmp_path / "index.html").write_text("<h1>studio</h1>", encoding="utf-8")
    (tmp_path / "manifest.webmanifest").write_text("{}", encoding="utf-8")
    client = TestClient(make_app(tmp_path))

    assert client.get("/").text == "<h1>studio</h1>"
    assert client.get("/api/ping").json() == {"ok": "yes"}  # 정적 서빙이 API 를 가리지 않는다
    assert client.get("/manifest.webmanifest").status_code == 200
    assert client.get("/nope.js").status_code == 404


def test_no_dist_folder_means_api_only(tmp_path):
    client = TestClient(make_app(tmp_path / "missing"))
    assert client.get("/api/ping").status_code == 200
    assert client.get("/").status_code == 404
