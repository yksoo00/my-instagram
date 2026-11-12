# MY INSTAGRAM STUDIO

인스타그램 카드뉴스용 개인 사진 편집기. AI API 없이 동작한다. 기획: [docs/plan.md](docs/plan.md)

## 구성

- `frontend/` Vite + React + TypeScript + react-konva + Zustand
- `backend/` FastAPI + SQLAlchemy + SQLite (얇은 저장 API)
- `data/` SQLite 파일(`studio.db`)과 업로드 이미지 (git 제외)

## 처음 쓰는 사람용 설치 (아무것도 안 깔린 Windows)

1. GitHub 의 `install.bat` 파일 페이지에서 **Download raw file** 로 `install.bat` 하나만 받는다.
2. 두 번 눌러 실행한다. Git, Python 3.12, Node.js 가 없으면 winget 으로 자동 설치한다 (허용 창이 뜨면 [예]).
3. 소스를 `내 폴더\my-instagram` 에 받고, 파이썬 가상환경(venv)과 화면을 만든 뒤 바탕화면에 **MY INSTAGRAM STUDIO** 아이콘을 만든다.
4. 다음부터는 바탕화면 아이콘(= `start.bat`)만 누르면 된다. 실행할 때마다 `git pull` 로 최신 버전을 받고, 바뀐 게 있을 때만 다시 설치·빌드한다.

`start.bat` 은 서버 한 개(포트 8000)만 띄우고 Edge 앱 창으로 연다. 그 검은 창을 닫으면 프로그램이 종료된다.
Windows 10 이전 버전처럼 winget 이 없으면 안내가 나오니 Git·Python 3.12·Node.js 를 직접 설치한 뒤 다시 실행한다.

`install.bat`, `start.bat` 은 한글 메시지를 CP949 로 저장한다 (UTF-8 이면 cmd 가 한글 줄을 잘못 읽는다). 고칠 때 인코딩에 주의한다.

### 데이터 위치와 백업

템플릿·프로젝트·내 문구는 `data\studio.db`, 올린 사진은 `data\uploads\`, 내 글꼴은 `data\fonts\` 에 저장된다 (git 에는 올라가지 않는다).
앱 오른쪽 패널의 **백업·복원**에서 이 전체를 zip 하나로 받고 되돌릴 수 있다. 복원하기 직전의 데이터는 `data\backups\` 에 자동으로 남는다.
`data` 폴더를 통째로 복사해 두는 것도 같은 백업이다.

### 바탕화면 앱으로 설치 (선택)

서버를 켠 상태에서 Chrome/Edge 로 `http://localhost:8000` 을 열고 주소창의 설치 아이콘(또는 메뉴 → 앱 설치)을 누르면 앱으로 등록된다. 아이콘은 `scripts\make-icons.ps1` 로 다시 만들 수 있다. 서버가 꺼져 있으면 앱도 열리지 않으므로 보통은 바탕화면 아이콘(`start.bat`)이 더 편하다.

## 개발할 때 실행

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
