@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MY INSTAGRAM STUDIO

if not exist "backend\.venv\Scripts\python.exe" goto not_installed

rem 이미 켜져 있으면 창만 다시 연다.
netstat -ano | findstr ":8000 " | findstr LISTENING >nul
if not errorlevel 1 goto already_running

rem ---------- 최신 버전 받기 ----------
set "BEFORE="
set "AFTER="
set "NEED_BUILD="
where git >nul 2>nul
if errorlevel 1 goto skip_pull
if not exist ".git" goto skip_pull
for /f %%H in ('git rev-parse HEAD 2^>nul') do set "BEFORE=%%H"
echo 최신 버전 확인 중...
git pull --ff-only
if errorlevel 1 echo  업데이트를 받지 못했습니다. 인터넷이 없거나 파일을 직접 고쳤을 수 있습니다. 지금 버전으로 실행합니다.
for /f %%H in ('git rev-parse HEAD 2^>nul') do set "AFTER=%%H"
:skip_pull

rem ---------- 바뀐 게 있을 때만 다시 설치·빌드 ----------
if not "%BEFORE%"=="%AFTER%" set "NEED_BUILD=1"
if not exist "frontend\dist\index.html" set "NEED_BUILD=1"
if not defined NEED_BUILD goto run

echo 업데이트 적용 중... 잠시만 기다려 주세요.
"backend\.venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check -r backend\requirements.txt
if errorlevel 1 goto update_failed
pushd frontend
call pnpm install --frozen-lockfile
if errorlevel 1 goto update_failed_pop
call pnpm build
if errorlevel 1 goto update_failed_pop
popd

:run
echo.
echo  ============================================
echo   MY INSTAGRAM STUDIO 실행 중
echo   이 창을 닫으면 프로그램이 종료됩니다.
echo  ============================================
echo.

rem 서버가 뜰 시간을 준 뒤 앱 창을 연다. Edge 가 있으면 주소창 없는 앱 창, 없으면 기본 브라우저.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 3; try { Start-Process msedge -ArgumentList '--app=http://localhost:8000' -ErrorAction Stop } catch { Start-Process 'http://localhost:8000' }"

pushd backend
".venv\Scripts\python.exe" -m uvicorn app.main:app --port 8000
popd
echo.
echo  프로그램이 종료되었습니다.
pause
exit /b 0

:already_running
start "" powershell -NoProfile -WindowStyle Hidden -Command "try { Start-Process msedge -ArgumentList '--app=http://localhost:8000' -ErrorAction Stop } catch { Start-Process 'http://localhost:8000' }"
exit /b 0

:not_installed
echo.
echo  아직 설치되지 않았습니다. 같은 폴더의 install.bat 을 먼저 실행하세요.
echo.
pause
exit /b 1

:update_failed_pop
popd
:update_failed
echo.
echo  [실패] 업데이트 적용에 실패했습니다. 인터넷 연결을 확인하고 다시 실행하세요.
echo.
pause
exit /b 1
