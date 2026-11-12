import io
import sqlite3
import zipfile
from pathlib import Path

import pytest

from app import backup
from tests.test_api import SETTINGS

IMG_A = "a" * 32 + ".png"
IMG_B = "b" * 32 + ".jpg"
FONT_A = "c" * 32 + ".ttf"


def make_data(root: Path, phrases: list[str], images: dict[str, bytes], fonts: dict[str, bytes]) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    db_file = root / "studio.db"
    connection = sqlite3.connect(db_file)
    connection.execute("CREATE TABLE IF NOT EXISTS phrases (id INTEGER PRIMARY KEY, text TEXT)")
    connection.execute("DELETE FROM phrases")
    connection.executemany("INSERT INTO phrases (text) VALUES (?)", [(text,) for text in phrases])
    connection.commit()
    connection.close()
    for folder, files in (("uploads", images), ("fonts", fonts)):
        (root / folder).mkdir(exist_ok=True)
        for name, content in files.items():
            (root / folder / name).write_bytes(content)
    return db_file


def read_phrases(db_file: Path) -> list[str]:
    connection = sqlite3.connect(db_file)
    try:
        return [row[0] for row in connection.execute("SELECT text FROM phrases ORDER BY id")]
    finally:
        connection.close()


def make_zip(path: Path, entries: dict[str, bytes]) -> Path:
    with zipfile.ZipFile(path, "w") as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
    return path


def test_roundtrip_restores_everything_and_keeps_a_safety_copy(tmp_path):
    source = tmp_path / "src"
    src_db = make_data(source, ["원본 문구"], {IMG_A: b"png-a"}, {FONT_A: b"ttf-a"})
    archive = tmp_path / "backup.zip"
    backup.create_backup(src_db, source / "uploads", source / "fonts", archive)

    # 다른 데이터가 들어 있는 곳에 복원한다
    target = tmp_path / "dst"
    dst_db = make_data(target, ["지금 문구"], {IMG_B: b"jpg-b"}, {})
    hooks = []
    safety = backup.restore_backup(
        archive, dst_db, target / "uploads", target / "fonts", target / "backups",
        before_swap=lambda: hooks.append("before"), after_swap=lambda: hooks.append("after"),
    )

    assert hooks == ["before", "after"]
    assert read_phrases(dst_db) == ["원본 문구"]
    assert (target / "uploads" / IMG_A).read_bytes() == b"png-a"
    assert not (target / "uploads" / IMG_B).exists()  # 복원하면 백업에 없던 파일은 사라진다
    assert (target / "fonts" / FONT_A).read_bytes() == b"ttf-a"

    # 바꾸기 전 데이터는 안전 백업에 남아 있어서 되돌릴 수 있다
    assert safety.parent == target / "backups"
    with zipfile.ZipFile(safety) as saved:
        assert set(saved.namelist()) == {"studio.db", f"uploads/{IMG_B}"}
    assert list(target.glob("restore-*")) == []  # 임시 폴더는 남지 않는다


def test_backup_ignores_files_with_unexpected_names(tmp_path):
    db_file = make_data(tmp_path, [], {IMG_A: b"x", "notes.txt": b"x", "../evil.png": b"x"}, {})
    (tmp_path / "uploads" / ".gitkeep").write_bytes(b"")
    archive = tmp_path / "b.zip"
    backup.create_backup(db_file, tmp_path / "uploads", tmp_path / "fonts", archive)
    with zipfile.ZipFile(archive) as saved:
        assert set(saved.namelist()) == {"studio.db", f"uploads/{IMG_A}"}


def test_backup_works_before_database_exists(tmp_path):
    archive = tmp_path / "b.zip"
    backup.create_backup(tmp_path / "none.db", tmp_path / "uploads", tmp_path / "fonts", archive)
    with zipfile.ZipFile(archive) as saved:
        assert saved.namelist() == ["studio.db"]


@pytest.mark.parametrize(
    "entries",
    [
        {"studio.db": b"x", "../evil.png": b"x"},
        {"studio.db": b"x", "uploads/../../evil.png": b"x"},
        {"studio.db": b"x", "/etc/passwd": b"x"},
        {"studio.db": b"x", "C:/Windows/x.png": b"x"},
        {"studio.db": b"x", "uploads/notes.txt": b"x"},
        {"studio.db": b"x", "other/" + IMG_A: b"x"},
        {"uploads/" + IMG_A: b"x"},  # DB 없음
    ],
)
def test_restore_rejects_foreign_or_unsafe_archives_without_touching_data(tmp_path, entries):
    target = tmp_path / "dst"
    dst_db = make_data(target, ["지금 문구"], {IMG_B: b"keep"}, {})
    archive = make_zip(tmp_path / "bad.zip", entries)

    with pytest.raises(backup.BackupError):
        backup.restore_backup(archive, dst_db, target / "uploads", target / "fonts", target / "backups")

    assert read_phrases(dst_db) == ["지금 문구"]
    assert (target / "uploads" / IMG_B).read_bytes() == b"keep"
    assert not (tmp_path / "evil.png").exists()


def test_restore_rejects_not_zip_corrupt_db_and_non_app_db(tmp_path, monkeypatch):
    target = tmp_path / "dst"
    dst_db = make_data(target, ["지금 문구"], {}, {})
    args = (dst_db, target / "uploads", target / "fonts", target / "backups")

    not_zip = tmp_path / "a.zip"
    not_zip.write_bytes(b"hello")
    with pytest.raises(backup.BackupError, match="zip"):
        backup.restore_backup(not_zip, *args)

    corrupt = make_zip(tmp_path / "b.zip", {"studio.db": b"this is not sqlite" * 50})
    with pytest.raises(backup.BackupError, match="손상"):
        backup.restore_backup(corrupt, *args)

    other = tmp_path / "other.db"
    connection = sqlite3.connect(other)
    connection.execute("CREATE TABLE unrelated (x)")
    connection.commit()
    connection.close()
    foreign = make_zip(tmp_path / "c.zip", {"studio.db": other.read_bytes()})
    with pytest.raises(backup.BackupError, match="백업 파일이 아닙니다"):
        backup.restore_backup(foreign, *args)

    monkeypatch.setattr(backup, "MAX_TOTAL_BYTES", 5)
    big = make_zip(tmp_path / "d.zip", {"studio.db": other.read_bytes()})
    with pytest.raises(backup.BackupError, match="너무 큽니다"):
        backup.restore_backup(big, *args)

    assert read_phrases(dst_db) == ["지금 문구"]


def test_api_download_and_restore(client, tmp_path):
    client.post("/api/phrases", json={"text": "백업할 문구"})
    client.post("/api/templates", json={"name": "백업 템플릿", "settings": SETTINGS})
    image = b"\x89PNG\r\n\x1a\n" + b"body"
    name = client.post("/api/images", files={"file": ("a.png", image, "image/png")}).json()["file"]

    res = client.get("/api/backup")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/zip"
    assert "insta-studio-backup-" in res.headers["content-disposition"]
    archive = res.content
    with zipfile.ZipFile(io.BytesIO(archive)) as saved:
        assert {"studio.db", f"uploads/{name}"} <= set(saved.namelist())

    # 백업 뒤에 데이터를 바꾼다
    for phrase in client.get("/api/phrases").json():
        client.delete(f"/api/phrases/{phrase['id']}")
    client.post("/api/phrases", json={"text": "나중에 쓴 문구"})
    (tmp_path / "uploads" / name).unlink()

    restored = client.post("/api/backup/restore", files={"file": ("b.zip", archive, "application/zip")})
    assert restored.status_code == 200
    assert restored.json()["safety_backup"].startswith("before-restore-")

    assert [p["text"] for p in client.get("/api/phrases").json()] == ["백업할 문구"]
    assert [t["name"] for t in client.get("/api/templates").json()] == ["백업 템플릿"]
    assert client.get(f"/api/images/{name}").content == image
    assert list((tmp_path / "backups").glob("before-restore-*.zip"))


def test_api_restore_rejects_bad_file_with_message(client):
    res = client.post("/api/backup/restore", files={"file": ("x.zip", b"nope", "application/zip")})
    assert res.status_code == 422
    assert "zip" in res.json()["detail"]
