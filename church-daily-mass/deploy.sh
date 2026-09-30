#!/usr/bin/env bash

set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"

if ! command -v firebase >/dev/null 2>&1; then
  echo "Firebase CLI를 찾을 수 없습니다. 'npm install -g firebase-tools' 후 다시 실행하세요." >&2
  exit 1
fi

echo "Building church-daily-mass..."
npm run build

echo "Deploying Hosting, Functions, and Firestore rules..."
firebase deploy
