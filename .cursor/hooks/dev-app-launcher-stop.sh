#!/bin/bash
# Cursor stop hook — notifies Dev App Launcher when an agent iteration ends.
input=$(cat)
project_path=$(echo "$input" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    roots=d.get('workspace_roots') or d.get('workspaceRoots') or []
    if roots:
        print(roots[0])
    else:
        print(d.get('cwd',''))
except Exception:
    print('')
" 2>/dev/null)

if [ -z "$project_path" ]; then
  exit 0
fi

curl -s -X POST "http://127.0.0.1:28420/cursor/agent-stopped" \
  -H "Content-Type: application/json" \
  -d "{\"projectPath\": \"$project_path\"}" >/dev/null 2>&1 || true
exit 0
