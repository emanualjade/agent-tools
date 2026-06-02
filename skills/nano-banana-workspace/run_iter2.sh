#!/bin/zsh
# Iteration 2: re-run the 4 with_skill runs against the CORRECTED skill; reuse iter-1 baselines.
set -u
WS1="/Users/cracklehat/Sites/a-skills-collection/.claude/skills/nano-banana-workspace/iteration-1"
WS2="/Users/cracklehat/Sites/a-skills-collection/.claude/skills/nano-banana-workspace/iteration-2"
SK="/Users/cracklehat/Sites/a-skills-collection/.claude/skills/nano-banana"
CTX="$WS2/_skill_context.md"
mkdir -p "$WS2"
{
  echo "# nano-banana skill — authoritative source of truth"
  echo
  cat "$SK/SKILL.md"
  printf '\n\n===== FILE: references/vertex-ai.md =====\n\n'
  cat "$SK/references/vertex-ai.md"
  printf '\n\n===== FILE: references/gemini-api.md =====\n\n'
  cat "$SK/references/gemini-api.md"
} > "$CTX"

EVALS=(eval-1-vertex-pro-ts-helper eval-2-flash-vs-pro-cost eval-3-conversational-editor eval-4-grounding-and-watermark)

# scaffold + reuse baselines
for e in $EVALS; do
  mkdir -p "$WS2/$e/with_skill/run-1/outputs" "$WS2/$e/without_skill/run-1/outputs"
  cp "$WS1/$e/prompt.txt" "$WS2/$e/prompt.txt"
  cp "$WS1/$e/eval_metadata.json" "$WS2/$e/eval_metadata.json"
  # reuse the unchanged no-skill baseline (answer + grading + timing)
  cp "$WS1/$e/without_skill/run-1/outputs/answer.md" "$WS2/$e/without_skill/run-1/outputs/answer.md"
  cp "$WS1/$e/without_skill/run-1/grading.json" "$WS2/$e/without_skill/run-1/grading.json"
  cp "$WS1/$e/without_skill/run-1/timing.json" "$WS2/$e/without_skill/run-1/timing.json"
done

run_with_skill() {
  local e="$1"
  local out="$WS2/$e/with_skill/run-1/outputs"
  local pc="$WS2/$e/with_skill/_combined_prompt.txt"
  {
    cat "$CTX"
    printf '\n\n=====\nUsing ONLY the reference documentation above as your authoritative source of truth (it reflects the current GA models; trust it over your own memory), answer the following user request. Write production-quality code where asked.\n\nUSER REQUEST:\n'
    cat "$WS2/$e/prompt.txt"
  } > "$pc"
  cd /tmp
  claude -p "$(cat "$pc")" --output-format json > "$out/raw.json" 2> "$out/err.log"
  python3 - "$out" "$WS2/$e/with_skill/run-1" <<'PY'
import json,sys,os
out, rundir = sys.argv[1], sys.argv[2]
try:
    d=json.load(open(os.path.join(out,"raw.json")))
    open(os.path.join(out,"answer.md"),"w").write(d.get("result") or "")
    u=d.get("usage") or {}
    tot=(u.get("input_tokens") or 0)+(u.get("output_tokens") or 0)+(u.get("cache_read_input_tokens") or 0)+(u.get("cache_creation_input_tokens") or 0)
    json.dump({"total_tokens":tot,"duration_ms":d.get("duration_ms"),
               "total_duration_seconds":round((d.get("duration_ms") or 0)/1000,1),
               "total_cost_usd":d.get("total_cost_usd")},
              open(os.path.join(rundir,"timing.json"),"w"), indent=2)
except Exception as ex:
    open(os.path.join(out,"answer.md"),"w").write("ERROR parsing run: "+str(ex))
PY
  rm -f "$out/raw.json" "$out/err.log" "$pc"
}

for e in $EVALS; do run_with_skill "$e" & done
wait
rm -f "$CTX"
echo "ITER2_DONE"
