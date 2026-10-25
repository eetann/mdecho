#!/usr/bin/env bash
# videos/raw/*.webm を 1440x900 に切り出して mp4 にする
set -euo pipefail
# 使い方: convert.sh <作業ディレクトリ> [scene名...]
cd "$1"; shift
if [ $# -eq 0 ]; then set -- videos/raw/*.webm; fi
for src in "$@"; do
  [[ "$src" == videos/raw/* ]] || src="videos/raw/$src.webm"
  name="$(basename "$src" .webm)"
  ffmpeg -v error -y -i "$src" -vf "crop=1440:900:0:0" -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart -an "videos/$name.mp4"
  echo "videos/$name.mp4 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "videos/$name.mp4")s)"
done
