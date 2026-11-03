#!/usr/bin/env bash
# 部署到 Home Assistant（HAOS）。
# Deploy to Home Assistant (HAOS).
#
# 用法 / usage:  ./deploy.sh <ssh-host> [dest-dir]
# <ssh-host> = 你 Home Assistant 的 SSH 連線名（見自己的 ~/.ssh/config）。
# <ssh-host> = the SSH host/alias of your Home Assistant (from your ~/.ssh/config).
#
# HAOS 的 SSH add-on 沒有 rsync，故用 tar 經 ssh 傳送。
# 只覆寫本 repo 的檔案，不會刪除目標目錄內其他檔案。
# The HAOS SSH add-on has no rsync, so stream a tarball over ssh.
# Only this repo's files are overwritten; nothing else in dest-dir is removed.
set -euo pipefail

HOST="${1:?Usage: ./deploy.sh <ssh-host-of-home-assistant> [dest-dir]}"
DEST="${2:-/config/www/hkweather}"
SRC="$(cd "$(dirname "$0")" && pwd)/dist"

FILES=(hkweather.js hkweather-data.js hkweather-i18n.js hkweather-poller.js hkweather-view.js)
VERSION="$(cd "$SRC" && cat "${FILES[@]}" | sha256sum | cut -c1-8)"

echo ">> 部署到 ${HOST}:${DEST}"
tar -C "$SRC" -czf - "${FILES[@]}" | ssh "$HOST" "mkdir -p '${DEST}' && tar -C '${DEST}' -xzf -"

echo ">> 完成。Lovelace 資源網址（更新後要改 ?v=）/ Done. Lovelace resource URL (change ?v= after each update):"
echo "   /local/${DEST#/config/www/}/hkweather.js?v=${VERSION}"
