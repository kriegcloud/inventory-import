#!/usr/bin/env python3
"""Runs the review's mutants: each one change to the model, against its proof and the two story files.

    python3 -I mutants/run.py --sample              nine fast mutants, chosen below (about a minute)
    python3 -I mutants/run.py --all --jobs 4        all of them (an hour or more on a busy machine)
    python3 -I mutants/run.py --only key1,key2      the ones named
    python3 -I mutants/run.py --all --except key1   all but the ones named (a slow one, run apart)
    python3 -I mutants/run.py --list                the mutants, one a line, and nothing run

Run from anywhere; paths are taken from this file. Each mutant named in `mutants.json` (next to this file) is one
text replaced in one file of `src/`: a check of a `decide` removed, one field of an event given a wrong value, or an
accepted act made to record nothing. For each one chosen, the package's `src/`, `test/`, `package.json`,
`tsconfig*.json` and `vitest.config.ts` are copied to `.mutants/<key>/` (inside the package, so `@inventory/*`,
`@alchemy.run/domain` and `effect` resolve as they do for the package), the change is made there, and vitest runs the
mutant's proof file and both story files in that copy with its JSON reporter. The class:

    rule     the proof names a rule as violated, with the state and the command that break it: the rule notices
    proof    the proof failed, and no rule is shown broken: a number the test states moved (its paths, "some state
             lets it record"), or the prover gave up on a rule or could not read the changed code
    story    only a story failed: the change is seen, but no rule says it is wrong
    neither  nothing failed: the change goes unnoticed
    timeout  nothing failed but a test that ran out of time: nothing is known, and nothing held it
    error    a file did not load, or the run gave no result

A test that ran out of time has noticed nothing, whichever file it is in: it is counted apart and never makes a class.

The run exits 1 when a mutant is held by neither, when all that is known of one is a timeout, when one the trial found
held by a rule is no longer (`weaker`: no rule is named now, or a rule the trial saw break, kept in `trialRules`, is
not among the ones named), when one the trial found held by a story has no story failing, when a mutant does not apply
(its old text is not found exactly once after its anchors and before its end), or when a run gives no result. A mutant
held by a rule where the trial had a story is an improvement, said and not a failure. Before the mutants, the copy is
run once unchanged (`baseline`): when that fails or times out, every mutant would look held, so the run stops with
exit 2. Results go to `.mutants/results.tsv`.

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
    "group-nothing",             # nothing, story: its stories, and the proof's "some state lets it record" (class proof)
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
# A rule's name as a report prints it: `OutcomesAddUpToTheRows`, or `Row.TheSizeOfByIsTrue` in a decision's report.
RULE_NAME = re.compile(r"^((?:[A-Z][A-Za-z0-9]*\.)?[A-Z][A-Za-z0-9]*)(?=$|:| \()")
STANDING = re.compile(r"^(?:Violated|Unconfirmed|violated|not proved|proved for short lists only|read wrongly|not read|not decided)\s+")
BROKEN = re.compile(r"\bviolated\b")
TIMED_OUT = "timed out"


def rule_name(text):
    """The rule a line names, without how it stands and without its commands; None when the line names no rule."""
    m = RULE_NAME.match(STANDING.sub("", text.strip()))
    return m.group(1) if m else None


def why_proof(messages):
    """What the proof said broke, in two lists: the rules not proved, and what failed that is no rule."""
    text = "\n".join(messages)
    # The report printed beside a failure (`whatBroke` in test/proving.ts): a line "✗ <rule>" for each rule not
    # proved, and under it "    ✗ <command>: <how it stands>" for the import's rules. A "✗" line that names no rule
    # ("✗ DecideGroup is never accepted", "✗ The real code does something else") is the report's own, and no rule.
    found, current, under = [], None, []
    for line in text.splitlines():
        top = re.match(r"^✗ (.+?)(?:: expected .*)?$", line)
        sub = re.match(r"^\s+✗ (\S+?):? (violated|not proved|unconfirmed|read wrongly|not read|not decided)\b", line)
        if top:
            if current is not None:
                found.append(current + (f" ({', '.join(under)})" if under else ""))
            current, under = top.group(1), []
        elif sub and current is not None:
            under.append(f"{sub.group(1)} {sub.group(2)}")
        elif current is not None and not line.startswith(" "):
            found.append(current + (f" ({', '.join(under)})" if under else ""))
            current, under = None, []
    if current is not None:
        found.append(current + (f" ({', '.join(under)})" if under else ""))
    found = [r for r in dict.fromkeys(found) if not r.startswith("Import folds")]
    # Only "violated" is a rule noticing the change: the solver found a state and a command, and the real code broke
    # the rule on them. Every other standing is the prover not finishing ("not decided": its time or work limit, or
    # more paths than it takes), not reading the changed code ("not read", "read wrongly"), or not confirming what it
    # found ("not proved"), and a rule the report marks only because its command may leave the schema has no standing
    # at all. None of those shows that a rule forbids the change, so each is the proof's own and no rule's.
    rules = [r for r in found if rule_name(r) and BROKEN.search(r)]
    other = [r for r in found if r not in rules]
    if not found:
        for standing, name in RULE_LINE.findall(text):
            item = f"{standing} {name.strip()}"
            if standing == "violated" and item not in rules:
                rules.append(item)
            elif standing != "violated" and item not in other:
                other.append(item)
    if rules or other:
        return rules, other
    m = EXPECTED.search(text)
    if m:
        return [], [f"expected {m.group(2).strip()}, got {m.group(1).strip()}"]
    first = next((line for line in text.splitlines() if line.strip()), "no message")
    return [], [short(first, 140)]


def read_result(path, proof):
    """From vitest's JSON report, what failed and how: a test that ran out of time is kept apart from one that failed."""
    with open(path) as f:
        report = json.load(f)
    read = dict(rules=[], other=[], stories=[], timeouts=[], unloaded=[], missing=[])
    seen = set()
    for result in report.get("testResults", []):
        name = result.get("name", "")
        seen.add(file_of(name))
        failed = [a for a in result.get("assertionResults", []) if a.get("status") == "failed"]
        is_proof = name.endswith(proof)
        label = file_of(name).replace(".story", "")
        if result.get("status") == "failed" and not failed:
            read["unloaded"].append(f"{label}: did not load: {short(result.get('message', ''), 80)}")
            continue
        late = [a for a in failed if TIMED_OUT in " ".join(a.get("failureMessages", []))]
        real = [a for a in failed if a not in late]
        read["timeouts"] += [f"{label}: {a.get('title', a.get('fullName', ''))}" for a in late]
        if is_proof and real:
            rules, other = why_proof([m for a in real for m in a.get("failureMessages", [])])
            read["rules"] += rules
            read["other"] += other
        elif not is_proof:
            read["stories"] += [f"{label}: {a.get('title', a.get('fullName', ''))}" for a in real]
    expected = {file_of(proof)} | {file_of(s) for s in STORIES}
    read["missing"] = sorted(expected - seen)
    return read


def class_of(read):
    """The class of one run: the strongest thing that noticed the change. A timeout notices nothing."""
    if read["rules"]:
        return "rule"
    if read["other"]:
        return "proof"
    if read["stories"]:
        return "story"
    if read["timeouts"]:
        return "timeout"
    return "neither"


def run_copy(key, mutant, proof, keep, nice, timeout):
    """Copies the package, makes the change (none for the baseline), runs vitest. Returns a result record."""
    dest = os.path.join(WORK, key)
    started = time.time()
    record = dict(key=key, cls="error", seconds=0.0, why=[], rules=[], stories=[], note="")
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
        read = read_result(out, proof)
        record["why"], record["stories"] = read["rules"] + read["other"], read["stories"]
        record["rules"] = sorted({name for name in map(rule_name, read["rules"]) if name})
        if read["missing"]:
            record["note"] = "files that did not run: " + ", ".join(read["missing"])
            return record
        if read["unloaded"]:
            record["note"] = "; ".join(read["unloaded"])
            return record
        if read["timeouts"]:
            record["note"] = "ran out of time, and counted as nothing: " + " | ".join(read["timeouts"])
        record["cls"] = class_of(read)
        return record
    finally:
        record["seconds"] = round(time.time() - started, 1)
        if not keep and record["cls"] not in ("error",):
            shutil.rmtree(dest, ignore_errors=True)


def weaker_rules(mutant, record):
    """The rules the trial saw this mutant break that the proof no longer names."""
    trial = sorted({name for name in map(rule_name, mutant["trialRules"]) if name})
    return [name for name in trial if name not in record["rules"]]


def verdict(mutant, record):
    cls = record["cls"]
    if cls in ("notapplied", "error", "neither", "timeout"):
        return cls
    if mutant["expect"] == "rule":
        return "same" if cls == "rule" and not weaker_rules(mutant, record) else "weaker"
    if cls == "rule":
        return "improvement"
    # The trial had a story only: a story must still fail. The proof's own numbers moving is not the story noticing.
    return "same" if record["stories"] else "weaker"


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
    parser.add_argument("--except", dest="left_out", default="", help="keys to leave out, comma-separated")
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
    left_out = [k.strip() for k in opts.left_out.split(",") if k.strip()]
    unknown = [k for k in left_out if k not in by_key]
    if unknown:
        print("unknown keys to leave out: " + ", ".join(unknown), file=sys.stderr)
        return 1
    if left_out:
        chosen = [m for m in chosen if m["key"] not in left_out]
        print("left out, to be run apart: " + ", ".join(left_out), flush=True)
    if not os.path.exists(VITEST):
        print(f"vitest not found at {VITEST}: run bun install first", file=sys.stderr)
        return 1

    # Every chosen mutant must apply to the package's own text before anything runs, and one kept as held by a rule
    # must record each of its rules as violated: any other standing is the prover giving up, which holds nothing.
    problems = []
    for m in chosen:
        with open(os.path.join(PKG, m["file"])) as f:
            _, reason = apply(f.read(), m)
        if not reason and m["expect"] == "rule":
            other = [t for t in m["trialRules"] if STANDING.match(t) and not t.startswith("Violated ")]
            if other:
                reason = "kept as held by a rule on a standing that is not a rule violated: " + "; ".join(other)
        if reason:
            problems.append((m, reason))
    for m, reason in problems:
        print(f"NOT RUN {m['key']}: {reason}")
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
        r["verdict"] = verdict(m, r)
        with lock:
            results[m["key"]] = r
            said = "; ".join(r["why"]) if r["cls"] in ("rule", "proof") else " | ".join(r["stories"])
            print(f"{m['key']:36} {r['cls']:8} {r['seconds']:7.1f}s  {r['verdict']:11} {short(said or r['note'], 120)}", flush=True)
        return r

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, opts.jobs)) as pool:
        list(pool.map(one, ready))

    for m, reason in problems:
        results[m["key"]] = dict(key=m["key"], cls="notapplied", seconds=0.0, why=[], rules=[], stories=[], note=reason, verdict="notapplied")

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
    print("class:   " + ", ".join(f"{c} {classes[c]}" for c in ("rule", "proof", "story", "neither", "timeout", "notapplied", "error") if classes[c]))
    print("trial:   " + ", ".join(f"{c} {trial[c]}" for c in ("rule", "story")))
    for target in sorted({m["target"] for m in chosen}):
        ms = [m for m in chosen if m["target"] == target]
        cs = collections.Counter(results[m["key"]]["cls"] for m in ms)
        secs = sum(results[m["key"]]["seconds"] for m in ms)
        print(f"  {target:12} {len(ms):3} mutants  rule {cs['rule']:3}  proof {cs['proof']:3}  story {cs['story']:3}  "
              f"neither {cs['neither']}  timeout {cs['timeout']}  "
              f"test time {secs:8.1f} s  longest {max(results[m['key']]['seconds'] for m in ms):7.1f} s")
    print(f"wall {time.time() - wall:.0f} s; load before {load_before}, after {load_avg()}")
    improved = [m["key"] for m in chosen if results[m["key"]]["verdict"] == "improvement"]
    if improved:
        print("held by a rule where the trial had a story only (improvement): " + ", ".join(improved))
    failing = [m for m in chosen if results[m["key"]]["verdict"] in ("neither", "weaker", "timeout", "notapplied", "error")]
    for m in failing:
        r = results[m["key"]]
        gone = weaker_rules(m, r)
        weaker = (
            "the trial saw a story fail, and none does now" if m["expect"] == "story"
            else "a rule got weaker: no rule is named now, where the trial saw " + ("; ".join(m["trialRules"]) or "-") if r["cls"] != "rule"
            else "a rule got weaker: no longer named, " + ", ".join(gone)
        )
        what = {"neither": "held by neither", "weaker": weaker, "timeout": "only ran out of time: nothing held it",
                "notapplied": "does not apply", "error": "no result"}[r["verdict"]]
        print(f"FAIL {m['key']}: {what}. Change in {m['file']}: {m['old']!r} -> {m['new']!r}. "
              f"Ran {m['proof']} and the stories: {short('; '.join(r['why']) + ' ' + ' | '.join(r['stories']) + ' ' + r['note'], 200)}")
    return 1 if failing else 0


if __name__ == "__main__":
    sys.exit(main())
