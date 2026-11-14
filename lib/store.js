// Domain layer over the S3 JSON store.
//
// Layout (all keys in the private portal bucket):
//   customers/{id}/profile.json        { id, name, email, language, status }
//   customers/{id}/setup.json          { rooms: [...], alertContacts: [...], notes }
//   customers/{id}/subscription.json   { status, tier, ... , invoices: [...] }
//   customers/{id}/threads/{tid}/meta.json
//   customers/{id}/threads/{tid}/msgs/{ts}-{rand}.json   (one object per message, never edited)
//   index/email/{sha256(email)}.json   { customerId }
//   auth/tokens/{sha256(token)}.json
import crypto from 'node:crypto';
import { getJson, putJson, updateJson, listKeys, listFolders, ConflictError } from './s3.js';
import { sha256, normalizeEmail } from './auth.js';

export const CATEGORIES = ['issue', 'question', 'billing', 'other'];
export const LIMITS = { subject: 120, body: 5000 };

const ID_RE = /^[a-z0-9][a-z0-9_-]{2,40}$/;
export const isValidId = (s) => typeof s === 'string' && ID_RE.test(s);

const cKey = (cid, name) => `customers/${cid}/${name}`;

export async function findCustomerIdByEmail(email) {
  const hit = await getJson(`index/email/${sha256(normalizeEmail(email))}.json`);
  return hit?.data?.customerId ?? null;
}

export async function getCustomer(cid) {
  if (!isValidId(cid)) return null;
  const [profile, subscription, setup] = await Promise.all([
    getJson(cKey(cid, 'profile.json')),
    getJson(cKey(cid, 'subscription.json')),
    getJson(cKey(cid, 'setup.json')),
  ]);
  if (!profile) return null;
  return {
    profile: profile.data,
    subscription: subscription?.data ?? null,
    setup: setup?.data ?? null,
  };
}

// ---------- threads ----------

const newThreadId = () => `t-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
const msgKeyName = () => `${String(Date.now()).padStart(13, '0')}-${crypto.randomBytes(3).toString('hex')}`;

export function validateMessage({ subject, category, body }, { needSubject }) {
  const errors = [];
  if (needSubject) {
    if (typeof subject !== 'string' || !subject.trim()) errors.push('subject');
    else if (subject.length > LIMITS.subject) errors.push('subject_too_long');
    if (!CATEGORIES.includes(category)) errors.push('category');
  }
  if (typeof body !== 'string' || !body.trim()) errors.push('body');
  else if (body.length > LIMITS.body) errors.push('body_too_long');
  return errors;
}

async function writeMessage(cid, tid, msg) {
  for (let i = 0; i < 3; i++) {
    const key = cKey(cid, `threads/${tid}/msgs/${msgKeyName()}.json`);
    try {
      await putJson(key, msg, { create: true });
      return key;
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
    }
  }
  throw new Error('Could not write message');
}

export async function createThread(cid, { subject, category, body }) {
  const tid = newThreadId();
  const now = new Date().toISOString();
  const meta = {
    id: tid,
    subject: subject.trim(),
    category,
    status: 'open',
    createdAt: now,
    lastMessageAt: now,
    lastFrom: 'customer',
    messageCount: 1,
  };
  await putJson(cKey(cid, `threads/${tid}/meta.json`), meta, { create: true });
  await writeMessage(cid, tid, { from: 'customer', at: now, body: body.trim() });
  return meta;
}

export async function addMessage(cid, tid, { from, body }) {
  if (!isValidId(tid)) throw new Error('bad thread id');
  const now = new Date().toISOString();
  const metaKey = cKey(cid, `threads/${tid}/meta.json`);
  if (!(await getJson(metaKey))) return null;
  await writeMessage(cid, tid, { from, at: now, body: body.trim() });
  return updateJson(metaKey, (m) => ({
    ...m,
    status: from === 'customer' ? 'open' : 'answered',
    lastMessageAt: now,
    lastFrom: from,
    messageCount: (m.messageCount || 0) + 1,
  }));
}

export async function setThreadStatus(cid, tid, status) {
  return updateJson(cKey(cid, `threads/${tid}/meta.json`), (m) => ({ ...m, status }));
}

export async function listThreads(cid) {
  const ids = await listFolders(cKey(cid, 'threads/'));
  const metas = await Promise.all(ids.map((id) => getJson(cKey(cid, `threads/${id}/meta.json`))));
  return metas
    .filter(Boolean)
    .map((m) => m.data)
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export async function getThread(cid, tid) {
  if (!isValidId(tid)) return null;
  const meta = await getJson(cKey(cid, `threads/${tid}/meta.json`));
  if (!meta) return null;
  const keys = (await listKeys(cKey(cid, `threads/${tid}/msgs/`))).sort();
  const msgs = await Promise.all(keys.map((k) => getJson(k)));
  return { meta: meta.data, messages: msgs.filter(Boolean).map((m) => m.data) };
}

/** All customer ids (for admin scripts). */
export async function listCustomerIds() {
  return listFolders('customers/');
}
