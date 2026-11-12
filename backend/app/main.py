import re
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import db
from app.db import DATA_DIR, Base, engine, get_session
from app.models import Phrase, Project, Template
from app.schemas import (
    ImageOut,
    PhraseIn,
    PhraseOut,
    ProjectIn,
    ProjectOut,
    ProjectSummary,
    TemplateIn,
    TemplateOut,
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # 개인용 도구라 마이그레이션 도구 없이 시작할 때 없는 테이블만 만든다.
    DATA_DIR.mkdir(exist_ok=True)
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="MY INSTAGRAM STUDIO", lifespan=lifespan)

# 개발 중 프론트(Vite 5173) 에서 호출하기 위한 CORS. 로컬 전용.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SessionDep = Annotated[Session, Depends(get_session)]


FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


def mount_frontend(target: FastAPI, dist: Path) -> None:
    """빌드된 화면이 있으면 같은 서버(8000)에서 내준다. 형이 쓸 때 프로세스를 하나로 줄이려고."""
    if dist.is_dir():
        # 맨 마지막에 붙여야 /api 경로가 먼저 잡힌다.
        target.mount("/", StaticFiles(directory=dist, html=True), name="frontend")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/templates", response_model=list[TemplateOut])
def list_templates(session: SessionDep) -> list[Template]:
    return list(session.scalars(select(Template).order_by(Template.name)))


@app.post("/api/templates", response_model=TemplateOut)
def save_template(body: TemplateIn, session: SessionDep) -> Template:
    # 같은 이름으로 다시 저장하면 덮어쓴다. 이름이 곧 템플릿을 고르는 기준이라서.
    template = session.scalar(select(Template).where(Template.name == body.name))
    settings = body.settings.model_dump()
    if template is None:
        template = Template(name=body.name, settings=settings)
        session.add(template)
    else:
        template.settings = settings
    session.commit()
    return template


@app.delete("/api/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: int, session: SessionDep) -> Response:
    template = session.get(Template, template_id)
    if template is not None:
        session.delete(template)
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


MAX_UPLOAD_BYTES = 20 * 1024 * 1024
IMAGE_NAME = re.compile(r"^[0-9a-f]{32}\.(png|jpg)$")


def detect_extension(head: bytes) -> str | None:
    """확장자·Content-Type 은 믿지 않고 파일 앞머리로 판별한다."""
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    return None


@app.post("/api/images", response_model=ImageOut)
async def upload_image(file: UploadFile) -> ImageOut:
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "20MB 이하만 올릴 수 있습니다.")
    extension = detect_extension(content[:8])
    if extension is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "JPG 또는 PNG 만 올릴 수 있습니다.")
    name = f"{uuid.uuid4().hex}.{extension}"
    upload_dir = db.UPLOAD_DIR
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / name).write_bytes(content)
    return ImageOut(file=name)


@app.get("/api/images/{name}")
def get_image(name: str) -> FileResponse:
    # 이름 모양을 먼저 검사해서 경로 조작(../)이 파일 시스템에 닿지 않게 한다.
    path = db.UPLOAD_DIR / name
    if not IMAGE_NAME.fullmatch(name) or not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return FileResponse(path, media_type="image/png" if name.endswith(".png") else "image/jpeg")


@app.get("/api/projects", response_model=list[ProjectSummary])
def list_projects(session: SessionDep) -> list[Project]:
    return list(session.scalars(select(Project).order_by(Project.updated_at.desc())))


@app.get("/api/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, session: SessionDep) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return project


@app.post("/api/projects", response_model=ProjectSummary)
def save_project(body: ProjectIn, session: SessionDep) -> Project:
    # 템플릿과 같이 이름이 기준이라 같은 이름으로 저장하면 덮어쓴다.
    project = session.scalar(select(Project).where(Project.name == body.name))
    data = body.data.model_dump()
    if project is None:
        project = Project(name=body.name, data=data)
        session.add(project)
    else:
        project.data = data
    session.commit()
    session.refresh(project)
    return project


@app.delete("/api/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, session: SessionDep) -> Response:
    project = session.get(Project, project_id)
    if project is not None:
        session.delete(project)
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/phrases", response_model=list[PhraseOut])
def list_phrases(session: SessionDep) -> list[Phrase]:
    return list(session.scalars(select(Phrase).order_by(Phrase.id.desc())))


@app.post("/api/phrases", response_model=PhraseOut)
def save_phrase(body: PhraseIn, session: SessionDep) -> Phrase:
    phrase = session.scalar(select(Phrase).where(Phrase.text == body.text))
    if phrase is None:
        phrase = Phrase(text=body.text)
        session.add(phrase)
        session.commit()
    return phrase


@app.delete("/api/phrases/{phrase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_phrase(phrase_id: int, session: SessionDep) -> Response:
    phrase = session.get(Phrase, phrase_id)
    if phrase is not None:
        session.delete(phrase)
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# 모든 API 경로 등록이 끝난 뒤에 붙인다.
mount_frontend(app, FRONTEND_DIST)
