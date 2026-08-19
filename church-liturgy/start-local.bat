@echo off
echo ===================================================
echo   가톨릭 성당 전례 프레젠테이션 시스템 (로컬 실행)
echo ===================================================
echo.

echo 1. 필요한 패키지(Node.js 모듈)가 설치되어 있는지 확인합니다...
if not exist "node_modules\" (
    echo 패키지가 설치되어 있지 않습니다. npm install을 진행합니다.
    npm install
) else (
    echo 패키지가 이미 설치되어 있습니다.
)

echo.
echo 2. 로컬 개발 서버(Vite)를 시작합니다...
echo (서버가 켜지면 표시되는 http://localhost:5173 주소를 브라우저에 입력하세요.)
echo.
npm run dev
