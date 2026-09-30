import copy
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from verify_upstream_import import ARCHIVES, validate_mapping, verify


class ImportVerificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest = {'commit': 'a' * 40, 'files': []}
        self.mapping = {'commit': 'a' * 40, 'entries': []}
        for source, data, mode in [('LICENSE', b'license\n', '100644'),
                                   ('NOTICE', b'notice\n', '100644'),
                                   ('README.md', b'original readme\n', '100644'),
                                   ('bin/run', b'\x00\xff\r\n', '100755')]:
            sha = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
            self.manifest['files'].append({'path': source, 'sha': sha, 'mode': mode})
            destination = ARCHIVES.get(source, source)
            self.mapping['entries'].append({'source': source, 'destination': destination, 'sha': sha, 'mode': mode})
            target = self.root / destination
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            target.chmod(0o755 if mode == '100755' else 0o644)

    def test_verifies_binary_executable_and_archived_governance(self):
        (self.root / 'README.md').write_text('local governance remains local')
        self.assertEqual(verify(self.root, self.mapping, self.manifest), 4)

    def test_rejects_missing_changed_blob_and_mode(self):
        for mutation in ('missing', 'blob', 'mode'):
            with self.subTest(mutation=mutation):
                target = self.root / 'NOTICE'
                target.write_bytes(b'notice\n')
                target.chmod(0o644)
                if mutation == 'missing':
                    target.unlink()
                elif mutation == 'blob':
                    target.write_bytes(b'tampered')
                else:
                    target.chmod(0o755)
                with self.assertRaises(ValueError):
                    verify(self.root, self.mapping, self.manifest)

    def test_rejects_incomplete_extra_tampered_and_redirected_mapping(self):
        for mutation in ('missing', 'extra', 'sha', 'destination', 'commit'):
            with self.subTest(mutation=mutation):
                mapping = copy.deepcopy(self.mapping)
                if mutation == 'missing':
                    mapping['entries'].pop()
                elif mutation == 'extra':
                    mapping['entries'].append(copy.deepcopy(mapping['entries'][0]))
                elif mutation == 'commit':
                    mapping['commit'] = 'b' * 40
                else:
                    mapping['entries'][0][mutation] = '../outside' if mutation == 'destination' else 'b' * 40
                with self.assertRaises(ValueError):
                    validate_mapping(mapping, self.manifest)

    def test_rejects_file_and_parent_symlinks(self):
        target = self.root / 'NOTICE'
        target.unlink()
        target.symlink_to(self.root / 'LICENSE')
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            verify(self.root, self.mapping, self.manifest)
        target.unlink()
        target.write_bytes(b'notice\n')
        directory = self.root / 'docs'
        directory.rename(self.root / 'real-docs')
        directory.symlink_to(self.root / 'real-docs', target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            verify(self.root, self.mapping, self.manifest)


if __name__ == '__main__':
    unittest.main()
