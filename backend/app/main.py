from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import DATA_DIR, Base, engine, get_session
from app.models import Phrase, Template
from app.schemas import PhraseIn, PhraseOut, TemplateIn, TemplateOut


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
