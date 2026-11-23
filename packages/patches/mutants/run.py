#!/usr/bin/env python3
"""Runs the mutants of a patch that teaches the prover something: each one wrong reading, against the patch's test.

    python3 -I mutants/run.py            every mutant of every patch that has a `mutants.json` beside its test
    python3 -I mutants/run.py --only k   the ones named, by key
    python3 -I mutants/run.py --list     the mutants, one a line, and nothing run

A patch that adds a model of a library's function to the prover is right only if the model is the function. Its test
proves a small aggregate through it; a mutant is one text replaced in one file of the installed package, which makes
one model wrong (a guard that reads the tag alone, an answer of yes where the function says no). For each mutant the
installed package is copied to `.mutants/<key>/node_modules/<package>`, the change is made in the copy, the patch's
test folder is copied beside it, and vitest runs that copy. A mutant is **held** when a test fails there, and **let
through** when every test passes: the test cannot tell that wrong model from the right one.

Before the mutants the copy is run unchanged (`baseline`): when that fails every mutant would look held, so the run
stops with exit 2. The run exits 1 when a mutant is let through, when one does not apply (its old text is not found
exactly once), when the changed file is no longer JavaScript, or when a run gives no result.

Python 3, standard library only. Nothing installed is written: only the copies.
"""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)
ROOT = os.path.normpath(os.path.join(PKG, "..", ".."))
VITEST = os.path.join(ROOT, "node_modules", ".bin", "vitest")
WORK = os.path.join(PKG, ".mutants")
TIMEOUT = 300


def load():
    found = []
    for path in sorted(glob.glob(os.path.join(PKG, "test", "*", "*", "mutants.json"))):
        with open(path) as f:
            listed = json.load(f)
        folder = os.path.relpath(os.path.dirname(path), PKG)
        for mutant in listed["mutants"]:
            found.append({**mutant, "package": listed["package"], "folder": folder})
    return found


def copy(key, package, folder):
    """The installed package and the patch's test folder, under `.mutants/<key>/`."""
    work = os.path.join(WORK, key)
    shutil.rmtree(work, ignore_errors=True)
    shutil.copytree(
        os.path.join(ROOT, "node_modules", package),
        os.path.join(work, "node_modules", package),
        symlinks=True,
        ignore=shutil.ignore_patterns(".git"),
    )
    shutil.copytree(os.path.join(PKG, folder), os.path.join(work, folder), ignore=shutil.ignore_patterns("mutants.json"))
    return work


def run(work):
    """Vitest in the copy: (tests that failed, tests that passed), or None when it gave no result."""
    out = os.path.join(work, "result.json")
    try:
        subprocess.run(
            [VITEST, "run", "--root", work, "--config", os.path.join(PKG, "vitest.config.ts"),
             "--reporter", "json", "--outputFile", out],
            cwd=PKG, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return None
    if not os.path.exists(out):
        return None
    with open(out) as f:
        result = json.load(f)
    # A file that did not load ran no test: that is no result, not a mutant held.
    if any(not suite.get("assertionResults") for suite in result.get("testResults", [])):
        return None
    return result.get("numFailedTests", 0), result.get("numPassedTests", 0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--list", action="store_true")
    args = parser.parse_args()
    mutants = load()
    if args.only:
        wanted = args.only.split(",")
        unknown = [key for key in wanted if key not in [m["key"] for m in mutants]]
        if unknown:
            print(f"mutants: no mutant named {', '.join(unknown)}")
            return 1
        mutants = [m for m in mutants if m["key"] in wanted]
    if args.list:
        for m in mutants:
            print(f"{m['key']:28} {m['folder']}  {m['why']}")
        return 0
    if not mutants:
        print("mutants OK  no patch has mutants")
        return 0
    for package, folder in sorted({(m["package"], m["folder"]) for m in mutants}):
        result = run(copy("baseline", package, folder))
        if result is None or result[0] > 0 or result[1] == 0:
            print(f"mutants: {folder} does not pass in an unchanged copy ({result}): nothing can be said of its mutants")
            return 2
        print(f"baseline  {folder}: {result[1]} tests pass in an unchanged copy")
    bad = 0
    for m in mutants:
        work = copy(m["key"], m["package"], m["folder"])
        target = os.path.join(work, "node_modules", m["package"], m["file"])
        with open(target) as f:
            text = f.read()
        if text.count(m["old"]) != 1:
            print(f"NOT APPLIED   {m['key']}: its old text is in {m['file']} {text.count(m['old'])} times, not once")
            bad += 1
            continue
        with open(target, "w") as f:
            f.write(text.replace(m["old"], m["new"]))
        if subprocess.run(["node", "--check", target], capture_output=True).returncode != 0:
            print(f"NOT CODE      {m['key']}: {m['file']} no longer parses")
            bad += 1
            continue
        result = run(work)
        if result is None:
            print(f"NO RESULT     {m['key']}")
            bad += 1
        elif result[0] == 0:
            print(f"LET THROUGH   {m['key']}: {m['why']}")
            bad += 1
        else:
            print(f"held          {m['key']}: {result[0]} of {result[0] + result[1]} tests fail")
            shutil.rmtree(work, ignore_errors=True)
    shutil.rmtree(os.path.join(WORK, "baseline"), ignore_errors=True)
    held = len(mutants) - bad
    print(f"mutants {'OK ' if bad == 0 else 'failed:'} {held} of {len(mutants)} held by the patch's test")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
