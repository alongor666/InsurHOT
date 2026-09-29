#!/usr/bin/env python3
"""Export a verified, pinned Git snapshot without running upstream code or hooks."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tempfile

PIN = "589f79eff09470b31ba8a7f1d9eb62d36ff2be6c"
MANIFEST = Path(__file__).resolve().parents[1] / "vendor-manifests/aihot.json"


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], stderr=subprocess.PIPE)


def validate_manifest(manifest):
    if not re.fullmatch(r"[0-9a-f]{40}", manifest["commit"]):
        raise ValueError("Invalid commit")
    paths = set()
    for item in manifest["files"]:
        path = PurePosixPath(item["path"])
        if (not item["path"] or path.is_absolute() or ".." in path.parts
                or ".git" in path.parts or "\\" in item["path"]
                or str(path) != item["path"] or item["path"] in paths):
            raise ValueError("Unsafe or duplicate path")
        if item["mode"] not in ("100644", "100755"):
            raise ValueError("Symlinks and submodules are not supported")
        if not re.fullmatch(r"[0-9a-f]{40}", item["sha"]):
            raise ValueError("Invalid blob SHA")
        paths.add(item["path"])
    if not {"LICENSE", "NOTICE"}.issubset(paths):
        raise ValueError("Required license files missing")


def stage(repo, destination, manifest):
    validate_manifest(manifest)
    destination = Path(destination).absolute()
    if destination.exists() or destination.is_symlink():
        raise ValueError("Destination must not exist; no overwrites allowed")
    actual = []
    for raw in git(repo, "ls-tree", "-rz", manifest["commit"]).split(b"\0"):
        if not raw:
            continue
        meta, name = raw.split(b"\t", 1)
        mode, kind, sha = meta.decode().split()
        if kind != "blob":
            raise ValueError("Unsupported Git object")
        actual.append({"path": name.decode(), "mode": mode, "sha": sha})
    if actual != manifest["files"]:
        raise ValueError("Git tree differs from reviewed manifest")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".upstream-stage-", dir=destination.parent))
    try:
        for item in actual:
            data = git(repo, "cat-file", "blob", item["sha"])
            digest = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
            if digest != item["sha"]:
                raise ValueError("Blob integrity check failed")
            target = temporary / item["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            target.chmod(0o755 if item["mode"] == "100755" else 0o644)
        if destination.exists() or destination.is_symlink():
            raise ValueError("Destination appeared while staging")
        temporary.rename(destination)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    return len(actual)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="Local upstream Git repository")
    parser.add_argument("--destination", required=True, type=Path, help="New staging directory, not project root")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text())
    if manifest["repository"] != "KKKKhazix/AIHOT" or manifest["commit"] != PIN:
        raise ValueError("Manifest does not match the approved upstream baseline")
    count = stage(args.source, args.destination, manifest)
    print(f"Verified {count} files at {PIN}; staged only, no application code executed.")


if __name__ == "__main__":
    main()
