"""이미지 주소(URL)에서 사진을 받아 오는 서버 쪽 처리.

브라우저가 남의 사이트 이미지를 직접 읽으면 보안(CORS) 때문에 캔버스에 못 쓰므로 서버가 대신 받는다.
서버가 아무 주소나 받아 오게 두면 내 PC 안쪽(로컬·공유기·내부망) 주소를 찔러 볼 수 있어서(SSRF)
접속 전에 주소를 풀어 보고 안쪽 주소면 막는다. 리다이렉트도 한 번 따라갈 때마다 다시 검사한다.
"""

import ipaddress
import socket
from collections.abc import Callable
from urllib.parse import urljoin, urlsplit

import httpx

MAX_BYTES = 20 * 1024 * 1024
MAX_REDIRECTS = 3
TIMEOUT_SECONDS = 10.0

# 웹에서 흔한 형식. 편집기는 JPG/PNG 만 저장하므로 WEBP·GIF 는 화면(브라우저)에서 PNG 로 바꿔 쓴다.
IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp", "image/gif")


class RemoteImageError(Exception):
    """사용자에게 보여 줄 수 있는 한국어 메시지를 담는다."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def detect_type(head: bytes) -> str | None:
    """Content-Type 헤더는 서버가 거짓말할 수 있으니 파일 앞머리로 판별한다."""
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return None


def resolve_host(host: str) -> list[str]:
    """호스트가 가리키는 모든 IP. 테스트에서 바꿔 끼운다."""
    return [info[4][0] for info in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)]


def _is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address.split("%")[0])
    # IPv4 로 감싼 IPv6(::ffff:10.0.0.1) 도 같은 기준으로 본다.
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def validate_url(url: str) -> str:
    """http/https 이고 공개 주소를 가리키는 URL 만 통과시킨다. 통과하면 그대로 돌려준다."""
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise RemoteImageError("http:// 또는 https:// 로 시작하는 이미지 주소를 넣으세요.", 422)
    if parts.username or parts.password:
        raise RemoteImageError("아이디·비밀번호가 들어간 주소는 쓸 수 없습니다.", 422)
    try:
        addresses = resolve_host(parts.hostname)
    except OSError as error:
        raise RemoteImageError("주소를 찾을 수 없습니다. 인터넷 연결과 주소를 확인하세요.") from error
    if not addresses or not all(_is_public(address) for address in addresses):
        raise RemoteImageError("이 컴퓨터나 내부망을 가리키는 주소는 쓸 수 없습니다.", 400)
    return parts.geturl()


ClientFactory = Callable[[], httpx.Client]


def default_client() -> httpx.Client:
    # 리다이렉트는 직접 따라가며 매번 검사하므로 httpx 의 자동 이동은 끈다.
    return httpx.Client(timeout=TIMEOUT_SECONDS, follow_redirects=False)


def fetch_image(url: str, client_factory: ClientFactory = default_client) -> tuple[bytes, str]:
    """이미지 바이트와 형식(MIME)을 돌려준다. 실패하면 RemoteImageError."""
    current = validate_url(url)
    with client_factory() as client:
        for _ in range(MAX_REDIRECTS + 1):
            try:
                with client.stream(
                    "GET", current, headers={"Accept": ",".join(IMAGE_TYPES) + ",*/*;q=0.1"}
                ) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise RemoteImageError("주소가 잘못 옮겨져 있어 받을 수 없습니다.")
                        current = validate_url(urljoin(current, location))
                        continue
                    if response.status_code != 200:
                        raise RemoteImageError(
                            f"이미지를 받지 못했습니다 (상대 서버 응답 {response.status_code})."
                        )
                    declared = int(response.headers.get("content-length") or 0)
                    if declared > MAX_BYTES:
                        raise RemoteImageError("20MB 이하의 이미지만 가져올 수 있습니다.", 413)
                    content = bytearray()
                    for chunk in response.iter_bytes():
                        content.extend(chunk)
                        if len(content) > MAX_BYTES:
                            raise RemoteImageError("20MB 이하의 이미지만 가져올 수 있습니다.", 413)
            except httpx.TimeoutException as error:
                raise RemoteImageError("상대 서버가 너무 늦게 응답합니다.", 504) from error
            except httpx.HTTPError as error:
                raise RemoteImageError("이미지를 받는 중 연결이 끊겼습니다.", 502) from error

            kind = detect_type(bytes(content[:12]))
            if kind is None:
                raise RemoteImageError(
                    "이미지 파일이 아닙니다. 인스타·유튜브 같은 페이지 주소가 아니라 "
                    "이미지를 오른쪽 클릭해 '이미지 주소 복사'로 얻은 주소를 넣으세요."
                )
            return bytes(content), kind
    raise RemoteImageError("주소가 너무 여러 번 옮겨져 있어 받을 수 없습니다.")
