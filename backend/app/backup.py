"""데이터(data/) 백업과 복원.

백업 파일은 zip 하나다. 안에는 딱 세 종류만 들어간다.
  studio.db            템플릿·프로젝트·문구·글꼴 목록 (SQLite)
  uploads/<이름>       프로젝트에 올린 사진
  fonts/<이름>         내가 추가한 글꼴 파일
복원은 사용자가 올린 zip 을 믿지 않는다. 이름이 이 모양이 아니면(경로 조작 포함) 통째로 거부한다.
"""

import os
import re
import shutil
import sqlite3
import tempfile
import threading
import zipfile
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

DB_NAME = "studio.db"
IMAGE_NAME = re.compile(r"^[0-9a-f]{32}\.(png|jpg)$")
FONT_NAME = re.compile(r"^[0-9a-f]{32}\.(ttf|otf|woff|woff2)$")

# 압축을 풀었을 때의 총 크기 상한. 사진이 많이 쌓여도 넉넉하되 zip 폭탄은 막는다.
MAX_TOTAL_BYTES = 4 * 1024 * 1024 * 1024

# 복원 도중 다른 백업·복원이 끼어들지 못하게 한다. (일반 요청까지 막지는 않는다. 혼자 쓰는 도구라서.)
lock = threading.Lock()


class BackupError(Exception):
    """사용자에게 그대로 보여 줄 수 있는 한국어 메시지를 담는다."""


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def _valid_files(directory: Path, pattern: re.Pattern[str]) -> list[Path]:
    if not directory.is_dir():
        return []
    return sorted(path for path in directory.iterdir() if path.is_file() and pattern.fullmatch(path.name))


def create_backup(db_file: Path, upload_dir: Path, font_dir: Path, dest: Path) -> None:
    """지금 데이터를 dest(zip)로 묶는다. DB 는 쓰는 중이어도 일관된 상태로 복사한다."""
    with tempfile.TemporaryDirectory() as tmp:
        snapshot = Path(tmp) / DB_NAME
        if db_file.is_file():
            # 파일을 그냥 복사하면 쓰는 도중의 깨진 상태가 담길 수 있어서 SQLite 의 백업 기능을 쓴다.
            source = sqlite3.connect(db_file)
            target = sqlite3.connect(snapshot)
            try:
                source.backup(target)
            finally:
                target.close()
                source.close()
        else:
            sqlite3.connect(snapshot).close()  # 아직 DB 가 없으면 빈 DB 를 담는다
        with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.write(snapshot, DB_NAME)
            for path in _valid_files(upload_dir, IMAGE_NAME):
                archive.write(path, f"uploads/{path.name}")
            for path in _valid_files(font_dir, FONT_NAME):
                archive.write(path, f"fonts/{path.name}")


def _classify(name: str) -> str | None:
    if name == DB_NAME:
        return "db"
    if name.startswith("uploads/") and IMAGE_NAME.fullmatch(name[len("uploads/") :]):
        return "uploads"
    if name.startswith("fonts/") and FONT_NAME.fullmatch(name[len("fonts/") :]):
        return "fonts"
    return None


def _check_database(path: Path) -> None:
    try:
        connection = sqlite3.connect(path)
        try:
            ok = connection.execute("PRAGMA integrity_check").fetchone()
            tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        finally:
            connection.close()
    except sqlite3.DatabaseError as error:
        raise BackupError("백업 파일 안의 데이터베이스가 손상되었습니다.") from error
    if not ok or ok[0] != "ok":
        raise BackupError("백업 파일 안의 데이터베이스가 손상되었습니다.")
    if not tables & {"templates", "projects", "phrases", "fonts"}:
        raise BackupError("이 프로그램의 백업 파일이 아닙니다.")


def restore_backup(
    zip_path: Path,
    db_file: Path,
    upload_dir: Path,
    font_dir: Path,
    safety_dir: Path,
    before_swap: Callable[[], None] = lambda: None,
    after_swap: Callable[[], None] = lambda: None,
) -> Path:
    """zip 의 내용으로 데이터를 바꾼다. 바꾸기 전 데이터는 safety_dir 에 zip 으로 남기고 그 경로를 돌려준다.

    before_swap: DB 파일을 바꾸기 직전에 부른다(열린 DB 연결을 닫는 용도).
    after_swap: 바꾼 직후에 부른다(빠진 테이블 만들기 등).
    """
    try:
        archive = zipfile.ZipFile(zip_path)
    except zipfile.BadZipFile as error:
        raise BackupError("백업(zip) 파일이 아닙니다.") from error

    with archive:
        infos = [info for info in archive.infolist() if not info.is_dir()]
        kinds = {info.filename: _classify(info.filename) for info in infos}
        bad = [name for name, kind in kinds.items() if kind is None]
        if bad:
            raise BackupError("이 프로그램의 백업 파일이 아닙니다. (알 수 없는 파일이 들어 있습니다.)")
        if DB_NAME not in kinds:
            raise BackupError("이 프로그램의 백업 파일이 아닙니다. (데이터베이스가 없습니다.)")
        if sum(info.file_size for info in infos) > MAX_TOTAL_BYTES:
            raise BackupError("백업 파일이 너무 큽니다.")

        # 같은 드라이브 안에서 풀어야 마지막에 이름 바꾸기(replace)가 빠르고 중간에 끊겨도 안전하다.
        safety_dir.parent.mkdir(parents=True, exist_ok=True)
        staging = Path(tempfile.mkdtemp(prefix="restore-", dir=safety_dir.parent))
        try:
            (staging / "uploads").mkdir()
            (staging / "fonts").mkdir()
            for info in infos:
                kind = kinds[info.filename]
                target = staging / (DB_NAME if kind == "db" else info.filename)
                with archive.open(info) as source, open(target, "wb") as out:
                    shutil.copyfileobj(source, out)
            _check_database(staging / DB_NAME)

            safety_dir.mkdir(parents=True, exist_ok=True)
            safety = safety_dir / f"before-restore-{timestamp()}.zip"
            create_backup(db_file, upload_dir, font_dir, safety)

            before_swap()
            for directory, name in ((upload_dir, "uploads"), (font_dir, "fonts")):
                if directory.exists():
                    shutil.rmtree(directory)
                directory.parent.mkdir(parents=True, exist_ok=True)
                os.replace(staging / name, directory)
            # 이름이 바뀌어도 SQLite 의 보조 파일이 남아 있으면 옛 내용이 섞이므로 같이 지운다.
            for suffix in ("-wal", "-shm", "-journal"):
                Path(f"{db_file}{suffix}").unlink(missing_ok=True)
            os.replace(staging / DB_NAME, db_file)
            after_swap()
            return safety
        finally:
            shutil.rmtree(staging, ignore_errors=True)
