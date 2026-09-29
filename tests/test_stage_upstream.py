import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/stage_upstream.py"
spec = importlib.util.spec_from_file_location("stage_upstream", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.git("init", "-q")
        for name, data in {"LICENSE": b"fixture license\n", "NOTICE": b"fixture notice\n",
                           "image.bin": b"\0\xff\x80", "run.sh": b"exit 1\n"}.items():
            (self.repo / name).write_bytes(data)
        (self.repo / "run.sh").chmod(0o755)
        self.git("add", ".")
        self.git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture")
        self.manifest = {"commit": self.git("rev-parse", "HEAD").decode().strip(), "files": []}
        for raw in self.git("ls-tree", "-rz", "HEAD").split(b"\0"):
            if raw:
                meta, name = raw.split(b"\t")
                mode, _, sha = meta.decode().split()
                self.manifest["files"].append({"path": name.decode(), "mode": mode, "sha": sha})

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args], stderr=subprocess.PIPE)

    def test_exports_pinned_blobs_not_dirty_worktree(self):
        (self.repo / "LICENSE").write_text("uncommitted corruption")
        output = self.root / "snapshot"
        self.assertEqual(module.stage(self.repo, output, self.manifest), 4)
        self.assertEqual((output / "LICENSE").read_bytes(), b"fixture license\n")
        self.assertEqual((output / "image.bin").read_bytes(), b"\0\xff\x80")
        self.assertEqual((output / "run.sh").stat().st_mode & 0o777, 0o755)

    def test_refuses_existing_destination(self):
        with self.assertRaises(ValueError):
            module.stage(self.repo, self.repo, self.manifest)

    def test_concurrent_destination_is_not_replaced(self):
        output = self.root / "snapshot"
        original_mkdir = Path.mkdir
        competitor_inode = None

        def racing_mkdir(path, *args, **kwargs):
            nonlocal competitor_inode
            if path == output:
                original_mkdir(path)
                competitor_inode = path.stat().st_ino
            return original_mkdir(path, *args, **kwargs)

        with mock.patch.object(Path, "mkdir", racing_mkdir):
            with self.assertRaises(FileExistsError):
                module.stage(self.repo, output, self.manifest)
        self.assertTrue(output.is_dir())
        self.assertEqual(output.stat().st_ino, competitor_inode)
        self.assertEqual(list(output.iterdir()), [])
        self.assertEqual(list(self.root.glob(".upstream-stage-*")), [])

    def test_failed_publication_cleans_only_owned_directory(self):
        output = self.root / "snapshot"
        with mock.patch.object(Path, "rename", side_effect=OSError("fixture write failure")):
            with self.assertRaises(OSError):
                module.stage(self.repo, output, self.manifest)
        self.assertFalse(output.exists())
        self.assertEqual(list(self.root.glob(".upstream-stage-*")), [])

    def test_refuses_manifest_tampering(self):
        self.manifest["files"][0]["sha"] = "0" * 40
        with self.assertRaises(ValueError):
            module.stage(self.repo, self.root / "snapshot", self.manifest)
        self.assertFalse((self.root / "snapshot").exists())

    def test_refuses_unsafe_paths_and_modes(self):
        for path in ("../escape", "/absolute", ".git/config", "a/../escape", "a\\escape"):
            with self.subTest(path=path):
                bad = json.loads(json.dumps(self.manifest))
                bad["files"][0]["path"] = path
                with self.assertRaises(ValueError):
                    module.validate_manifest(bad)
        self.manifest["files"][0]["mode"] = "120000"
        with self.assertRaises(ValueError):
            module.validate_manifest(self.manifest)

    def test_refuses_missing_license(self):
        self.manifest["files"] = [x for x in self.manifest["files"] if x["path"] != "NOTICE"]
        with self.assertRaises(ValueError):
            module.validate_manifest(self.manifest)


if __name__ == "__main__":
    unittest.main()
