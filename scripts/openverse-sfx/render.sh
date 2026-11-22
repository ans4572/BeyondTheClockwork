#!/bin/bash
# render.sh <outdir> [ids...]: render chapter 3 boss recipes from the running local server into <outdir>/<id>.wav.
S="$(cd "$(dirname "$0")" && pwd)"; OUT="$S/$1"; shift; mkdir -p "$OUT"
IDS="$*"; [ -z "$IDS" ] && IDS=$(grep -o "^  'boss-[A-Za-z0-9]*'" "/c/Users/ans45/OneDrive/바탕 화면/Beyond the Clockwork/src/audio/clock-sound.js" | tr -d " '")
timeout 60 agent-browser open http://localhost:4173/sounds.html >/dev/null 2>&1
STAMP=$(date +%s)
for id in $IDS; do
  timeout 60 agent-browser eval "window.__rid='$id'; window.__rstamp='$STAMP'" >/dev/null 2>&1
  timeout 60 agent-browser eval "$(cat "$S/render.js")" 2>/dev/null | tail -1 | tr -d '"\r\n' | base64 -d > "$OUT/$id.wav" 2>/dev/null
  printf '%s %s\n' "$id" "$(stat -c %s "$OUT/$id.wav")"
done
