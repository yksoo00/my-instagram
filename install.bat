@echo off
setlocal EnableExtensions
title MY INSTAGRAM STUDIO 설치

echo.
echo  ============================================
echo   MY INSTAGRAM STUDIO 설치
echo  ============================================
echo   처음 한 번만 실행하면 됩니다. 몇 분 걸립니다.
echo   중간에 "이 앱이 변경하도록 허용" 창이 뜨면 [예]를 누르세요.
echo.

rem 설치 위치: 저장소 폴더 안에서 실행했으면 그 폴더, install.bat 한 파일만 받았으면 내 폴더 아래
set "REPO=%USERPROFILE%\my-instagram"
if exist "%~dp0backend\app\main.py" set "REPO=%~dp0"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"
set "REPO_URL=https://github.com/yksoo00/my-instagram.git"

call :refresh_path

rem ---------- 1. 필요한 프로그램 설치 (Git, Python 3.12, Node.js) ----------
echo [1/5] 필요한 프로그램 확인 중...

where git >nul 2>nul
if errorlevel 1 call :winget_install Git.Git "Git"
where git >nul 2>nul
if errorlevel 1 goto missing_tool

where node >nul 2>nul
if errorlevel 1 call :winget_install OpenJS.NodeJS.LTS "Node.js"
where node >nul 2>nul
if errorlevel 1 goto missing_tool

py -3.12 --version >nul 2>nul
if errorlevel 1 call :winget_install Python.Python.3.12 "Python 3.12"
py -3.12 --version >nul 2>nul
if errorlevel 1 goto missing_tool

rem ---------- 2. 소스 받기 ----------
echo [2/5] 프로그램 파일 받는 중...
if exist "%REPO%\backend\app\main.py" goto have_source
git clone "%REPO_URL%" "%REPO%"
if errorlevel 1 goto clone_failed
:have_source

rem ---------- 3. 파이썬 가상환경(venv) + 패키지 ----------
echo [3/5] 파이썬 환경 만드는 중...
if not exist "%REPO%\backend\.venv\Scripts\python.exe" py -3.12 -m venv "%REPO%\backend\.venv"
if not exist "%REPO%\backend\.venv\Scripts\python.exe" goto venv_failed
"%REPO%\backend\.venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check -r "%REPO%\backend\requirements.txt"
if errorlevel 1 goto pip_failed

rem ---------- 4. 화면(프론트) 패키지 설치 + 빌드 ----------
echo [4/5] 화면 만드는 중... 처음엔 오래 걸립니다.
where pnpm >nul 2>nul
if errorlevel 1 call npm install -g pnpm
call :refresh_path
where pnpm >nul 2>nul
if errorlevel 1 goto pnpm_failed
pushd "%REPO%\frontend"
call pnpm install --frozen-lockfile
if errorlevel 1 goto pnpm_failed
call pnpm build
if errorlevel 1 goto pnpm_failed
popd

rem ---------- 5. 바탕화면 아이콘 ----------
echo [5/5] 바탕화면에 아이콘 만드는 중...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\MY INSTAGRAM STUDIO.lnk'); $s.TargetPath='%REPO%\start.bat'; $s.WorkingDirectory='%REPO%'; $s.IconLocation='%REPO%\frontend\public\app.ico'; $s.WindowStyle=7; $s.Save()"

echo.
echo  설치 끝! 이제 바탕화면의 "MY INSTAGRAM STUDIO" 아이콘을 두 번 누르면 실행됩니다.
echo  지금 바로 실행합니다.
echo.
timeout /t 3 >nul
call "%REPO%\start.bat"
exit /b 0


rem ======================= 함수 =======================

:refresh_path
rem 방금 설치한 프로그램이 이 창에서도 보이도록 PATH 를 레지스트리에서 다시 읽는다.
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"`) do set "PATH=%%P;%PATH%"
exit /b 0

:winget_install
where winget >nul 2>nul
if errorlevel 1 goto winget_missing
echo      %~2 설치 중...
winget install -e --id %~1 --silent --accept-package-agreements --accept-source-agreements
call :refresh_path
exit /b 0

:winget_missing
rem 함수 안이라 goto 로 빠져나가지 않고 안내만 찍은 뒤 돌아간다. 호출한 쪽이 설치 여부를 다시 확인한다.
echo.
echo  [안내] 자동 설치 도구 winget 이 이 컴퓨터에 없어 %~2 을 자동으로 설치하지 못했습니다.
echo         Microsoft Store 에서 "앱 설치 관리자"를 업데이트한 뒤 다시 실행하거나,
echo         아래 세 가지를 직접 설치한 뒤 다시 실행하세요.
echo           Git         https://git-scm.com/download/win
echo           Python 3.12 https://www.python.org/downloads/
echo           Node.js     https://nodejs.org/
exit /b 1


rem ======================= 실패 안내 =======================

echo.
echo  [실패] 자동 설치 도구(winget)가 이 컴퓨터에 없습니다.
echo  Microsoft Store 에서 "앱 설치 관리자"를 업데이트한 뒤 다시 실행하거나,
echo  아래 세 가지를 직접 설치한 뒤 다시 실행하세요.
echo    Git        https://git-scm.com/download/win
echo    Python 3.12 https://www.python.org/downloads/
echo    Node.js    https://nodejs.org/
goto fail

:missing_tool
echo.
echo  [실패] Git, Python 3.12, Node.js 중 설치되지 않은 것이 있습니다.
echo  위 안내를 확인하고, 이 창을 닫은 뒤 install.bat 을 한 번 더 실행해 보세요.
echo  설치 직후에는 컴퓨터를 다시 시작해야 인식되는 경우도 있습니다.
goto fail

:clone_failed
echo.
echo  [실패] 프로그램 파일을 받지 못했습니다. 인터넷 연결을 확인하세요.
goto fail

:venv_failed
echo.
echo  [실패] 파이썬 환경을 만들지 못했습니다.
goto fail

:pip_failed
echo.
echo  [실패] 파이썬 패키지 설치에 실패했습니다. 인터넷 연결을 확인하세요.
goto fail

:pnpm_failed
echo.
echo  [실패] 화면 패키지 설치 또는 빌드에 실패했습니다. 인터넷 연결을 확인하세요.
goto fail

:fail
echo.
pause
exit /b 1
