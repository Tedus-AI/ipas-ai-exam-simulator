@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo.
echo === Pushing to GitHub ===
echo.
git push
if %errorlevel% equ 0 (
    echo.
    echo [OK] Push success! GitHub Actions will redeploy in 1-2 minutes.
    echo View Actions: https://github.com/Tedus-AI/ipas-ai-exam-simulator/actions
) else (
    echo.
    echo [X] Push failed. See error above.
)
echo.
pause
