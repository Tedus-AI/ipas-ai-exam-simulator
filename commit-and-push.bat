@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ==================================================
echo   Git Commit ^& Push - iPAS Exam Simulator
echo ==================================================
echo.

REM 1. 確認是 git repo
if not exist ".git" (
    echo [X] 找不到 .git 資料夾，請確認你在正確的專案目錄。
    echo.
    pause
    exit /b 1
)

REM 2. 顯示目前變更
echo --- 目前變更 ---
git status --short
echo.

REM 3. 看有沒有變更需要 commit
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set CHANGES=%%i

if !CHANGES! equ 0 (
    echo 沒有檔案變更需要 commit。
    REM 但可能有 commit 還沒 push
    git log @{u}..HEAD --oneline > nul 2>&1
    if errorlevel 1 (
        echo 也沒有未推送的 commit。一切都是最新的。
        echo.
        pause
        exit /b 0
    ) else (
        echo 但有 commit 還沒 push，要直接推送嗎? ^(Y/N^)
        set /p PUSH_ONLY=
        if /i "!PUSH_ONLY!" neq "Y" (
            echo 已取消。
            pause
            exit /b 0
        )
        goto :do_push
    )
)

REM 4. 詢問 commit 訊息
echo.
echo 請輸入 commit 訊息 ^(直接 Enter = 使用預設 "update"^):
set /p MSG=^>^> 
if "!MSG!"=="" set MSG=update

REM 5. add + commit
echo.
echo --- 加入檔案 ---
git add .
if errorlevel 1 (
    echo [X] git add 失敗
    pause
    exit /b 1
)

echo.
echo --- 建立 commit ---
git commit -m "!MSG!"
if errorlevel 1 (
    echo [X] git commit 失敗
    pause
    exit /b 1
)

:do_push
REM 6. push
echo.
echo --- 推送到 GitHub ---
git push
if errorlevel 1 (
    echo.
    echo [X] Push 失敗，請查看上方錯誤訊息。
    echo 常見原因:
    echo   - 網路斷線
    echo   - GitHub 認證過期 ^(在 PowerShell 跑一次 git push 用瀏覽器重新登入^)
    echo   - 遠端有新 commit ^(先跑 git pull --rebase 再試^)
    echo.
    pause
    exit /b 1
)

echo.
echo ==================================================
echo   [OK] 完成! GitHub Actions 1-2 分鐘後重新部署。
echo ==================================================
echo.
echo Actions: https://github.com/Tedus-AI/ipas-ai-exam-simulator/actions
echo Site:    https://tedus-ai.github.io/ipas-ai-exam-simulator/
echo.
pause
