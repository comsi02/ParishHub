#!/usr/bin/env bash
set -e

# Move to script directory
cd "$(dirname "$0")"

echo "============================================="
echo " ✝️  Church Catechesis (주일학교) 빌드 시작"
echo "============================================="

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "📦 패키지 설치 중 (npm install)..."
  npm install
fi

# Run Vite build
echo "🔨 프로덕션 빌드 실행 (Vite)..."
npm run build

echo "============================================="
echo " ✅ 빌드 완료! dist/ 디렉토리가 생성되었습니다."
echo "============================================="
