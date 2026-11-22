#!/usr/bin/env python3
"""Moves the Alchemy packages this repository keeps as files to another commit of the library, and checks the pin.

    bun run alchemy:repin -- <commit>     move the pin to that commit of the library's main ("main" is its head)
    bun run alchemy:check                 check what is here; changes nothing and needs no network
    bun run alchemy:check -- --install    the same, then an install that is refused the library's registry

The library publishes a build of every commit of its `main` to https://pkg.alchemy.run and deletes it a week after
`main` has moved on. In such a build a package names its sibling packages by their address on that registry, so an
install would need the registry for as long as the lockfile lives. A move downloads the roots below and every
package they need, and checks each download against the SHA-256 its address states. A package that names a sibling
is written back out with a single edit: in `package.json`, a sibling's address becomes `<its version>-<commit>`, a
version no registry has, and one key, "//", is added that says so. A package that names no sibling is kept as the
registry's own bytes. The root `package.json` redirects every one of those names to its file here (`overrides`), so a
dependency that is not redirected fails the install instead of fetching something else.

A move, in order, stopping at the first step that fails:

1. replaces the files and `sources.json`, and says which packages are new or gone since the last pin;
2. rewrites the `overrides` in the root `package.json` and the version every workspace asks for;
3. runs `bun install`;
4. writes each file's hash into `bun.lock` (bun keeps the hash it has for a file whose bytes changed);
5. rewrites the part of the README that names the commit, the packages and their sizes;
6. checks all of that, as `alchemy:check` does;
7. installs a copy of the working tree, with an empty cache, through a proxy that refuses the registry;
8. runs `bun run check:full -- --force`: the library's `main` breaks code between releases, so every type-check,
   test and proof is run again and nothing is replayed from the cache.

A step from 1 to 7 that fails puts every file it changed back as it was. Step 8 failing leaves the pin moved, since
what it found is the library's change to answer in the code, and says which files to restore to go back instead.
`--no-full-check` leaves step 8 out. Nothing is committed: read the difference, then commit it.
"""
import base64, datetime, gzip, hashlib, io, json, os, re, select, shutil, socket, subprocess, sys, tarfile, tempfile
import threading, urllib.request
from pathlib import Path

REGISTRY = "https://pkg.alchemy.run"
REGISTRY_HOST = "pkg.alchemy.run"
LIBRARY = "https://github.com/alchemy-run/alchemy"
ROOTS = ["alchemy", "@alchemy.run/domain", "@alchemy.run/cloudflare", "@alchemy.run/github"]
ADDRESS = re.compile(r"^https://pkg\.alchemy\.run/((?:@[^/]+/)?[^/]+)/-/([0-9a-f]{64})\.tgz$")
PINNED_SPEC = re.compile(r"^.+-[0-9a-f]{7}$")
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCES = HERE / "sources.json"
README = HERE / "README.md"
LOCK = ROOT / "bun.lock"
SECTION = re.compile(r"(<!-- pin:start[^\n]*-->\n).*?(<!-- pin:end -->)", re.DOTALL)
DEPENDENCY_KEYS = ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies")


def say(line: str) -> None:
    print(line, file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------------------------------------------
# 1. The files
# ---------------------------------------------------------------------------------------------------------------


class KeepRedirect(urllib.request.HTTPRedirectHandler):
    """The registry answers a commit's address with a redirect to the tarball: the redirect is what names the hash."""

    def redirect_request(self, *args, **kwargs):
        return None


def tarball_address(name: str, commit: str) -> str:
    opener = urllib.request.build_opener(KeepRedirect)
    try:
        opener.open(f"{REGISTRY}/{name}/{commit}", timeout=60)
    except urllib.error.HTTPError as answer:
        if answer.code in (301, 302, 307, 308):
            return REGISTRY + answer.headers["location"]
        if answer.code == 404:
            raise SystemExit(
                f"{name}: the registry has no build of commit {commit}. It builds commits of main only, and deletes "
                f"a build a week after main has moved on."
            )
        raise
    raise SystemExit(f"{name}: the registry did not redirect to a tarball")


def download(address: str) -> bytes:
    with urllib.request.urlopen(address, timeout=300) as answer:
        data = answer.read()
    stated = ADDRESS.match(address)
    if stated is None or hashlib.sha256(data).hexdigest() != stated.group(2):
        raise SystemExit(f"{address}: the bytes are not the ones its address names")
    return data


def members(data: bytes):
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        return [(m, tar.extractfile(m).read() if m.isfile() else None) for m in tar.getmembers()]


def needs(manifest: dict) -> dict:
    """The siblings an install fetches: its dependencies, and its peers that are not optional."""
    optional = {name for name, meta in (manifest.get("peerDependenciesMeta") or {}).items() if meta.get("optional")}
    found = dict(manifest.get("dependencies") or {})
    found.update({n: s for n, s in (manifest.get("peerDependencies") or {}).items() if n not in optional})
    return {name: spec for name, spec in found.items() if ADDRESS.match(spec)}


def head_of_main() -> str:
    answer = subprocess.run(
        ["git", "ls-remote", LIBRARY, "refs/heads/main"], capture_output=True, text=True, check=True
    ).stdout.split()
    if len(answer) == 0:
        raise SystemExit(f"{LIBRARY}: no main branch was listed")
    return answer[0]


def fetch(commit: str) -> dict:
    """Step 1: replaces the files and `sources.json` with the build of one commit, and returns the new `sources.json`."""
    fetched = {}
    waiting = [(name, None) for name in ROOTS]
    while waiting:
        name, address = waiting.pop()
        if name in fetched:
            if address is not None and fetched[name]["address"] != address:
                raise SystemExit(f"{name}: two packages name two builds of it")
            continue
        address = address or tarball_address(name, commit)
        data = download(address)
        files = members(data)
        manifest = json.loads(next(body for m, body in files if m.name == "package/package.json"))
        fetched[name] = {"address": address, "data": data, "files": files, "manifest": manifest}
        waiting.extend(needs(manifest).items())

    before = {source["package"] for source in json.loads(SOURCES.read_text())["packages"]} if SOURCES.exists() else set()
    alchemy_version = fetched["alchemy"]["manifest"]["version"]
    sources = []
    kept_files = {}
    for name in sorted(fetched):
        entry = fetched[name]
        manifest = entry["manifest"]
        raw = next(body for m, body in entry["files"] if m.name == "package/package.json").decode()
        rewritten = 0
        for key in DEPENDENCY_KEYS:
            for sibling, spec in (manifest.get(key) or {}).items():
                if ADDRESS.match(spec) is None:
                    continue
                # A sibling that was not fetched is an optional peer: it states the library's own version.
                version = fetched[sibling]["manifest"]["version"] if sibling in fetched else alchemy_version
                changed = raw.replace(json.dumps(spec), json.dumps(f"{version}-{commit}"))
                rewritten += changed != raw
                raw = changed
        for key in DEPENDENCY_KEYS:
            for sibling, spec in (json.loads(raw).get(key) or {}).items():
                if REGISTRY_HOST in str(spec):
                    raise SystemExit(f"{name}: its package.json still names {sibling} by the registry's address")
        if rewritten == 0:
            # It names no sibling: the file kept is the registry's, byte for byte.
            kept = entry["data"]
        else:
            notice = (
                f"Changed from the build of commit {commit} that {REGISTRY} served: the addresses of sibling "
                f"packages are replaced by '<version>-{commit}', so an install needs no registry for them. Nothing "
                f"else differs."
            )
            end = raw.rstrip().rfind("}")
            raw = raw[:end].rstrip() + f',\n  "//": {json.dumps(notice)}\n}}\n'
            json.loads(raw)
            body = raw.encode()
            packed = io.BytesIO()
            # No time, no name and no extended headers in the archive: the same input always gives the same bytes.
            with gzip.GzipFile(fileobj=packed, mode="wb", mtime=0, filename="") as zipped:
                with tarfile.open(fileobj=zipped, mode="w", format=tarfile.PAX_FORMAT) as tar:
                    for member, content in entry["files"]:
                        if member.name == "package/package.json":
                            content = body
                            member.size = len(body)
                        member.pax_headers = {}
                        tar.addfile(member, io.BytesIO(content) if content is not None else None)
            kept = packed.getvalue()
        file = f"{name.lstrip('@').replace('/', '-')}-{commit}.tgz"
        kept_files[file] = kept
        sources.append(
            {
                "package": name,
                "version": manifest["version"],
                "license": manifest.get("license"),
                "file": file,
                "bytes": len(kept),
                "sha256": hashlib.sha256(kept).hexdigest(),
                "registryAddress": entry["address"],
                "registryBytes": len(entry["data"]),
                "addressesRewritten": rewritten,
            }
        )
    pin = {"commit": commit, "pinnedOn": datetime.date.today().isoformat(), "packages": sources}
    # Every package was read and rewritten without a refusal: only now do the files here change.
    for old in HERE.glob("*.tgz"):
        old.unlink()
    for file, kept in kept_files.items():
        (HERE / file).write_bytes(kept)
    SOURCES.write_text(json.dumps(pin, indent=2) + "\n")
    now = {source["package"] for source in sources}
    for name in sorted(now - before):
        say(f"  new since the last pin: {name}")
    for name in sorted(before - now):
        say(f"  gone since the last pin: {name}")
    return pin


# ---------------------------------------------------------------------------------------------------------------
# 2. What asks for them
# ---------------------------------------------------------------------------------------------------------------


def expected_overrides(pin: dict) -> dict:
    return {source["package"]: f"file:vendor/alchemy/{source['file']}" for source in pin["packages"]}


def expected_spec(pin: dict) -> dict:
    return {source["package"]: f"{source['version']}-{pin['commit']}" for source in pin["packages"]}


def workspace_manifests() -> list:
    listed = subprocess.run(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "package.json", "*/package.json"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split("\0")
    return [ROOT / path for path in listed if path != "" and path != "package.json" and (ROOT / path).exists()]


def wire(pin: dict) -> None:
    """Step 2: the root's `overrides` name the new files, and every workspace asks for the new version."""
    root_file = ROOT / "package.json"
    raw = root_file.read_text()
    manifest = json.loads(raw)
    others = {
        name: spec
        for name, spec in (manifest.get("overrides") or {}).items()
        if not str(spec).startswith("file:vendor/alchemy/")
    }
    overrides = dict(sorted({**others, **expected_overrides(pin)}.items()))
    block = '"overrides": ' + json.dumps(overrides, indent=2).replace("\n", "\n  ")
    replaced, count = re.subn(r'"overrides": \{.*?\n  \}', lambda _: block, raw, count=1, flags=re.DOTALL)
    if count != 1:
        raise SystemExit("package.json: no \"overrides\" block to replace")
    json.loads(replaced)
    root_file.write_text(replaced)

    wanted = expected_spec(pin)
    for file in workspace_manifests():
        raw = file.read_text()
        manifest = json.loads(raw)
        changed = raw
        for key in DEPENDENCY_KEYS:
            for name, spec in (manifest.get(key) or {}).items():
                if name in wanted and spec != wanted[name] and PINNED_SPEC.match(spec):
                    changed = changed.replace(f'"{name}": "{spec}"', f'"{name}": "{wanted[name]}"')
        if changed != raw:
            json.loads(changed)
            file.write_text(changed)
            say(f"  {file.relative_to(ROOT)}: asks for the new build")


# ---------------------------------------------------------------------------------------------------------------
# 4. The lockfile's hashes
# ---------------------------------------------------------------------------------------------------------------


def integrity(file: Path) -> str:
    return "sha512-" + base64.b64encode(hashlib.sha512(file.read_bytes()).digest()).decode()


def lock_entry(source: dict) -> re.Pattern:
    name, file = re.escape(source["package"]), re.escape(source["file"])
    return re.compile(r'(\["%s@vendor/alchemy/%s", \{.*?\}, ")(sha512-[^"]+)("\])' % (name, file))


def write_lock_hashes(pin: dict) -> None:
    """Step 4: `bun install` keeps the hash it already has for a local file, even when the file's bytes changed."""
    lock = LOCK.read_text()
    for source in pin["packages"]:
        actual = integrity(HERE / source["file"])
        lock, count = lock_entry(source).subn(lambda found: found.group(1) + actual + found.group(3), lock)
        if count == 0:
            say(f"  {source['package']}: no workspace asks for it, so it is not in bun.lock")
    LOCK.write_text(lock)


# ---------------------------------------------------------------------------------------------------------------
# 5. The README's part that names the pin
# ---------------------------------------------------------------------------------------------------------------


def size(count: int) -> str:
    return f"{count / 1e6:.1f} MB" if count >= 1e6 else f"{count / 1e3:.1f} kB"


def section(pin: dict) -> str:
    packages = pin["packages"]
    lines = [
        f"The commit is `{pin['commit']}` of the library's `main`, pinned on {pin['pinnedOn']}: {len(packages)} "
        f"packages, {size(sum(p['bytes'] for p in packages))} as files.",
        "",
        "| Package | Version | Licence | Size | Sibling addresses replaced |",
        "| --- | --- | --- | ---: | ---: |",
    ]
    for p in packages:
        lines.append(
            f"| `{p['package']}` | {p['version']} | {p['license']} | {size(p['bytes'])} | {p['addressesRewritten']} |"
        )
    return "\n".join(lines) + "\n"


def write_readme(pin: dict) -> None:
    text = README.read_text()
    replaced, count = SECTION.subn(lambda found: found.group(1) + section(pin) + found.group(2), text)
    if count != 1:
        raise SystemExit("vendor/alchemy/README.md: the part between pin:start and pin:end is missing")
    README.write_text(replaced)


# ---------------------------------------------------------------------------------------------------------------
# 6. The check
# ---------------------------------------------------------------------------------------------------------------


def problems(pin: dict) -> list:
    """Everything that would make an install fetch another build, refuse the lockfile, or leave a page untrue."""
    found = []
    names = {source["package"] for source in pin["packages"]}
    files = {source["file"] for source in pin["packages"]}
    on_disk = {file.name for file in HERE.glob("*.tgz")}
    for file in sorted(on_disk - files):
        found.append(f"vendor/alchemy/{file}: a file sources.json does not list")
    for source in pin["packages"]:
        file = HERE / source["file"]
        if not file.exists():
            found.append(f"{source['file']}: listed in sources.json and not here")
        elif hashlib.sha256(file.read_bytes()).hexdigest() != source["sha256"]:
            found.append(f"{source['file']}: its bytes are not the ones sources.json names")

    manifest = json.loads((ROOT / "package.json").read_text())
    overrides = manifest.get("overrides") or {}
    for name, spec in expected_overrides(pin).items():
        if overrides.get(name) != spec:
            found.append(f"package.json: overrides[{name}] is {overrides.get(name)!r}, not {spec!r}")
    for name, spec in overrides.items():
        if str(spec).startswith("file:vendor/alchemy/") and name not in names:
            found.append(f"package.json: overrides[{name}] names a file of a package that is not pinned")

    wanted = expected_spec(pin)
    for file in workspace_manifests():
        workspace = json.loads(file.read_text())
        for key in DEPENDENCY_KEYS:
            for name, spec in (workspace.get(key) or {}).items():
                if name in wanted and spec != wanted[name]:
                    found.append(f"{file.relative_to(ROOT)}: asks for {name} {spec}, not {wanted[name]}")

    lock = LOCK.read_text()
    if REGISTRY_HOST in lock:
        found.append(f"bun.lock: names {REGISTRY_HOST}, so an install would fetch from the registry")
    for named in sorted(set(re.findall(r"vendor/alchemy/([^\"]+\.tgz)", lock)) - files):
        found.append(f"bun.lock: names vendor/alchemy/{named}, which is not the pinned build")
    for source in pin["packages"]:
        if not (HERE / source["file"]).exists():
            continue
        actual = integrity(HERE / source["file"])
        for entry in lock_entry(source).finditer(lock):
            if entry.group(2) != actual:
                found.append(f"bun.lock: the hash of {source['package']} is not its file's")

    text = README.read_text()
    written = SECTION.search(text)
    if written is None:
        found.append("vendor/alchemy/README.md: the part between pin:start and pin:end is missing")
    elif text[written.end(1) : written.start(2)] != section(pin):
        found.append("vendor/alchemy/README.md: the part that names the pin is not what sources.json says")
    return found


def check(pin: dict) -> None:
    found = problems(pin)
    for line in found:
        say(f"  wrong: {line}")
    if len(found) > 0:
        raise SystemExit(f"The pin is not consistent: {len(found)} thing(s) wrong.")
    in_lock = sum(1 for source in pin["packages"] if lock_entry(source).search(LOCK.read_text()) is not None)
    say(
        f"  {len(pin['packages'])} files of commit {pin['commit']} match sources.json; the overrides, the workspaces "
        f"and the README agree; bun.lock names {in_lock} of them by its file's hash and nothing by {REGISTRY_HOST}."
    )


# ---------------------------------------------------------------------------------------------------------------
# 7. An install that is refused the registry
# ---------------------------------------------------------------------------------------------------------------


class RefusingProxy:
    """A forward proxy for one install: it tunnels every host but the registry, and remembers every host asked for."""

    def __init__(self) -> None:
        self.asked = []
        self.server = socket.create_server(("127.0.0.1", 0))
        self.port = self.server.getsockname()[1]
        threading.Thread(target=self.accept, daemon=True).start()

    def accept(self) -> None:
        while True:
            try:
                client, _ = self.server.accept()
            except OSError:
                return
            threading.Thread(target=self.serve, args=(client,), daemon=True).start()

    def serve(self, client: socket.socket) -> None:
        upstream = None
        try:
            head = b""
            while b"\r\n\r\n" not in head:
                piece = client.recv(65536)
                if piece == b"":
                    return
                head += piece
            words = head.split(b"\r\n", 1)[0].decode("latin-1").split(" ")
            target = words[1] if len(words) > 1 else ""
            if words[0] != "CONNECT":
                self.asked.append(("refused, plain HTTP", target))
                client.sendall(b"HTTP/1.1 403 Forbidden\r\ncontent-length: 0\r\n\r\n")
                return
            host, _, port = target.rpartition(":")
            if host == REGISTRY_HOST or host.endswith("." + REGISTRY_HOST):
                self.asked.append(("refused", host))
                client.sendall(b"HTTP/1.1 403 Forbidden\r\ncontent-length: 0\r\n\r\n")
                return
            self.asked.append(("reached", host))
            upstream = socket.create_connection((host, int(port)), timeout=60)
            client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            rest = head.split(b"\r\n\r\n", 1)[1]
            if rest != b"":
                upstream.sendall(rest)
            other = {client: upstream, upstream: client}
            while True:
                ready, _, _ = select.select([client, upstream], [], [], 300)
                if len(ready) == 0:
                    return
                for side in ready:
                    data = side.recv(65536)
                    if data == b"":
                        return
                    other[side].sendall(data)
        except (OSError, ValueError):
            return
        finally:
            client.close()
            if upstream is not None:
                upstream.close()

    def close(self) -> None:
        self.server.close()


def install_without_registry(pin: dict) -> None:
    """Step 7: what a fresh clone gets, with nothing cached and the registry out of reach."""
    listed = subprocess.run(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split("\0")
    work = Path(tempfile.mkdtemp(prefix="alchemy-install-"))
    proxy = RefusingProxy()
    try:
        tree = work / "tree"
        for path in listed:
            source = ROOT / path
            if path == "" or not (source.is_file() or source.is_symlink()):
                continue
            target = tree / path
            target.parent.mkdir(parents=True, exist_ok=True)
            if source.is_symlink():
                os.symlink(os.readlink(source), target)
            else:
                shutil.copy2(source, target)
        address = f"http://127.0.0.1:{proxy.port}"
        environment = {key: value for key, value in os.environ.items() if key.lower() not in ("no_proxy", "all_proxy")}
        for key in ("HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy"):
            environment[key] = address
        environment["BUN_INSTALL_CACHE_DIR"] = str(work / "cache")
        ran = subprocess.run(["bun", "install", "--frozen-lockfile"], cwd=tree, env=environment)
        counts = {}
        for verdict, host in proxy.asked:
            counts[(verdict, host)] = counts.get((verdict, host), 0) + 1
        for (verdict, host), count in sorted(counts.items()):
            say(f"  {verdict}: {host} ({count})")
        wrong = []
        if ran.returncode != 0:
            wrong.append(f"bun install --frozen-lockfile ended with {ran.returncode}")
        if any(verdict == "refused" for verdict, _ in proxy.asked):
            wrong.append(f"the install asked for {REGISTRY_HOST}")
        if not any(verdict == "reached" for verdict, _ in proxy.asked):
            wrong.append("the install went through the proxy for nothing, so the proxy proved nothing")
        if (tree / "bun.lock").read_bytes() != LOCK.read_bytes():
            wrong.append("the install changed bun.lock")
        installed = 0
        for source in pin["packages"]:
            manifest_file = tree / "node_modules" / source["package"] / "package.json"
            if lock_entry(source).search(LOCK.read_text()) is None:
                continue
            if not manifest_file.exists():
                wrong.append(f"{source['package']}: in bun.lock and not installed")
                continue
            manifest = json.loads(manifest_file.read_text())
            notice = manifest.get("//", "")
            if manifest.get("version") != source["version"]:
                wrong.append(f"{source['package']}: installed {manifest.get('version')}, not {source['version']}")
            elif source["addressesRewritten"] > 0 and f"commit {pin['commit']}" not in notice:
                wrong.append(f"{source['package']}: what is installed is not the file kept here")
            else:
                installed += 1
        for line in wrong:
            say(f"  wrong: {line}")
        if len(wrong) > 0:
            raise SystemExit("The install without the registry failed.")
        say(f"  installed from an empty cache without {REGISTRY_HOST}: {installed} of the pinned packages, from their files.")
    finally:
        proxy.close()
        shutil.rmtree(work, ignore_errors=True)


# ---------------------------------------------------------------------------------------------------------------
# The commands
# ---------------------------------------------------------------------------------------------------------------


def run(command: list) -> None:
    if subprocess.run(command, cwd=ROOT).returncode != 0:
        raise SystemExit(f"`{' '.join(command)}` failed.")


def pin_files() -> list:
    """Every file a move may change: the kept files and their list, the page, the lockfile and the manifests."""
    return [ROOT / "package.json", LOCK, README, SOURCES, *sorted(HERE.glob("*.tgz")), *workspace_manifests()]


def changed_since(before: dict) -> list:
    now = {file: file.read_bytes() for file in pin_files()}
    return sorted(str(file.relative_to(ROOT)) for file in {*before, *now} if before.get(file) != now.get(file))


def put_back(before: dict) -> None:
    for file in HERE.glob("*.tgz"):
        if file not in before:
            file.unlink()
    for file, data in before.items():
        if not file.exists() or file.read_bytes() != data:
            file.write_bytes(data)


def repin(commit: str, full_check: bool) -> None:
    pinned = json.loads(SOURCES.read_text())["commit"] if SOURCES.exists() else None
    if commit == "main":
        commit = head_of_main()
    if re.fullmatch(r"[0-9a-f]{7,40}", commit) is None:
        raise SystemExit(f"{commit!r} is not a commit: give at least its first seven characters, or \"main\"")
    commit = commit[:7]
    if pinned is not None and pinned != commit:
        say(f"From {pinned} to {commit}. What the library changed: {LIBRARY}/compare/{pinned}...{commit}")
    before = {file: file.read_bytes() for file in pin_files()}
    installed = False
    try:
        say(f"1. The build of commit {commit}, checked against the hashes in its addresses")
        pin = fetch(commit)
        say("2. The overrides in the root package.json and the version each workspace asks for")
        wire(pin)
        say("3. bun install")
        installed = True
        run(["bun", "install"])
        say("4. The hash of each file, written into bun.lock")
        write_lock_hashes(pin)
        say("5. The README's part that names the pin")
        write_readme(pin)
        say("6. The check")
        check(pin)
        say("7. An install of a copy of this tree, with an empty cache, refused the registry")
        install_without_registry(pin)
    except BaseException as stopped:
        changed = changed_since(before)
        put_back(before)
        if not isinstance(stopped, SystemExit):
            say(f"{type(stopped).__name__}: {stopped}")
        elif stopped.code not in (None, 0):
            say(str(stopped.code))
        if len(changed) > 0:
            say(f"The move stopped, and the {len(changed)} file(s) it had changed are back as they were.")
        if installed:
            say("node_modules may hold the other build: putting it back with `bun install`.")
            if subprocess.run(["bun", "install"], cwd=ROOT).returncode != 0:
                say("`bun install` failed: run it again by hand.")
        raise SystemExit(1) from stopped
    if full_check:
        say("8. bun run check:full -- --force")
        if subprocess.run(["bun", "run", "check:full", "--", "--force"], cwd=ROOT).returncode != 0:
            changed = changed_since(before)
            tracked = [file for file in changed if not (file.startswith("vendor/alchemy/") and file.endswith(".tgz"))]
            raise SystemExit(
                f"The pin has moved to {commit} and passed its own checks; `bun run check:full -- --force` then "
                f"failed. That is the library's change to answer in the code. To go back instead: "
                f"`git checkout -- {' '.join(tracked)} vendor/alchemy && git clean -f -- vendor/alchemy && bun install`."
            )
    else:
        say("8. Left out (--no-full-check): run `bun run check:full -- --force` before committing")
    say("Nothing is committed. Read `git status` and `git diff`, then commit.")


def main(arguments: list) -> None:
    flags = {argument for argument in arguments if argument.startswith("--")}
    rest = [argument for argument in arguments if not argument.startswith("--")]
    unknown = flags - {"--check", "--install", "--no-full-check"}
    if len(unknown) > 0 or len(rest) > 1 or ("--check" in flags) == (len(rest) == 1):
        raise SystemExit(__doc__)
    if "--check" in flags:
        pin = json.loads(SOURCES.read_text())
        check(pin)
        if "--install" in flags:
            install_without_registry(pin)
    else:
        repin(rest[0], "--no-full-check" not in flags)


if __name__ == "__main__":
    main(sys.argv[1:])
