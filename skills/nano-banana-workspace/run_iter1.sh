#!/bin/zsh
# Run all 8 eval runs (4 with_skill + 4 without_skill) via headless claude -p, from /tmp
# so the baseline gets ZERO ambient skill exposure. With_skill inlines the skill as context.
set -u
WS="/Users/cracklehat/Sites/a-skills-collection/.claude/skills/nano-banana-workspace/iteration-1"
SK="/Users/cracklehat/Sites/a-skills-collection/.claude/skills/nano-banana"
CTX="$WS/_skill_context.md"

{
  echo "# nano-banana skill — authoritative source of truth"
  echo
  cat "$SK/SKILL.md"
  printf '\n\n===== FILE: references/vertex-ai.md =====\n\n'
  cat "$SK/references/vertex-ai.md"
  printf '\n\n===== FILE: references/gemini-api.md =====\n\n'
  cat "$SK/references/gemini-api.md"
} > "$CTX"

run_one() {
  local dir="$1" cond="$2"
  local pf="$WS/$dir/prompt.txt"
  local out="$WS/$dir/$cond/outputs"
  local pcombined
  if [ "$cond" = "with_skill" ]; then
    pcombined="$WS/$dir/$cond/_combined_prompt.txt"
    {
      cat "$CTX"
      printf '\n\n=====\nUsing ONLY the reference documentation above as your authoritative source of truth (it reflects the current GA models; trust it over your own memory), answer the following user request. Write production-quality code where asked.\n\nUSER REQUEST:\n'
      cat "$pf"
    } > "$pcombined"
  else
    pcombined="$pf"
  fi
  cd /tmp
  claude -p "$(cat "$pcombined")" --output-format json > "$out/raw.json" 2> "$out/err.log"
  python3 - "$out" <<'PY'
import json,sys,os
out=sys.argv[1]
try:
    d=json.load(open(os.path.join(out,"raw.json")))
    open(os.path.join(out,"answer.md"),"w").write(d.get("result") or "")
    u=d.get("usage") or {}
    tot=(u.get("input_tokens") or 0)+(u.get("output_tokens") or 0)+(u.get("cache_read_input_tokens") or 0)+(u.get("cache_creation_input_tokens") or 0)
    json.dump({"total_tokens":tot,"duration_ms":d.get("duration_ms"),
               "total_duration_seconds":round((d.get("duration_ms") or 0)/1000,1),
               "total_cost_usd":d.get("total_cost_usd")},
              open(os.path.join(out,"timing.json"),"w"), indent=2)
except Exception as e:
    open(os.path.join(out,"answer.md"),"w").write("ERROR parsing run: "+str(e))
PY
}

for dir in eval-1-vertex-pro-ts-helper eval-2-flash-vs-pro-cost eval-3-conversational-editor eval-4-grounding-and-watermark; do
  run_one "$dir" with_skill &
  run_one "$dir" without_skill &
done
wait
echo "ALL_RUNS_DONE"
