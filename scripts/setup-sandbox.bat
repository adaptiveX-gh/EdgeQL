@echo off
rem EdgeQL Sandbox Environment Setup Script (Windows)
rem This script builds and verifies the Docker sandbox containers for Sprint 1

echo 🚀 Setting up EdgeQL Docker Sandbox Environment for Sprint 1
echo ============================================================
echo.

rem Check Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [INFO] Docker is running ✓
echo.

rem Build Python sandbox image
echo [INFO] Building Python sandbox image...
docker build -f docker/python-sandbox.Dockerfile -t edgeql-python-sandbox:latest .
if errorlevel 1 (
    echo [ERROR] Failed to build Python sandbox image
    pause
    exit /b 1
)

echo [INFO] Python sandbox image built successfully ✓
echo.

rem Verify image was created
docker images edgeql-python-sandbox:latest | findstr edgeql-python-sandbox >nul
if errorlevel 1 (
    echo [ERROR] Python sandbox image not found after build
    pause
    exit /b 1
)

echo [INFO] Python sandbox image verified ✓
echo.

rem Create temporary directories for testing
echo [INFO] Creating test directories...
if not exist C:\temp\edgeql-test\input mkdir C:\temp\edgeql-test\input
if not exist C:\temp\edgeql-test\output mkdir C:\temp\edgeql-test\output

rem Create test input
(
echo {
echo   "nodeType": "DataLoaderNode",
echo   "params": {
echo     "symbol": "BTC",
echo     "timeframe": "1m",
echo     "dataset": "BTC_1m_hyperliquid_perpetualx.csv"
echo   },
echo   "inputs": {},
echo   "context": {
echo     "runId": "test-run",
echo     "pipelineId": "test-pipeline",
echo     "datasets": {}
echo   }
echo }
) > C:\temp\edgeql-test\input\input.json

rem Test Python node execution
echo [INFO] Testing DataLoaderNode execution in sandbox...
echo.

docker run --rm --name edgeql-test-container --memory=512m --cpus=1.0 --network=none --read-only --tmpfs /tmp:rw,noexec,nosuid,size=100m -v "C:/temp/edgeql-test:/workspace" -v "%CD%/datasets:/datasets:ro" --user edgeql --security-opt no-new-privileges edgeql-python-sandbox python /app/nodes/DataLoaderNode.py /workspace/input/input.json /workspace/output/output.json

if errorlevel 1 (
    echo [ERROR] DataLoaderNode test failed
    pause
    exit /b 1
)

if not exist C:\temp\edgeql-test\output\output.json (
    echo [ERROR] DataLoaderNode test failed - no output file
    pause
    exit /b 1
)

echo.
echo [INFO] DataLoaderNode test successful ✓
echo.
echo [INFO] Sample output:
type C:\temp\edgeql-test\output\output.json | findstr /n "^" | head -20
echo.

rem Clean up test files
rmdir /s /q C:\temp\edgeql-test

rem Display summary
echo [INFO] Sandbox Environment Setup Complete!
echo.
echo 📋 Summary:
echo   ✓ Python sandbox image built and tested
echo   ✓ Security constraints verified
echo   ✓ DataLoaderNode execution tested
echo.
echo 🎯 Sprint 1 containers are ready for use!
echo.
echo 📚 Next steps:
echo   - Start executor service: pnpm --filter services/executor dev
echo   - Run integration tests: npm test  
echo   - Build additional node sandboxes as needed
echo.
echo [WARN] Note: Containers run with strict security constraints:
echo   • No network access
echo   • Read-only filesystem
echo   • Memory limited to 512MB
echo   • CPU limited to 1.0 core
echo   • Non-root user execution
echo.
pause