@echo off
REM Build Enhanced JavaScript Sandbox Docker Image

echo Building enhanced JavaScript sandbox image...
echo.

cd /d "%~dp0\.."

REM Build the enhanced sandbox image
docker build -f docker/node-sandbox.Dockerfile -t edgeql-nodejs-sandbox .

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ JavaScript sandbox image built successfully!
    echo.
    echo Image: edgeql-nodejs-sandbox
    echo Features:
    echo - Configurable memory limits (default: 512MB)
    echo - Configurable time limits (default: 30s)
    echo - Network isolation (configurable)
    echo - Filesystem restrictions
    echo - API access controls
    echo - Resource monitoring
    echo.
    
    REM Test that the image works
    echo Testing sandbox image...
    docker run --rm edgeql-nodejs-sandbox node --version
    
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Sandbox image test passed!
    ) else (
        echo ❌ Sandbox image test failed!
    )
) else (
    echo ❌ Failed to build JavaScript sandbox image!
    echo Check the logs above for errors.
)

echo.
pause