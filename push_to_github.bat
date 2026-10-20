@echo off
echo ========================================================
echo   TerraShield AI - GitHub Push to Gagguverse/TerraShield-AI
echo ========================================================
echo.
echo Pushing safe project files to:
echo https://github.com/Gagguverse/TerraShield-AI
echo.
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo   Push successfully completed!
    echo   Repository URL: https://github.com/Gagguverse/TerraShield-AI
    echo ========================================================
) else (
    echo ========================================================
    echo   Push failed or was cancelled.
    echo   Please check your GitHub login and permissions.
    echo ========================================================
)
pause
