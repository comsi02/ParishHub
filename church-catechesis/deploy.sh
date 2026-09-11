#!/usr/bin/env bash
set -e

# Move to script directory
cd "$(dirname "$0")"

echo "============================================="
echo " ✝️  Church Catechesis (주일학교) 배포 시작"
echo "============================================="

# 1. Build
./build.sh

# 2. Deploy to Firebase
echo "🚀 Firebase 배포 진행 중..."
if [ $# -eq 0 ]; then
  npx firebase deploy
else
  npx firebase deploy "$@"
fi

echo "============================================="
echo " 🎉 Church Catechesis 배포 완료!"
echo "============================================="
