"""요청·응답 모양. 수치 범위는 프론트 패널의 슬라이더 범위와 같게 둔다."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Color = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
PhraseText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Gradient(Strict):
    height: float = Field(ge=0, le=1)
    opacity: float = Field(ge=0, le=1)


class TitleStyle(Strict):
    fontFamily: str = Field(min_length=1, max_length=50)
    fontSize: int = Field(ge=30, le=200)
    bold: bool
    color: Color
    accentColor: Color
    align: Literal["left", "center", "right"]
    y: float = Field(ge=-2000, le=4000)
    lineHeight: float = Field(ge=0.8, le=2)
    letterSpacing: int = Field(ge=-10, le=30)
    strokeWidth: int = Field(ge=0, le=24)
    strokeColor: Color
    shadow: bool


class Footer(Strict):
    text: str = Field(max_length=100)
    fontSize: int = Field(ge=16, le=80)


class TemplateSettings(Strict):
    ratio: Literal["4:5", "1:1", "9:16"]
    gradient: Gradient
    title: TitleStyle
    # 푸터가 생기기 전에 저장한 템플릿도 읽을 수 있게 기본값을 둔다.
    footer: Footer = Footer(text="", fontSize=32)


class SlideImage(Strict):
    # 업로드 API 가 만든 이름만 받는다. 이 모양이라 경로 조작 문자가 들어올 수 없다.
    file: str = Field(pattern=r"^[0-9a-f]{32}\.(png|jpg)$")
    x: float = Field(ge=-100000, le=100000)
    y: float = Field(ge=-100000, le=100000)
    scale: float = Field(gt=0, le=100)


class Adjust(Strict):
    brightness: float = Field(ge=-1, le=1)
    contrast: float = Field(ge=-100, le=100)


class Slide(Strict):
    image: SlideImage | None
    adjust: Adjust
    text: str = Field(max_length=500)


MAX_SLIDES = 30


class ProjectData(Strict):
    ratio: Literal["4:5", "1:1", "9:16"]
    gradient: Gradient
    title: TitleStyle
    footer: Footer
    numbering: bool
    slides: list[Slide] = Field(min_length=1, max_length=MAX_SLIDES)


class ProjectIn(Strict):
    name: Name
    data: ProjectData


class ProjectOut(ProjectIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    updated_at: datetime


class TemplateIn(Strict):
    name: Name
    settings: TemplateSettings


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    settings: TemplateSettings


class ImageOut(BaseModel):
    file: str


class FontOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    file: str


class PhraseIn(Strict):
    text: PhraseText


class PhraseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
