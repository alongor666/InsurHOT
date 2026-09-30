// Local backup copies are pruned by kind across the current file name prefix and the one from before
// ADR-003 step 2, so that the copies made under the old name do not stay for ever.
import "./setup.ts";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pruneLocalBackups } from "@aihot/backend/operations/backup";

test("the newest three of each kind stay, whichever prefix they carry; other files are not touched", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "backup-prune-"));
  const names = [
    "aihot-202609280400.dump", "aihot-202609290400.dump", "insurhot-202609300400.dump", "insurhot-202610010400.dump", "insurhot-202610020400.dump",
    "aihot-files-202609280400.tar.gz", "aihot-files-202609290400.tar.gz", "aihot-files-202609300400.tar.gz", "insurhot-files-202610010400.tar.gz",
    "notes.txt", "aihot-1999-old-format.dump",
  ];
  for (const n of names) writeFileSync(path.join(dir, n), n);
  const removed = await pruneLocalBackups(dir);
  assert.deepEqual(removed.sort(), ["aihot-202609280400.dump", "aihot-202609290400.dump", "aihot-files-202609280400.tar.gz"]);
  assert.deepEqual(readdirSync(dir).sort(), [
    "aihot-1999-old-format.dump", "aihot-files-202609290400.tar.gz", "aihot-files-202609300400.tar.gz", "insurhot-202609300400.dump", "insurhot-202610010400.dump",
    "insurhot-202610020400.dump", "insurhot-files-202610010400.tar.gz", "notes.txt",
  ]);
  assert.deepEqual(await pruneLocalBackups(dir), [], "a second pass removes nothing more");
});
