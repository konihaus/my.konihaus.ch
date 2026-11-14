// Upload customer JSON authored in your Obsidian vault to S3.
//
//   npm run sync -- <folder>            # folder contains one sub-folder per customer id
//   npm run sync -- <folder> --dry-run
//
// Expected layout:
//   <folder>/<customer-id>/profile.json
//   <folder>/<customer-id>/setup.json
//   <folder>/<customer-id>/subscription.json
//
// Only these three files are written (messages/threads are never touched).
// The email -> customer index entry is (re)created from profile.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import { putJson, getJson } from '../lib/s3.js';
import { sha256, normalizeEmail } from '../lib/auth.js';
import { isValidId } from '../lib/store.js';

const FILES = ['profile.json', 'setup.json', 'subscription.json'];
const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const root = args.find((a) => !a.startsWith('--'));
if (!root) {
  console.error('Usage: npm run sync -- <folder> [--dry-run]');
  process.exit(1);
}

let errors = 0;
const entries = await fs.readdir(root, { withFileTypes: true });
for (const ent of entries.filter((e) => e.isDirectory())) {
  const cid = ent.name;
  if (!isValidId(cid)) {
    console.error(`skip ${cid}: id must match [a-z0-9][a-z0-9_-]{2,40}`);
    errors++;
    continue;
  }
  const docs = {};
  for (const f of FILES) {
    try {
      docs[f] = JSON.parse(await fs.readFile(path.join(root, cid, f), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') continue;
      console.error(`${cid}/${f}: ${e.message}`);
      errors++;
    }
  }
  const profile = docs['profile.json'];
  if (!profile?.email || !profile?.name) {
    console.error(`${cid}: profile.json needs at least name and email`);
    errors++;
    continue;
  }
  profile.id = cid;
  const email = normalizeEmail(profile.email);

  // Refuse to point an email at a different customer by accident.
  const idxKey = `index/email/${sha256(email)}.json`;
  const existing = dry ? null : await getJson(idxKey);
  if (existing && existing.data.customerId !== cid) {
    console.error(`${cid}: email already belongs to customer ${existing.data.customerId}`);
    errors++;
    continue;
  }

  console.log(`${dry ? '[dry] ' : ''}${cid}: ${Object.keys(docs).join(', ')}`);
  if (dry) continue;
  for (const [name, data] of Object.entries(docs)) {
    await putJson(`customers/${cid}/${name}`, data);
  }
  await putJson(idxKey, { customerId: cid });
}
process.exit(errors ? 1 : 0);
