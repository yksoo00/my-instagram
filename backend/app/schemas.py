"""요청·응답 모양. 수치 범위는 프론트 패널의 슬라이더 범위와 같게 둔다."""

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


class TemplateIn(Strict):
    name: Name
    settings: TemplateSettings


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    settings: TemplateSettings


class PhraseIn(Strict):
    text: PhraseText


class PhraseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
