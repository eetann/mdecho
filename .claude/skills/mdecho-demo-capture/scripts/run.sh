#!/usr/bin/env bash
# 使い方: run.sh <作業ディレクトリ> <URL> <scene名>...
# <作業ディレクトリ>/scenes/<scene名>.js を _head.js と連結して playwright-cli の blog セッションで実行する
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$1" && pwd)"; url="$2"; shift 2
mkdir -p "$root/shots" "$root/videos/raw"
for name in "$@"; do
  tmp="$(mktemp -t scene).js"
  {
    echo "async page => {"
    echo "  const ROOT = '$root';"
    echo "  const URL = '$url';"
    cat "$here/_head.js"
    cat "$root/scenes/$name.js"
    echo "}"
  } > "$tmp"
  echo "== $name"
  playwright-cli -s=blog run-code --filename="$tmp" | sed -n '1,3p'
  rm -f "$tmp"
done
