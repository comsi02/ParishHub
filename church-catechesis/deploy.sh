#!/usr/bin/env bash
set -e

# Move to script directory
cd "$(dirname "$0")"

echo "============================================="
echo " ✝️  Church Catechesis (주일학교) 배포 시작"
echo "============================================="

# 1. Build
./build.sh

# 2. Deploy Firestore rules (항상 재배포 — 전례 규칙과 공유 프로젝트 충돌 방지)
echo "🔒 Firestore 규칙 재배포 중..."
npx firebase deploy --only firestore:rules

# 3. Deploy hosting (or extra targets from args)
echo "🚀 Firebase 호스팅 배포 진행 중..."
if [ $# -eq 0 ]; then
  npx firebase deploy --only hosting
else
  npx firebase deploy "$@"
fi

echo "============================================="
echo " 🎉 Church Catechesis 배포 완료!"
echo "============================================="
echo "  • firestore:rules 배포됨"
echo "  • hosting 배포됨"
echo "============================================="
