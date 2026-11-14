// End-to-end test against an in-memory fake S3 (no AWS needed). Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET = 'x'.repeat(48);
process.env.BASE_URL = 'https://my.konihaus.ch';
process.env.S3_BUCKET = 'test';
process.env.VERCEL = '1'; // prevents index.js from auto-listening

const { _setClient, putJson } = await import('../lib/s3.js');
const { createLoginToken, sha256 } = await import('../lib/auth.js');
const store = await import('../lib/store.js');
const { default: app } = await import('../index.js');

// ---------- fake S3 ----------
function fakeS3() {
  const objs = new Map();
  let n = 0;
  const err = (name, code) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode: code } });
  return {
    objs,
    async send(cmd) {
      const i = cmd.input;
      switch (cmd.constructor.name) {
        case 'GetObjectCommand': {
          const o = objs.get(i.Key);
          if (!o) throw err('NoSuchKey', 404);
          return { ETag: o.etag, Body: { transformToString: async () => o.body } };
        }
        case 'PutObjectCommand': {
          const o = objs.get(i.Key);
          if (i.IfNoneMatch === '*' && o) throw err('PreconditionFailed', 412);
          if (i.IfMatch && (!o || o.etag.replace(/"/g, '') !== String(i.IfMatch).replace(/"/g, ''))) throw err('PreconditionFailed', 412); // like the real storage: quotes optional
          const etag = `"e${++n}"`;
          objs.set(i.Key, { body: i.Body, etag });
          return { ETag: etag };
        }
        case 'ListObjectsV2Command': {
          const keys = [...objs.keys()].filter((k) => k.startsWith(i.Prefix || '')).sort();
          if (i.Delimiter) {
            const folders = new Set();
            const contents = [];
            for (const k of keys) {
              const rest = k.slice(i.Prefix.length);
              const idx = rest.indexOf(i.Delimiter);
              if (idx === -1) contents.push({ Key: k });
              else folders.add(i.Prefix + rest.slice(0, idx + 1));
            }
            return { Contents: contents, CommonPrefixes: [...folders].map((Prefix) => ({ Prefix })), IsTruncated: false };
          }
          return { Contents: keys.map((Key) => ({ Key })), IsTruncated: false };
        }
        default:
          throw new Error(`unsupported ${cmd.constructor.name}`);
      }
    },
  };
}

let server, base, s3;
const ORIGIN = { Origin: 'https://my.konihaus.ch' };

async function seed(cid, email, name = 'Anna') {
  await putJson(`customers/${cid}/profile.json`, { id: cid, name, email, language: 'de', status: 'active' });
  await putJson(`customers/${cid}/subscription.json`, { status: 'active', tier: 'Basic', priceChfPerMonth: 49, invoices: [] });
  await putJson(`customers/${cid}/setup.json`, { rooms: [{ name: 'Flur', devices: [] }], alertContacts: [] });
  await putJson(`index/email/${sha256(email)}.json`, { customerId: cid });
}

async function login(cid) {
  const token = await createLoginToken(cid);
  const res = await fetch(`${base}/auth/verify`, {
    method: 'POST',
    redirect: 'manual',
    headers: { ...ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `token=${token}`,
  });
  assert.equal(res.status, 303);
  return { cookie: res.headers.get('set-cookie').split(';')[0], token };
}

const J = (cookie, method, path, body) =>
  fetch(`${base}/api${path}`, {
    method,
    headers: { Cookie: cookie, ...ORIGIN, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

before(async () => {
  s3 = fakeS3();
  _setClient(s3);
  await seed('c-anna', 'anna@example.com', 'Anna');
  await seed('c-ben', 'ben@example.com', 'Ben');
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('unauthenticated requests are rejected', async () => {
  assert.equal((await fetch(`${base}/api/me`)).status, 401);
  assert.equal((await fetch(`${base}/api/threads`)).status, 401);
});

test('login: magic link is single use, session works, logout clears', async () => {
  const { cookie, token } = await login('c-anna');
  const me = await (await J(cookie, 'GET', '/me')).json();
  assert.equal(me.profile.name, 'Anna');
  assert.equal(me.subscription.tier, 'Basic');
  // token cannot be reused
  const again = await fetch(`${base}/auth/verify`, {
    method: 'POST',
    headers: { ...ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `token=${token}`,
  });
  assert.equal(again.status, 400);
});

test('login request gives an identical neutral answer for unknown emails', async () => {
  const post = (email) =>
    fetch(`${base}/api/auth/request`, {
      method: 'POST',
      headers: { ...ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  const a = await post('nobody@example.com');
  const b = await post('anna@example.com');
  assert.equal(a.status, 200);
  assert.deepEqual(await a.json(), await b.json());
});

test('state-changing requests without same-origin are blocked (CSRF)', async () => {
  const { cookie } = await login('c-anna');
  const res = await fetch(`${base}/api/threads`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 's', category: 'issue', body: 'b' }),
  });
  assert.equal(res.status, 403);
});

test('messaging: create thread, reply both ways, status transitions, validation', async () => {
  const { cookie } = await login('c-anna');
  const bad = await J(cookie, 'POST', '/threads', { subject: '', category: 'nope', body: '' });
  assert.equal(bad.status, 400);

  const created = await J(cookie, 'POST', '/threads', { subject: 'Sensor offline', category: 'issue', body: 'Der Flur-Sensor ist offline.' });
  assert.equal(created.status, 201);
  const meta = await created.json();
  assert.equal(meta.status, 'open');

  await store.addMessage('c-anna', meta.id, { from: 'koni', body: 'Ich schaue es mir an.' });
  let t = await (await J(cookie, 'GET', `/threads/${meta.id}`)).json();
  assert.equal(t.meta.status, 'answered');
  assert.deepEqual(t.messages.map((m) => m.from), ['customer', 'koni']);

  await J(cookie, 'POST', `/threads/${meta.id}/messages`, { body: 'Danke!' });
  t = await (await J(cookie, 'GET', `/threads/${meta.id}`)).json();
  assert.equal(t.meta.status, 'open');
  assert.equal(t.messages.length, 3);

  const list = await (await J(cookie, 'GET', '/threads')).json();
  assert.equal(list.length, 1);
});

test('customers cannot read each other\'s threads; ids are validated', async () => {
  const anna = (await login('c-anna')).cookie;
  const ben = (await login('c-ben')).cookie;
  const created = await (await J(anna, 'POST', '/threads', { subject: 'Privat', category: 'question', body: 'geheim' })).json();
  assert.equal((await J(ben, 'GET', `/threads/${created.id}`)).status, 404);
  assert.equal((await J(ben, 'POST', `/threads/${created.id}/messages`, { body: 'hi' })).status, 404);
  assert.equal((await J(ben, 'GET', '/threads/..%2F..%2Fc-anna')).status, 404);
  const benList = await (await J(ben, 'GET', '/threads')).json();
  assert.equal(benList.length, 0);
});

test('concurrent writes to one thread do not lose messages', async () => {
  const { cookie } = await login('c-anna');
  const { id } = await (await J(cookie, 'POST', '/threads', { subject: 'Race', category: 'other', body: 'start' })).json();
  await Promise.all(Array.from({ length: 6 }, (_, i) => store.addMessage('c-anna', id, { from: 'koni', body: `m${i}` })));
  const t = await (await J(cookie, 'GET', `/threads/${id}`)).json();
  assert.equal(t.messages.length, 7);
  assert.equal(t.meta.messageCount, 7);
});

test('disabled customers lose access immediately', async () => {
  const { cookie } = await login('c-ben');
  await putJson('customers/c-ben/profile.json', { id: 'c-ben', name: 'Ben', email: 'ben@example.com', status: 'disabled' });
  assert.equal((await J(cookie, 'GET', '/me')).status, 401);
});

test('tampered session cookie is rejected', async () => {
  const { cookie } = await login('c-anna');
  const [name, val] = cookie.split('=');
  const forged = `${name}=${decodeURIComponent(val).replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'))}`;
  assert.equal((await J(forged, 'GET', '/me')).status, 401);
});
