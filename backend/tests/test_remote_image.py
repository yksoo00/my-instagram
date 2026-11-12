import httpx
import pytest

from app import remote_image

PNG = b"\x89PNG\r\n\x1a\n" + b"fake-png-body"
JPG = b"\xff\xd8\xff\xe0" + b"fake-jpg-body"
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"fake"
GIF = b"GIF89a" + b"fake"


@pytest.fixture
def web(monkeypatch):
    """가짜 인터넷. 도메인은 공개 IP 로, 이름이 private/loopback 인 도메인은 안쪽 IP 로 풀린다."""
    routes: dict[str, httpx.Response | callable] = {}

    def resolve(host: str) -> list[str]:
        if host.startswith("private"):
            return ["10.0.0.5"]
        if host.startswith("loopback"):
            return ["127.0.0.1"]
        if host.startswith("mixed"):
            return ["93.184.216.34", "192.168.0.1"]
        if host.startswith("nodns"):
            raise OSError("not found")
        return ["93.184.216.34"]

    def handler(request: httpx.Request) -> httpx.Response:
        route = routes[str(request.url)]
        return route(request) if callable(route) else route

    monkeypatch.setattr(remote_image, "resolve_host", resolve)
    monkeypatch.setattr(
        remote_image,
        "default_client",
        lambda: httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=False),
    )
    return routes


def post(client, url: str):
    return client.post("/api/images/fetch", json={"url": url})


def test_fetch_returns_bytes_with_type_detected_by_content(client, web):
    # 서버가 text/plain 이라고 거짓말해도 앞머리로 판별한다
    web["https://example.com/a.png"] = httpx.Response(200, content=PNG, headers={"content-type": "text/plain"})
    web["https://example.com/b"] = httpx.Response(200, content=JPG)
    web["https://example.com/c"] = httpx.Response(200, content=WEBP)
    web["https://example.com/d"] = httpx.Response(200, content=GIF)

    for path, body, kind in [("a.png", PNG, "image/png"), ("b", JPG, "image/jpeg"), ("c", WEBP, "image/webp"), ("d", GIF, "image/gif")]:
        res = post(client, f"https://example.com/{path}")
        assert res.status_code == 200
        assert res.content == body
        assert res.headers["content-type"] == kind


def test_rejects_non_image_with_helpful_message(client, web):
    web["https://example.com/page"] = httpx.Response(200, content=b"<html>instagram</html>")
    res = post(client, "https://example.com/page")
    assert res.status_code == 400
    assert "이미지 주소 복사" in res.json()["detail"]


def test_rejects_bad_scheme_and_credentials(client, web):
    assert post(client, "ftp://example.com/a.png").status_code == 422
    assert post(client, "file:///etc/passwd").status_code == 422
    assert post(client, "not a url").status_code == 422
    assert post(client, "https://user:pw@example.com/a.png").status_code == 422


def test_blocks_hostnames_that_resolve_to_internal_addresses(client, web):
    # 내 PC·공유기·내부망을 서버가 대신 찔러 보지 못하게 한다
    for url in [
        "http://private.example.com/a.png",
        "http://loopback.example.com/a.png",
        "http://mixed.example.com/a.png",  # 하나라도 안쪽이면 거부
    ]:
        assert post(client, url).status_code == 400, url

def test_literal_ips_use_real_resolver(client, monkeypatch):
    # 가짜 해석기 없이 진짜 해석기로: IP 주소를 직접 적은 경우
    called = []
    monkeypatch.setattr(
        remote_image, "default_client", lambda: called.append(1) or pytest.fail("접속하면 안 됨")
    )
    for url in [
        "http://127.0.0.1:8000/api/health",
        "http://[::1]/a.png",
        "http://169.254.169.254/latest/meta-data",
        "http://10.1.2.3/a.png",
        "http://192.168.0.1/a.png",
        "http://[::ffff:10.0.0.1]/a.png",
        "http://0.0.0.0/a.png",
    ]:
        assert post(client, url).status_code == 400, url
    assert called == []


def test_unresolvable_host(client, web):
    assert post(client, "https://nodns.example.com/a.png").status_code == 400


def test_redirect_is_followed_but_rechecked(client, web):
    web["https://example.com/short"] = httpx.Response(302, headers={"location": "/real.png"})
    web["https://example.com/real.png"] = httpx.Response(200, content=PNG)
    assert post(client, "https://example.com/short").content == PNG

    # 공개 주소가 내부 주소로 넘기는 경우(리다이렉트를 이용한 우회)도 막는다
    web["https://example.com/evil"] = httpx.Response(302, headers={"location": "http://private.example.com/x"})
    assert post(client, "https://example.com/evil").status_code == 400

    web["https://example.com/loop"] = httpx.Response(302, headers={"location": "https://example.com/loop"})
    assert post(client, "https://example.com/loop").status_code == 400


def test_upstream_errors_and_size_limit(client, web, monkeypatch):
    web["https://example.com/404"] = httpx.Response(404)
    assert post(client, "https://example.com/404").status_code == 400

    monkeypatch.setattr(remote_image, "MAX_BYTES", 10)
    web["https://example.com/big"] = httpx.Response(200, content=PNG, headers={"content-length": "999"})
    assert post(client, "https://example.com/big").status_code == 413

    # content-length 를 속여도 실제로 받는 양으로 끊는다
    web["https://example.com/liar"] = httpx.Response(200, content=PNG + b"x" * 100)
    assert post(client, "https://example.com/liar").status_code == 413

    def timeout(request):
        raise httpx.ReadTimeout("slow", request=request)

    web["https://example.com/slow"] = timeout
    assert post(client, "https://example.com/slow").status_code == 504
