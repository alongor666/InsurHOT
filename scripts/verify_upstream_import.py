#!/usr/bin/env python3
"""Check every mapped upstream blob and executable mode without running application code."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat

from stage_upstream import MANIFEST, PIN, validate_manifest

ROOT = Path(__file__).resolve().parents[1]
ARCHIVES = {
    'README.md': 'docs/upstream/README.md',
    'AGENTS.md': 'docs/upstream/AGENTS.md',
    'CLAUDE.md': 'docs/upstream/CLAUDE.md',
    '.claude/launch.json': 'docs/upstream/claude-launch.json',
    '.github/workflows/check.yml': 'docs/upstream/workflows/check.yml',
}


def validate_mapping(mapping, manifest):
    validate_manifest(manifest)
    if mapping['commit'] != manifest['commit']:
        raise ValueError('Mapping commit differs from manifest')
    expected = [{'source': e['path'], 'destination': ARCHIVES.get(e['path'], e['path']),
                 'sha': e['sha'], 'mode': e['mode']} for e in manifest['files']]
    if mapping['entries'] != expected:
        raise ValueError('Mapping differs from complete reviewed manifest and archive rules')
    destinations = [e['destination'] for e in mapping['entries']]
    if len(destinations) != len(set(destinations)):
        raise ValueError('Duplicate destination')
    for destination in destinations:
        path = PurePosixPath(destination)
        if (path.is_absolute() or '..' in path.parts or '.git' in path.parts
                or '\\' in destination or str(path) != destination):
            raise ValueError('Unsafe destination')


def verify(root, mapping, manifest):
    validate_mapping(mapping, manifest)
    for e in mapping['entries']:
        target = root
        for part in PurePosixPath(e['destination']).parts:
            target = target / part
            if target.is_symlink():
                raise ValueError(f"Symlink at mapped path: {e['destination']}")
        if not target.is_file():
            raise ValueError(f"Missing regular file: {e['destination']}")
        data = target.read_bytes()
        digest = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        if digest != e['sha']:
            raise ValueError(f"Blob mismatch: {e['destination']}")
        mode = stat.S_IMODE(target.stat().st_mode)
        if mode != (0o755 if e['mode'] == '100755' else 0o644):
            raise ValueError(f"Mode mismatch: {e['destination']}")
    return len(mapping['entries'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text())
    if manifest['repository'] != 'KKKKhazix/AIHOT' or manifest['commit'] != PIN:
        raise ValueError('Manifest does not match the approved upstream baseline')
    mapping = json.loads((ROOT / 'vendor-manifests/aihot-import-map.json').read_text())
    count = verify(args.root, mapping, manifest)
    print(f'Verified {count} imported blobs/modes at {PIN}, including archived files and licenses.')


if __name__ == '__main__':
    main()
