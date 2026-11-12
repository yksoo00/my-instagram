# MY INSTAGRAM STUDIO

인스타그램 카드뉴스용 개인 사진 편집기. AI API 없이 동작한다. 기획: [docs/plan.md](docs/plan.md)

## 구성

- `frontend/` Vite + React + TypeScript + react-konva + Zustand
- `backend/` FastAPI + SQLAlchemy + SQLite (얇은 저장 API)
- `data/` SQLite 파일(`studio.db`)과 업로드 이미지 (git 제외)

## 실행

```
# 백엔드 (backend/)
py -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --reload   # :8000
.venv\Scripts\python -m pytest

# 프론트 (frontend/)
pnpm install
pnpm dev                                                # :5173
pnpm test                                               # Vitest
```

편집과 PNG 저장은 프론트만으로 된다. 템플릿과 내 문구 저장에는 백엔드가 떠 있어야 한다 (Vite 가 `/api` 를 8000 으로 넘긴다).

## 글꼴

Pretendard, Black Han Sans, Do Hyeon 을 같이 묶는다 (모두 SIL OFL). 나머지는 Windows 기본 글꼴이다.
