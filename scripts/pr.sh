#!/usr/bin/env bash
# usage: scripts/pr.sh <branch> "<title>" "<body>"  -> commits, pushes, opens a PR and squash-merges it (real PR flow)
set -euo pipefail
B="$1"; TITLE="$2"; BODY="$3"; T=$(cat /home/sandbox/.vault/github-classic*/password)
TRAILERS=$'\n\nCo-authored-by: 3mrdiab <356948613+3mrdiab@users.noreply.github.com>\nCo-authored-by: Claude <noreply@anthropic.com>'
git checkout -q -B "$B"; git add -A
git commit -q -m "$TITLE" -m "$BODY$TRAILERS"
git push -q -u origin "$B" --force
PR=$(curl -s -X POST -H "Authorization: Bearer $T" https://api.github.com/repos/alhinawi/hotelna/pulls -d "$(jq -n --arg t "$TITLE" --arg b "$BODY" --arg h "$B" '{title:$t,body:$b,head:$h,base:"main"}')")
N=$(echo "$PR" | jq -r .number); echo "PR #$N $(echo "$PR" | jq -r .html_url)"
curl -s -X PUT -H "Authorization: Bearer $T" https://api.github.com/repos/alhinawi/hotelna/pulls/$N/merge -d "$(jq -n --arg t "$TITLE (#$N)" --arg b "$BODY$TRAILERS" '{merge_method:"squash",commit_title:$t,commit_message:$b}')" | jq -r '.merged, .message'
git checkout -q main; git pull -q origin main
