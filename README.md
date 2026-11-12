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
```
