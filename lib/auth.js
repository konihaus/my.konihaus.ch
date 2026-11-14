// Magic-link login tokens (stored in S3, single use) and signed session cookies (stateless).
import crypto from 'node:crypto';
import { getJson, putJson, ConflictError } from './s3.js';

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const COOKIE_NAME = 'kh_session';

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (>= 32 chars)');
  return s;
}

// ---------- login tokens ----------

export async function createLoginToken(customerId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await putJson(
    `auth/tokens/${sha256(token)}.json`,
    { customerId, exp: Date.now() + TOKEN_TTL_MS, used: false },
    { create: true }
  );
  return token;
}

/** Returns the customerId, or null if invalid/expired/already used. Atomic single use. */
export async function consumeLoginToken(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const key = `auth/tokens/${sha256(token)}.json`;
  const cur = await getJson(key);
  if (!cur || cur.data.used || cur.data.exp < Date.now()) return null;
  try {
    await putJson(key, { ...cur.data, used: true, usedAt: Date.now() }, { ifMatch: cur.etag });
  } catch (e) {
    if (e instanceof ConflictError) return null; // someone else consumed it first
    throw e;
  }
  return cur.data.customerId;
}

// ---------- sessions ----------

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const hmac = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

export function signSession(customerId) {
  const payload = b64({ cid: customerId, exp: Date.now() + SESSION_TTL_MS });
  return `${payload}.${hmac(payload)}`;
}

export function verifySession(value) {
  if (typeof value !== 'string') return null;
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return null;
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { cid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!cid || exp < Date.now()) return null;
    return cid;
  } catch {
    return null;
  }
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(value, { clear = false } = {}) {
  const secure = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  const attrs = [
    `${COOKIE_NAME}=${clear ? '' : encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    clear ? 'Max-Age=0' : `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}
