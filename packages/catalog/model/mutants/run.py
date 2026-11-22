#!/usr/bin/env python3
"""Runs the review's mutants: each one change to the model, against its proof and the two story files.

    python3 -I mutants/run.py --sample              nine fast mutants, chosen below (about a minute)
    python3 -I mutants/run.py --all --jobs 4        all of them (an hour or more on a busy machine)
    python3 -I mutants/run.py --only key1,key2      the ones named
    python3 -I mutants/run.py --list                the mutants, one a line, and nothing run

Run from anywhere; paths are taken from this file. Each mutant named in `mutants.json` (next to this file) is one
text replaced in one file of `src/`: a check of a `decide` removed, one field of an event given a wrong value, or an
accepted act made to record nothing. For each one chosen, the package's `src/`, `test/`, `package.json`,
`tsconfig*.json` and `vitest.config.ts` are copied to `.mutants/<key>/` (inside the package, so `@inventory/*`,
`@alchemy.run/domain` and `effect` resolve as they do for the package), the change is made there, and vitest runs the
mutant's proof file and both story files in that copy with its JSON reporter. The class:

    rule     the proof failed: a proved rule, or the report's own counts, notice the change
    story    only a story failed: the change is seen, but no rule says it is wrong
    neither  nothing failed: the change goes unnoticed

The run exits 1 when a mutant is held by neither, when one an earlier trial found held by a rule is now held by a
story only (a rule got weaker), when a mutant does not apply (its old text is not found exactly once after its
anchors and before its end), or when a run gives no result. A mutant held by a rule where the trial had a story is an
improvement, said and not a failure. Before the mutants, the copy is run once unchanged (`baseline`): when that fails,
every mutant would look held, so the run stops with exit 2. Results go to `.mutants/results.tsv`.

Python 3, standard library only. No file of the package itself is ever written: only the copies.
"""
import argparse
import collections
import concurrent.futures
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)
ROOT = os.path.normpath(os.path.join(PKG, "..", "..", ".."))
VITEST = os.path.join(ROOT, "node_modules", ".bin", "vitest")
WORK = os.path.join(PKG, ".mutants")
STORIES = ["test/Review.story.test.ts", "test/Group.story.test.ts"]
COPIED_FILES = ["package.json", "vitest.config.ts"]
COPIED_DIRS = ["src", "test"]
# The copy sits two folders below the package, so what the package reaches as `../../../` (the repository's root
# configuration) the copy reaches two levels further up.
UP_FROM_PACKAGE = "../../../"
UP_FROM_COPY = "../../../../../"

# The sample: fast mutants only (the import's own commands and the two group decisions, each proof a few seconds), one
# of every kind for each class an earlier trial found. DecideRow and UndoRowStep are left out: a broken rule there
# takes the prover from one to twenty-three minutes to confirm.
SAMPLE = [
    "confirm-sum",               # check, rule: the counts' sum removed; OutcomesAddUpToTheRows breaks
    "group-madeon",              # check, rule: a group on an older matching taken; AGroupIsMadeOnTheMatchingNow breaks
    "match-same",                # check, story: the same columns recorded as a match; no rule says it, a story does
    "gundo-decided",             # check, story: an undo of a step that decided no group; the trial's prover stayed PROVED
    "gundo-groupcounted-top",    # field, rule: the import's last group in force after an undo; a rule of UndoGroup
    "stage-f-rows",              # field, story: the staged file's row count off by one; no rule of the import reads it
    "group-groupdecided-label",  # field, story: a group's label; no rule reads labels
    "stage-nothing",             # nothing, story: a stage that records nothing; no rule says an act is taken
    "group-nothing",             # nothing, story in the trial: the proof's "some state lets it record" may hold it now
]


def load():
    with open(os.path.join(HERE, "mutants.json")) as f:
        return json.load(f)["mutants"]


def apply(text, mutant):
    """The file's text with the mutant's change made, or the reason it cannot be made."""
    at = 0
    for anchor in mutant["anchors"]:
        found = text.find(anchor, at)
        if found < 0:
            return None, f"anchor not found: {anchor!r}"
        at = found
    start = at
    end = len(text)
    if mutant.get("until"):
        end = text.find(mutant["until"], start + len(mutant["anchors"][-1]))
        if end < 0:
            return None, f"end not found: {mutant['until']!r}"
    count = text.count(mutant["old"], start, end)
    if count != 1:
        return None, f"old text found {count} times after the anchors, where it must be once: {mutant['old']!r}"
    i = text.index(mutant["old"], start, end)
    changed = text[:i] + mutant["new"] + text[i + len(mutant["old"]):]
    if changed == text:
        return None, "the change changes nothing"
    return changed, ""


def copy_package(dest):
    shutil.rmtree(dest, ignore_errors=True)
    os.makedirs(dest)
    for d in COPIED_DIRS:
        shutil.copytree(os.path.join(PKG, d), os.path.join(dest, d))
    names = COPIED_FILES + sorted(n for n in os.listdir(PKG) if n.startswith("tsconfig") and n.endswith(".json"))
    for name in names:
        with open(os.path.join(PKG, name)) as f:
            text = f.read()
        if name != "package.json":
            text = text.replace(UP_FROM_PACKAGE, UP_FROM_COPY)
        with open(os.path.join(dest, name), "w") as f:
            f.write(text)


def file_of(path):
    return os.path.basename(path).replace(".test.ts", "")


def short(text, n=110):
    text = " ".join(text.split())
    return text if len(text) <= n else text[: n - 1] + "…"


RULE_LINE = re.compile(r"'(violated|not proved|proved for short lists only|read wrongly|not read|not decided)  ([^']+)'")
EXPECTED = re.compile(r"expected (.{1,60}?) to (?:be|deeply equal) (.{1,60}?)(?:\s*//|$)", re.M)


def why_proof(messages):
    """What the proof said broke: the rules not proved, by name; else the first assertion that failed."""
    text = "\n".join(messages)
    # The report printed beside a failure (`whatBroke` in test/proving.ts): a line "✗ <rule>" for each rule not
    # proved, and under it "    ✗ <command>: <how it stands>" for the import's rules.
    rules, current, under = [], None, []
    for line in text.splitlines():
        top = re.match(r"^✗ (.+?)(?:: expected .*)?$", line)
        sub = re.match(r"^\s+✗ (\S+?):? (violated|not proved|unconfirmed|read wrongly|not read|not decided)\b", line)
        if top:
            if current is not None:
                rules.append(current + (f" ({', '.join(under)})" if under else ""))
            current, under = top.group(1), []
        elif sub and current is not None:
            under.append(f"{sub.group(1)} {sub.group(2)}")
        elif current is not None and not line.startswith(" "):
            rules.append(current + (f" ({', '.join(under)})" if under else ""))
            current, under = None, []
    if current is not None:
        rules.append(current + (f" ({', '.join(under)})" if under else ""))
    rules = [r for r in dict.fromkeys(rules) if not r.startswith("Import folds")]
    if not rules:
        for standing, name in RULE_LINE.findall(text):
            item = f"{standing} {name.strip()}"
            if item not in rules:
                rules.append(item)
    if rules:
        return rules
    m = EXPECTED.search(text)
    if m:
        return [f"expected {m.group(2).strip()}, got {m.group(1).strip()}"]
    first = next((line for line in text.splitlines() if line.strip()), "no message")
    return [short(first, 140)]


def read_result(path, proof):
    """From vitest's JSON report: whether the proof failed and why, and the stories that failed."""
    with open(path) as f:
        report = json.load(f)
    proof_failed, proof_why, stories, timeouts = False, [], [], 0
    seen = set()
    for result in report.get("testResults", []):
        name = result.get("name", "")
        seen.add(file_of(name))
        failed = [a for a in result.get("assertionResults", []) if a.get("status") == "failed"]
        load_failed = result.get("status") == "failed" and not failed
        is_proof = name.endswith(proof)
        if is_proof and (failed or load_failed):
            proof_failed = True
            messages = [m for a in failed for m in a.get("failureMessages", [])] or [result.get("message", "")]
            proof_why = why_proof(messages)
        elif not is_proof:
            story_file = file_of(name).replace(".story", "")
            if load_failed:
                stories.append(f"{story_file}: did not load: {short(result.get('message', ''), 80)}")
            for a in failed:
                said = " ".join(a.get("failureMessages", []))
                if "timed out" in said:
                    timeouts += 1
                stories.append(f"{story_file}: {a.get('title', a.get('fullName', ''))}" + (" (timed out)" if "timed out" in said else ""))
    expected = {file_of(proof)} | {file_of(s) for s in STORIES}
    missing = sorted(expected - seen)
    return proof_failed, proof_why, stories, timeouts, missing


def run_copy(key, mutant, proof, keep, nice, timeout):
    """Copies the package, makes the change (none for the baseline), runs vitest. Returns a result record."""
    dest = os.path.join(WORK, key)
    started = time.time()
    record = dict(key=key, cls="error", seconds=0.0, why=[], stories=[], note="")
    try:
        copy_package(dest)
        if mutant is not None:
            target = os.path.join(dest, mutant["file"])
            with open(target) as f:
                text = f.read()
            changed, reason = apply(text, mutant)
            if changed is None:
                record.update(cls="notapplied", note=reason)
                return record
            with open(target, "w") as f:
                f.write(changed)
        out = os.path.join(dest, "result.json")
        # Each copy keeps its own module cache: vitest clears its shared cache when it sees a workspace other than the
        # one that wrote it, and a copy's runs would clear it under the repository's own tests running beside them.
        args = [
            VITEST,
            "run",
            "--root",
            dest,
            proof,
            *STORIES,
            "--reporter=json",
            f"--outputFile={out}",
            f"--fsModuleCachePath={os.path.join(dest, '.vitest-cache')}",
        ]
        with open(os.path.join(dest, "vitest.log"), "w") as log:
            proc = subprocess.Popen(
                args,
                cwd=dest,
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
                preexec_fn=(lambda: os.nice(nice)) if nice else None,
            )
            try:
                proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGTERM)
                proc.wait()
                record["note"] = f"stopped after {timeout} s"
        if not os.path.exists(out):
            with open(os.path.join(dest, "vitest.log")) as f:
                tail = f.read()[-400:]
            record["note"] = (record["note"] + "; " if record["note"] else "") + "no result: " + short(tail, 200)
            return record
        proof_failed, proof_why, stories, timeouts, missing = read_result(out, proof)
        record["why"], record["stories"] = proof_why, stories
        if missing:
            record["note"] = "files that did not run: " + ", ".join(missing)
            return record
        if timeouts:
            record["note"] = f"{timeouts} story test(s) timed out"
        record["cls"] = "rule" if proof_failed else "story" if stories else "neither"
        return record
    finally:
        record["seconds"] = round(time.time() - started, 1)
        if not keep and record["cls"] not in ("error",):
            shutil.rmtree(dest, ignore_errors=True)


def verdict(mutant, cls):
    if cls in ("notapplied", "error", "neither"):
        return cls
    if cls == mutant["expect"]:
        return "same"
    if cls == "rule":
        return "improvement"
    return "weaker"


def load_avg():
    try:
        with open("/proc/loadavg") as f:
            return " ".join(f.read().split()[:3])
    except OSError:
        return "unknown"


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    pick = parser.add_mutually_exclusive_group(required=True)
    pick.add_argument("--all", action="store_true", help="every mutant")
    pick.add_argument("--sample", action="store_true", help="the fixed fast sample")
    pick.add_argument("--only", help="keys, comma-separated")
    pick.add_argument("--list", action="store_true", help="list the mutants and run nothing")
    parser.add_argument("--jobs", type=int, default=2, help="mutants run at once (default 2)")
    parser.add_argument("--keep", action="store_true", help="keep each copy after it is classified")
    parser.add_argument("--no-baseline", action="store_true", help="skip the run of the unchanged copy")
    parser.add_argument("--nice", type=int, default=10, help="niceness of each vitest run (default 10; 0 for none)")
    parser.add_argument("--timeout", type=int, default=3600, help="seconds before a mutant's run is stopped (default 3600)")
    opts = parser.parse_args()

    mutants = load()
    by_key = {m["key"]: m for m in mutants}
    if opts.list:
        for m in mutants:
            print(f"{m['key']:36} {m['target']:12} {m['kind']:8} {m['expect']:6} {m['file']}")
        return 0
    if opts.all:
        chosen = mutants
    else:
        keys = SAMPLE if opts.sample else [k.strip() for k in opts.only.split(",") if k.strip()]
        unknown = [k for k in keys if k not in by_key]
        if unknown:
            print("unknown keys: " + ", ".join(unknown), file=sys.stderr)
            return 1
        chosen = [by_key[k] for k in keys]
    if not os.path.exists(VITEST):
        print(f"vitest not found at {VITEST}: run bun install first", file=sys.stderr)
        return 1

    # Every chosen mutant must apply to the package's own text before anything runs.
    problems = []
    for m in chosen:
        with open(os.path.join(PKG, m["file"])) as f:
            _, reason = apply(f.read(), m)
        if reason:
            problems.append((m, reason))
    for m, reason in problems:
        print(f"DOES NOT APPLY {m['key']}: {reason}")
    ready = [m for m in chosen if all(m is not p[0] for p in problems)]

    os.makedirs(WORK, exist_ok=True)
    wall = time.time()
    load_before = load_avg()
    print(f"{len(ready)} mutants, {opts.jobs} at a time; load {load_before}", flush=True)

    if not opts.no_baseline:
        proofs = sorted({m["proof"] for m in ready})
        for proof in proofs:
            base = run_copy("baseline-" + file_of(proof).replace(".prove", ""), None, proof, opts.keep, opts.nice, opts.timeout)
            if base["cls"] != "neither":
                print(f"BASELINE FAILS for {proof} ({base['seconds']} s): {base['cls']} {base['why']} {base['stories']} {base['note']}")
                print("every mutant would look held; nothing more is run")
                return 2
            print(f"baseline {proof} and the stories pass, {base['seconds']} s", flush=True)

    lock = threading.Lock()
    results = {}

    def one(m):
        r = run_copy(m["key"], m, m["proof"], opts.keep, opts.nice, opts.timeout)
        r["verdict"] = verdict(m, r["cls"])
        with lock:
            results[m["key"]] = r
            said = "; ".join(r["why"]) if r["cls"] == "rule" else " | ".join(r["stories"])
            print(f"{m['key']:36} {r['cls']:8} {r['seconds']:7.1f}s  {r['verdict']:11} {short(said or r['note'], 120)}", flush=True)
        return r

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, opts.jobs)) as pool:
        list(pool.map(one, ready))

    for m, reason in problems:
        results[m["key"]] = dict(key=m["key"], cls="notapplied", seconds=0.0, why=[], stories=[], note=reason, verdict="notapplied")

    rows = ["key\ttarget\tkind\ttrial\tclass\tverdict\tseconds\tproof said\tstories failed\tnote"]
    for m in chosen:
        r = results[m["key"]]
        rows.append("\t".join([m["key"], m["target"], m["kind"], m["expect"], r["cls"], r["verdict"], str(r["seconds"]),
                               "; ".join(r["why"]) or "-", " | ".join(r["stories"]) or "-", r["note"] or "-"]))
    with open(os.path.join(WORK, "results.tsv"), "w") as f:
        f.write("\n".join(rows) + "\n")

    print()
    classes = collections.Counter(results[m["key"]]["cls"] for m in chosen)
    trial = collections.Counter(m["expect"] for m in chosen)
    print("class:   " + ", ".join(f"{c} {classes[c]}" for c in ("rule", "story", "neither", "notapplied", "error") if classes[c]))
    print("trial:   " + ", ".join(f"{c} {trial[c]}" for c in ("rule", "story")))
    for target in sorted({m["target"] for m in chosen}):
        ms = [m for m in chosen if m["target"] == target]
        cs = collections.Counter(results[m["key"]]["cls"] for m in ms)
        secs = sum(results[m["key"]]["seconds"] for m in ms)
        print(f"  {target:12} {len(ms):3} mutants  rule {cs['rule']:3}  story {cs['story']:3}  neither {cs['neither']}  "
              f"test time {secs:8.1f} s  longest {max(results[m['key']]['seconds'] for m in ms):7.1f} s")
    print(f"wall {time.time() - wall:.0f} s; load before {load_before}, after {load_avg()}")
    improved = [m["key"] for m in chosen if results[m["key"]]["verdict"] == "improvement"]
    if improved:
        print("held by a rule where the trial had a story only (improvement): " + ", ".join(improved))
    failing = [m for m in chosen if results[m["key"]]["verdict"] in ("neither", "weaker", "notapplied", "error")]
    for m in failing:
        r = results[m["key"]]
        what = {"neither": "held by neither", "weaker": "a rule got weaker: the trial saw " + ("; ".join(m["trialRules"]) or "-"),
                "notapplied": "does not apply", "error": "no result"}[r["verdict"]]
        print(f"FAIL {m['key']}: {what}. Change in {m['file']}: {m['old']!r} -> {m['new']!r}. "
              f"Ran {m['proof']} and the stories: {short('; '.join(r['why']) + ' ' + ' | '.join(r['stories']) + ' ' + r['note'], 200)}")
    return 1 if failing else 0


if __name__ == "__main__":
    sys.exit(main())
