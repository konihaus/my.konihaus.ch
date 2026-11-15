import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createLoginToken,
  consumeLoginToken,
  signSession,
  verifySession,
  parseCookies,
  sessionCookie,
  normalizeEmail,
  COOKIE_NAME,
} from './lib/auth.js';
import {
  findCustomerIdByEmail,
  getCustomer,
  createThread,
  addMessage,
  listThreads,
  getThread,
  validateMessage,
  isValidId,
} from './lib/store.js';
import { sendMail } from './lib/mail.js';
import { loginMail as renderLoginMail } from './lib/mail-template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const isProd = () => process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const baseUrl = () => (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// ---------- security headers ----------
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; " +
      "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  if (isProd()) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '4kb' }));

// ---------- CSRF: same-origin check for state-changing requests ----------
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const allowed = new Set([new URL(baseUrl()).origin]);
  if (!isProd()) allowed.add(`http://${req.headers.host}`);
  const origin = req.headers.origin;
  const ok = origin
    ? allowed.has(origin)
    : req.headers['sec-fetch-site'] === 'same-origin';
  if (!ok) return res.status(403).json({ error: 'forbidden' });
  next();
});

// ---------- tiny best-effort rate limiter (per instance; add a Vercel WAF rule for real limits) ----------
const hits = new Map();
function rateLimited(key, max, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

// ---------- auth routes ----------
app.post('/api/auth/request', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const neutral = () => res.json({ ok: true }); // identical answer whether or not the email exists
  if (!email || email.length > 254 || !email.includes('@')) return neutral();
  if (rateLimited(`ip:${req.ip}`, 10) || rateLimited(`em:${email}`, 3)) return neutral();
  try {
    const cid = await findCustomerIdByEmail(email);
    if (cid) {
      const customer = await getCustomer(cid);
      if (customer && customer.profile.status !== 'disabled') {
        const lang = customer.profile.language === 'en' ? 'en' : 'de';
        const token = await createLoginToken(cid);
        const link = `${baseUrl()}/auth/verify?token=${token}`;
        const mail = renderLoginMail({ lang, link, name: customer.profile.name, baseUrl: baseUrl() });
        await sendMail({ to: customer.profile.email, subject: mail.subject, text: mail.text, html: mail.html });
      }
    }
  } catch (e) {
    console.error('login request failed', e);
  }
  neutral();
});

// GET only shows a confirmation button. Mail scanners that prefetch links must not burn the token.
app.get('/auth/verify', (req, res) => {
  const token = String(req.query.token || '');
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return res.status(400).send(page('Link invalid', '<p>This link is not valid.</p><p><a href="/">Back</a></p>'));
  res.set('Cache-Control', 'no-store').send(
    page(
      'Konihaus',
      `<form method="post" action="/auth/verify">
        <input type="hidden" name="token" value="${token}">
        <p>Click to sign in. / Zum Anmelden klicken.</p>
        <button type="submit" class="btn">Sign in / Anmelden</button>
      </form>`
    )
  );
});

app.post('/auth/verify', async (req, res) => {
  try {
    const cid = await consumeLoginToken(String(req.body?.token || ''));
    if (!cid) {
      return res.status(400).send(page('Link expired', '<p>This link has expired or was already used. Please request a new one.</p><p><a href="/">Back</a></p>'));
    }
    res.set('Set-Cookie', sessionCookie(signSession(cid)));
    res.redirect(303, '/');
  } catch (e) {
    console.error('verify failed', e);
    res.status(500).send(page('Error', '<p>Something went wrong. Please try again.</p>'));
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.set('Set-Cookie', sessionCookie('', { clear: true }));
  res.json({ ok: true });
});

function page(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="/style.css"></head><body class="plain"><main class="card">${inner}</main></body></html>`;
}

// ---------- authenticated API ----------
async function requireAuth(req, res, next) {
  res.set('Cache-Control', 'no-store');
  const cid = verifySession(parseCookies(req.headers.cookie)[COOKIE_NAME]);
  if (!cid) return res.status(401).json({ error: 'unauthenticated' });
  try {
    const customer = await getCustomer(cid);
    if (!customer || customer.profile.status === 'disabled') {
      res.set('Set-Cookie', sessionCookie('', { clear: true }));
      return res.status(401).json({ error: 'unauthenticated' });
    }
    req.cid = cid;
    req.customer = customer;
    next();
  } catch (e) {
    next(e);
  }
}

const api = express.Router();
api.use(requireAuth);

api.get('/me', (req, res) => {
  const { profile, subscription } = req.customer;
  res.json({
    profile: { name: profile.name, email: profile.email, language: profile.language || 'de' },
    subscription,
  });
});

api.get('/setup', (req, res) => res.json(req.customer.setup || { rooms: [], alertContacts: [] }));

api.get('/threads', async (req, res, next) => {
  try {
    res.json(await listThreads(req.cid));
  } catch (e) {
    next(e);
  }
});

api.post('/threads', async (req, res, next) => {
  try {
    const errors = validateMessage(req.body || {}, { needSubject: true });
    if (errors.length) return res.status(400).json({ error: 'invalid', fields: errors });
    if (rateLimited(`msg:${req.cid}`, 20, 60 * 60 * 1000)) return res.status(429).json({ error: 'slow_down' });
    const meta = await createThread(req.cid, req.body);
    notifyAdmin(req, meta, req.body.body);
    res.status(201).json(meta);
  } catch (e) {
    next(e);
  }
});

api.get('/threads/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ error: 'not_found' });
    const t = await getThread(req.cid, req.params.id);
    if (!t) return res.status(404).json({ error: 'not_found' });
    res.json(t);
  } catch (e) {
    next(e);
  }
});

api.post('/threads/:id/messages', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ error: 'not_found' });
    const errors = validateMessage(req.body || {}, { needSubject: false });
    if (errors.length) return res.status(400).json({ error: 'invalid', fields: errors });
    if (rateLimited(`msg:${req.cid}`, 20, 60 * 60 * 1000)) return res.status(429).json({ error: 'slow_down' });
    const meta = await addMessage(req.cid, req.params.id, { from: 'customer', body: req.body.body });
    if (!meta) return res.status(404).json({ error: 'not_found' });
    notifyAdmin(req, meta, req.body.body);
    res.status(201).json(meta);
  } catch (e) {
    next(e);
  }
});

app.use('/api', api);

function notifyAdmin(req, meta, body) {
  if (!process.env.ADMIN_EMAIL) return;
  sendMail({
    to: process.env.ADMIN_EMAIL,
    subject: `[Konihaus portal] ${req.customer.profile.name}: ${meta.subject}`,
    text:
      `Customer: ${req.customer.profile.name} <${req.customer.profile.email}> (${req.cid})\n` +
      `Thread: ${meta.id}   Status: ${meta.status}\n\n${body}\n\n` +
      `Reply: npm run reply -- ${req.cid} ${meta.id} "your answer"`,
  }).catch((e) => console.error('admin notification failed', e));
}

// ---------- static frontend ----------
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html', maxAge: '5m' }));
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

// ---------- errors ----------
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'bad_json' });
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

export default app;

if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`my.konihaus.ch listening on http://localhost:${port}`));
}
