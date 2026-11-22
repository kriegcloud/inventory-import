#!/usr/bin/env python3
"""Fetches one commit's preview build of the Alchemy packages this repository uses and keeps it here as files.

    python3 vendor/alchemy/repin.py <commit>

The library publishes a build of every commit of its `main` to https://pkg.alchemy.run and deletes it a week after
`main` has moved on. In such a build a package names its sibling packages by their address on that registry, so an
install would need the registry for as long as the lockfile lives. This script downloads the roots below and every
package they need, and checks each download against the SHA-256 its address states. A package that names a sibling
is written back out with a single edit: in `package.json`, a sibling's address becomes `<its version>-<commit>`, a
version no registry has, and one key, "//", is added that says so. A package that names no sibling is kept as the
registry's own bytes. The root `package.json` redirects every one of those names to its file here (`overrides`), so a
dependency that is not redirected fails the install instead of fetching something else.

It replaces the files and `sources.json` (each file's package, licence, registry address and both hashes), says on
stderr which packages are new or gone since the last pin, and prints the `overrides` block that must replace the one
in the root `package.json`. It is run by hand, only to move the pin; nothing else runs it. The README beside it has
every step.
"""
import gzip, hashlib, io, json, re, sys, tarfile, urllib.request
from pathlib import Path

REGISTRY = "https://pkg.alchemy.run"
ROOTS = ["alchemy", "@alchemy.run/domain", "@alchemy.run/cloudflare", "@alchemy.run/github"]
ADDRESS = re.compile(r"^https://pkg\.alchemy\.run/((?:@[^/]+/)?[^/]+)/-/([0-9a-f]{64})\.tgz$")
HERE = Path(__file__).resolve().parent


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


def main(commit: str) -> None:
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

    sources_file = HERE / "sources.json"
    before = (
        {source["package"] for source in json.loads(sources_file.read_text())["packages"]}
        if sources_file.exists()
        else set()
    )
    for old in HERE.glob("*.tgz"):
        old.unlink()
    alchemy_version = fetched["alchemy"]["manifest"]["version"]
    sources = []
    for name in sorted(fetched):
        entry = fetched[name]
        manifest = entry["manifest"]
        raw = next(body for m, body in entry["files"] if m.name == "package/package.json").decode()
        rewritten = 0
        for key in ("dependencies", "peerDependencies", "optionalDependencies", "devDependencies"):
            for sibling, spec in (manifest.get(key) or {}).items():
                if ADDRESS.match(spec) is None:
                    continue
                # A sibling that was not fetched is an optional peer: it states the library's own version.
                version = fetched[sibling]["manifest"]["version"] if sibling in fetched else alchemy_version
                changed = raw.replace(json.dumps(spec), json.dumps(f"{version}-{commit}"))
                rewritten += changed != raw
                raw = changed
        if REGISTRY in raw:
            raise SystemExit(f"{name}: an address is left in its package.json")
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
        (HERE / file).write_bytes(kept)
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
    sources_file.write_text(json.dumps({"commit": commit, "packages": sources}, indent=2) + "\n")
    now = {source["package"] for source in sources}
    for name in sorted(now - before):
        print(f"new since the last pin: {name}", file=sys.stderr)
    for name in sorted(before - now):
        print(f"gone since the last pin: {name}", file=sys.stderr)
    overrides = {source["package"]: f"file:vendor/alchemy/{source['file']}" for source in sources}
    print(json.dumps({"overrides": overrides}, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
