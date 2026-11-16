// Passkeys (WebAuthn) for the customer portal.
//
// Storage: customers/{id}/passkeys.json  { credentials: [{ id, publicKey, counter, transports, rpID, name, createdAt, lastUsed }] }
// Sign-in is usernameless: the passkey is a discoverable credential whose user handle is the customer id.
// Challenges are stateless: signed, short-lived, HttpOnly cookie (HMAC with SESSION_SECRET).
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { getJson, putJson, updateJson, ConflictError } from './s3.js';
import { signPayload, verifyPayload, parseCookies } from './auth.js';
import { isValidId } from './store.js';

export const MAX_PASSKEYS = 10;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_COOKIE = 'kh_chal';
const key = (cid) => `customers/${cid}/passkeys.json`;

export class PasskeyError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** Relying party from the public URL. Changing the hostname invalidates existing passkeys. */
export function relyingParty(baseUrl) {
  const u = new URL(baseUrl);
  return { rpID: u.hostname, origin: u.origin };
}

// ---------- challenge cookie ----------
export function challengeCookie(kind, challenge, { secure = false, cid } = {}) {
  const value = signPayload({ k: kind, c: challenge, ...(cid ? { cid } : {}) }, CHALLENGE_TTL_MS);
  return [`${CHALLENGE_COOKIE}=${encodeURIComponent(value)}`, 'Path=/api', 'HttpOnly', 'SameSite=Strict', `Max-Age=${CHALLENGE_TTL_MS / 1000}`, secure ? 'Secure' : null]
    .filter(Boolean)
    .join('; ');
}
export const clearChallengeCookie = ({ secure = false } = {}) =>
  [`${CHALLENGE_COOKIE}=`, 'Path=/api', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0', secure ? 'Secure' : null].filter(Boolean).join('; ');

/** Returns { c: challenge, cid? } if the cookie is valid for this kind, else null. */
export function readChallenge(cookieHeader, kind) {
  const data = verifyPayload(parseCookies(cookieHeader)[CHALLENGE_COOKIE]);
  return data && data.k === kind ? data : null;
}

// ---------- storage ----------
export async function listPasskeys(cid, rpID) {
  const cur = await getJson(key(cid));
  const all = cur?.data?.credentials ?? [];
  return rpID ? all.filter((c) => c.rpID === rpID) : all;
}
export const publicView = ({ id, name, createdAt, lastUsed }) => ({ id, name, createdAt, lastUsed });

async function addCredential(cid, cred) {
  try {
    await putJson(key(cid), { credentials: [cred] }, { create: true });
  } catch (e) {
    if (!(e instanceof ConflictError)) throw e;
    await updateJson(key(cid), (d) => {
      d.credentials = d.credentials || [];
      if (d.credentials.length >= MAX_PASSKEYS) throw new PasskeyError('limit');
      if (d.credentials.some((c) => c.id === cred.id)) throw new PasskeyError('duplicate');
      d.credentials.push(cred);
      return d;
    });
  }
}

export async function removePasskey(cid, rpID, id) {
  const cur = await getJson(key(cid));
  if (!cur || !cur.data.credentials?.some((c) => c.id === id && c.rpID === rpID)) return false;
  await updateJson(key(cid), (d) => {
    d.credentials = d.credentials.filter((c) => !(c.id === id && c.rpID === rpID));
    return d;
  });
  return true;
}

// ---------- registration (signed-in customer) ----------
export async function registrationOptions({ cid, profile, rp }) {
  const existing = await listPasskeys(cid, rp.rpID);
  if (existing.length >= MAX_PASSKEYS) throw new PasskeyError('limit');
  return generateRegistrationOptions({
    rpName: 'Konihaus™',
    rpID: rp.rpID,
    userName: profile.email,
    userDisplayName: profile.name,
    userID: new TextEncoder().encode(cid),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: c.transports })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
}

export async function finishRegistration({ cid, rp, expectedChallenge, response, name }) {
  const { verified, registrationInfo } = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    requireUserVerification: true,
  });
  if (!verified || !registrationInfo) throw new PasskeyError('not_verified');
  const c = registrationInfo.credential;
  const cred = {
    id: c.id,
    publicKey: Buffer.from(c.publicKey).toString('base64url'),
    counter: c.counter,
    transports: c.transports || [],
    rpID: rp.rpID,
    name: String(name || 'Passkey').replace(/[\r\n]+/g, ' ').trim().slice(0, 60) || 'Passkey',
    createdAt: new Date().toISOString(),
    lastUsed: null,
  };
  await addCredential(cid, cred);
  return publicView(cred);
}

// ---------- sign-in (no session yet) ----------
export const authenticationOptions = (rp) => generateAuthenticationOptions({ rpID: rp.rpID, userVerification: 'required' });

/** Returns the customer id on success, null on any failure. */
export async function finishAuthentication({ rp, expectedChallenge, response }) {
  const handle = response?.response?.userHandle;
  if (typeof handle !== 'string' || typeof response?.id !== 'string') return null;
  let cid;
  try {
    cid = Buffer.from(handle, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!isValidId(cid)) return null;
  const cred = (await listPasskeys(cid, rp.rpID)).find((c) => c.id === response.id);
  if (!cred) return null;
  const { verified, authenticationInfo } = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    requireUserVerification: true,
    credential: { id: cred.id, publicKey: Buffer.from(cred.publicKey, 'base64url'), counter: cred.counter, transports: cred.transports },
  });
  if (!verified) return null;
  await updateJson(key(cid), (d) => {
    const c = d.credentials.find((x) => x.id === cred.id);
    if (c) {
      c.counter = authenticationInfo.newCounter;
      c.lastUsed = new Date().toISOString();
    }
    return d;
  });
  return cid;
}
