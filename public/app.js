// Konihaus customer portal — plain DOM, no framework, no innerHTML (all text via textContent).
import { passkeysSupported, creationOptions, requestOptions, registrationJSON, authenticationJSON } from './passkey.js';

const STR = {
  de: {
    signIn: 'Anmelden', email: 'E-Mail-Adresse', sendLink: 'Anmeldelink senden',
    linkSent: 'Falls diese E-Mail-Adresse zu einem Konto gehört, haben wir Ihnen einen Anmeldelink geschickt. Er ist 15 Minuten gültig.',
    loginIntro: 'Wir senden Ihnen einen persönlichen Link per E-Mail. Ein Passwort ist nicht nötig.',
    overview: 'Übersicht', setup: 'Mein Setup', messages: 'Nachrichten', signOut: 'Abmelden',
    hello: (n) => `Guten Tag ${n}`, subscription: 'Abonnement', status: 'Status', package: 'Paket',
    price: 'Preis pro Monat', contractStart: 'Vertragsbeginn', minTermEnd: 'Mindestlaufzeit bis', nextInvoice: 'Nächste Rechnung',
    invoices: 'Rechnungen', number: 'Nr.', date: 'Datum', amount: 'Betrag', due: 'Fällig',
    noInvoices: 'Noch keine Rechnungen.', noSubscription: 'Es ist noch kein Abonnement hinterlegt.',
    st_pending: 'In Vorbereitung', st_active: 'Aktiv', st_paused: 'Pausiert', st_cancelled: 'Gekündigt',
    inv_open: 'Offen', inv_paid: 'Bezahlt', inv_overdue: 'Überfällig',
    rooms: 'Räume und Geräte', alertContacts: 'Alarm-Kontakte', notes: 'Hinweise', lastUpdated: 'Zuletzt aktualisiert',
    noSetup: 'Ihr Setup wird nach der Installation hier angezeigt.', noDevices: 'Keine Geräte erfasst.',
    open: 'Offen', answered: 'Beantwortet', closed: 'Erledigt',
    newMessage: 'Neue Nachricht', subject: 'Betreff', category: 'Thema', message: 'Nachricht', send: 'Senden',
    cat_issue: 'Störung / Problem', cat_question: 'Frage', cat_billing: 'Rechnung / Abo', cat_other: 'Anderes',
    noThreads: 'Noch keine Nachrichten.', back: 'Zurück', reply: 'Antworten', you: 'Sie', koni: 'Konihaus',
    responseTime: (h) => `Wir antworten innert ${h} Stunden (Werktage).`,
    notEmergency: 'Konihaus ist kein Notfalldienst und wird nicht rund um die Uhr überwacht. Im Notfall: 112 (Rettung 144, Polizei 117, Feuerwehr 118).',
    sent: 'Nachricht gesendet.', error: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
    tooMany: 'Zu viele Nachrichten. Bitte versuchen Sie es später erneut.', fillAll: 'Bitte alle Felder ausfüllen.',
    openThreads: (n) => (n === 1 ? '1 offene Nachricht' : `${n} offene Nachrichten`), none: 'Keine offenen Nachrichten.',
    lastMsg: 'Letzte Nachricht', toMessages: 'Zu den Nachrichten',
    security: 'Sicherheit', passkeys: 'Passkeys', or: 'oder', passkeySignIn: 'Mit Passkey anmelden',
    passkeyIntro: 'Mit einem Passkey melden Sie sich ohne E-Mail-Link an: per Face ID, Touch ID, Windows Hello oder Sicherheitsschlüssel. Er bleibt auf Ihrem Gerät und lässt sich nicht erraten oder abfangen.',
    passkeyNameLabel: 'Name des Passkeys', passkeyNamePh: 'z. B. iPhone oder Laptop', addPasskey: 'Passkey hinzufügen',
    noPasskeys: 'Noch keine Passkeys.', createdOn: 'Erstellt', lastUsed: 'Zuletzt benutzt', never: 'noch nie',
    remove: 'Entfernen', confirmRemove: 'Wirklich entfernen?', passkeyAdded: 'Passkey gespeichert.',
    passkeyFailed: 'Die Anmeldung mit Passkey hat nicht geklappt. Bitte versuchen Sie es erneut oder nutzen Sie den E-Mail-Link.',
    passkeyCancelled: 'Abgebrochen.', passkeyUnsupported: 'Dieser Browser unterstützt keine Passkeys.',
    passkeyLimit: 'Sie können höchstens 10 Passkeys speichern.', passkeyExists: 'Dieses Gerät hat bereits einen Passkey für Ihr Konto.',
    passkeyNudgeTitle: 'Schneller anmelden', passkeyNudgeText: 'Richten Sie einen Passkey ein und melden Sie sich künftig mit einem Fingertipp an.', setUpPasskey: 'Passkey einrichten',
  },
  en: {
    signIn: 'Sign in', email: 'Email address', sendLink: 'Send sign-in link',
    linkSent: 'If this email address belongs to an account, we have sent you a sign-in link. It is valid for 15 minutes.',
    loginIntro: 'We email you a personal link. No password needed.',
    overview: 'Overview', setup: 'My setup', messages: 'Messages', signOut: 'Sign out',
    hello: (n) => `Hello ${n}`, subscription: 'Subscription', status: 'Status', package: 'Package',
    price: 'Price per month', contractStart: 'Contract start', minTermEnd: 'Minimum term until', nextInvoice: 'Next invoice',
    invoices: 'Invoices', number: 'No.', date: 'Date', amount: 'Amount', due: 'Due',
    noInvoices: 'No invoices yet.', noSubscription: 'No subscription is on file yet.',
    st_pending: 'Being prepared', st_active: 'Active', st_paused: 'Paused', st_cancelled: 'Cancelled',
    inv_open: 'Open', inv_paid: 'Paid', inv_overdue: 'Overdue',
    rooms: 'Rooms and devices', alertContacts: 'Alert contacts', notes: 'Notes', lastUpdated: 'Last updated',
    noSetup: 'Your setup will appear here after installation.', noDevices: 'No devices recorded.',
    open: 'Open', answered: 'Answered', closed: 'Closed',
    newMessage: 'New message', subject: 'Subject', category: 'Topic', message: 'Message', send: 'Send',
    cat_issue: 'Issue / problem', cat_question: 'Question', cat_billing: 'Billing / subscription', cat_other: 'Other',
    noThreads: 'No messages yet.', back: 'Back', reply: 'Reply', you: 'You', koni: 'Konihaus',
    responseTime: (h) => `We reply within ${h} hours (working days).`,
    notEmergency: 'Konihaus is not an emergency service and is not monitored around the clock. In an emergency call 112 (ambulance 144, police 117, fire 118).',
    sent: 'Message sent.', error: 'Something went wrong. Please try again.',
    tooMany: 'Too many messages. Please try again later.', fillAll: 'Please fill in all fields.',
    openThreads: (n) => (n === 1 ? '1 open message' : `${n} open messages`), none: 'No open messages.',
    lastMsg: 'Last message', toMessages: 'Go to messages',
    security: 'Security', passkeys: 'Passkeys', or: 'or', passkeySignIn: 'Sign in with a passkey',
    passkeyIntro: 'A passkey lets you sign in without an email link: with Face ID, Touch ID, Windows Hello or a security key. It stays on your device and cannot be guessed or intercepted.',
    passkeyNameLabel: 'Passkey name', passkeyNamePh: 'e.g. iPhone or laptop', addPasskey: 'Add a passkey',
    noPasskeys: 'No passkeys yet.', createdOn: 'Created', lastUsed: 'Last used', never: 'never',
    remove: 'Remove', confirmRemove: 'Really remove?', passkeyAdded: 'Passkey saved.',
    passkeyFailed: 'Signing in with a passkey did not work. Please try again or use the email link.',
    passkeyCancelled: 'Cancelled.', passkeyUnsupported: 'This browser does not support passkeys.',
    passkeyLimit: 'You can store at most 10 passkeys.', passkeyExists: 'This device already has a passkey for your account.',
    passkeyNudgeTitle: 'Sign in faster', passkeyNudgeText: 'Set up a passkey and sign in with a single touch from now on.', setUpPasskey: 'Set up a passkey',
  },
};

let lang = (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
const t = (k, ...a) => {
  const v = STR[lang][k];
  return typeof v === 'function' ? v(...a) : v ?? k;
};

// ---------- helpers ----------
const root = document.getElementById('app');

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const locale = () => (lang === 'de' ? 'de-CH' : 'en-GB');
const fmtDate = (s) => {
  if (!s) return '–';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s);
  return isNaN(d) ? String(s) : d.toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric' });
};
const fmtDateTime = (s) => {
  const d = new Date(s);
  return isNaN(d) ? '' : d.toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
};
const chf = (n) => (typeof n === 'number' ? `CHF ${n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '–');

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { ok: res.ok, status: res.status, data };
}

function badge(text, kind) {
  return h('span', { class: `badge ${kind}` }, text);
}
const subKind = { active: 'ok', pending: 'warn', paused: 'warn', cancelled: 'bad' };
const invKind = { paid: 'ok', open: 'warn', overdue: 'bad' };
const thKind = { open: 'warn', answered: 'ok', closed: '' };

// ---------- shell ----------
let me = null;

function shell(active, ...content) {
  const link = (href, key) => h('a', { href, 'aria-current': active === key ? 'page' : null }, t(key));
  root.replaceChildren(
    h('div', { class: 'wrap' },
      h('header', { class: 'top' },
        h('span', { class: 'brand' }, 'Konihaus'),
        h('nav', { 'aria-label': 'Main' }, link('#/', 'overview'), link('#/setup', 'setup'), link('#/messages', 'messages'), link('#/security', 'security')),
        h('button', { class: 'linklike', type: 'button', onclick: signOut }, t('signOut'))
      ),
      h('main', {}, ...content)
    )
  );
  document.title = `Konihaus – ${t(active)}`;
  window.scrollTo(0, 0);
}

async function signOut() {
  await api('/auth/logout', { method: 'POST' });
  me = null;
  location.hash = '#/';
  renderLogin();
}

// ---------- login ----------
function renderLogin() {
  document.title = `Konihaus – ${t('signIn')}`;
  const msg = h('div', { role: 'status' });
  const input = h('input', { type: 'email', id: 'email', name: 'email', autocomplete: 'email', required: true });
  const btn = h('button', { class: 'btn', type: 'submit' }, t('sendLink'));
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      btn.disabled = true;
      const r = await api('/auth/request', { method: 'POST', body: { email: input.value } });
      msg.replaceChildren(h('p', { class: r.ok ? 'ok-text' : 'error' }, r.ok ? t('linkSent') : t('error')));
      if (!r.ok) btn.disabled = false;
    },
  }, h('label', { for: 'email' }, t('email')), input, btn, msg);

  const pkMsg = h('div', { role: 'status' });
  const pkBtn = h('button', {
    class: 'btn secondary', type: 'button',
    onclick: async () => {
      pkBtn.disabled = true;
      pkMsg.replaceChildren();
      try {
        const o = await api('/auth/passkey/options', { method: 'POST' });
        if (!o.ok) throw new Error('options');
        const cred = await navigator.credentials.get({ publicKey: requestOptions(o.data) });
        const r = await api('/auth/passkey/verify', { method: 'POST', body: authenticationJSON(cred) });
        if (!r.ok) throw new Error('verify');
        return boot();
      } catch (err) {
        pkMsg.replaceChildren(h('p', { class: 'error' }, err.name === 'NotAllowedError' ? t('passkeyCancelled') : t('passkeyFailed')));
      }
      pkBtn.disabled = false;
    },
  }, t('passkeySignIn'));
  const pk = passkeysSupported() ? h('div', { class: 'alt' }, h('p', { class: 'divider muted small' }, t('or')), pkBtn, pkMsg) : null;

  root.replaceChildren(
    h('div', { class: 'wrap' },
      h('header', { class: 'top' }, h('span', { class: 'brand' }, 'Konihaus')),
      h('main', {}, h('h1', {}, t('signIn')), h('div', { class: 'card' }, h('p', { class: 'muted' }, t('loginIntro')), form, pk))
    )
  );
}

// ---------- overview ----------
async function viewOverview() {
  const sub = me.subscription;
  const threads = (await api('/threads')).data || [];
  const open = threads.filter((x) => x.status !== 'closed');

  const subCard = h('section', { class: 'card' }, h('h2', {}, t('subscription')));
  if (!sub) subCard.append(h('p', { class: 'muted' }, t('noSubscription')));
  else {
    subCard.append(h('dl', { class: 'facts' },
      h('dt', {}, t('status')), h('dd', {}, badge(t(`st_${sub.status}`), subKind[sub.status] || '')),
      h('dt', {}, t('package')), h('dd', {}, sub.tier || '–'),
      h('dt', {}, t('price')), h('dd', {}, chf(sub.priceChfPerMonth)),
      h('dt', {}, t('contractStart')), h('dd', {}, fmtDate(sub.contractStart)),
      h('dt', {}, t('minTermEnd')), h('dd', {}, fmtDate(sub.minTermEnd)),
      h('dt', {}, t('nextInvoice')), h('dd', {}, fmtDate(sub.nextInvoiceDate))
    ));
  }

  const msgCard = h('section', { class: 'card' }, h('h2', {}, t('messages')),
    h('p', {}, open.length ? t('openThreads', open.length) : t('none')),
    h('a', { href: '#/messages' }, t('toMessages')));

  const invoices = sub?.invoices || [];
  const invCard = h('section', { class: 'card' }, h('h2', {}, t('invoices')),
    invoices.length
      ? h('table', {},
          h('thead', {}, h('tr', {}, ...['number', 'date', 'amount', 'due', 'status'].map((k) => h('th', { scope: 'col' }, t(k))))),
          h('tbody', {}, invoices.map((i) =>
            h('tr', {}, h('td', {}, i.number), h('td', {}, fmtDate(i.date)), h('td', {}, chf(i.amountChf)),
              h('td', {}, fmtDate(i.dueDate)), h('td', {}, badge(t(`inv_${i.status}`), invKind[i.status] || ''))))))
      : h('p', { class: 'muted' }, t('noInvoices')));

  const nudge = passkeysSupported() && me.passkeys === 0
    ? h('section', { class: 'card' }, h('h2', {}, t('passkeyNudgeTitle')), h('p', {}, t('passkeyNudgeText')),
        h('a', { class: 'btn', href: '#/security' }, t('setUpPasskey')))
    : null;
  shell('overview', h('h1', {}, t('hello', me.profile.name)), h('div', { class: 'grid' }, subCard, msgCard), nudge, invCard);
}

// ---------- setup ----------
async function viewSetup() {
  const { data: s } = await api('/setup');
  const rooms = s?.rooms || [];
  const body = [];
  if (!rooms.length) body.push(h('div', { class: 'card' }, h('p', { class: 'muted' }, t('noSetup'))));
  else {
    body.push(h('h2', {}, t('rooms')));
    for (const r of rooms) {
      body.push(h('section', { class: 'card' }, h('h2', {}, r.name),
        r.devices?.length
          ? h('ul', { class: 'plain' }, r.devices.map((d) =>
              h('li', {}, h('strong', {}, d.name), d.type ? h('span', { class: 'muted' }, ` · ${d.type}`) : null,
                d.purpose ? h('div', { class: 'small muted' }, d.purpose) : null)))
          : h('p', { class: 'muted' }, t('noDevices'))));
    }
  }
  if (s?.alertContacts?.length) {
    body.push(h('section', { class: 'card' }, h('h2', {}, t('alertContacts')),
      h('ul', { class: 'plain' }, s.alertContacts.map((c) =>
        h('li', {}, h('strong', {}, c.name), c.role ? h('span', { class: 'muted' }, ` · ${c.role}`) : null,
          c.phone ? h('div', { class: 'small' }, c.phone) : null)))));
  }
  if (s?.notes) body.push(h('section', { class: 'card' }, h('h2', {}, t('notes')), h('p', { class: 'pre' }, s.notes)));
  if (s?.updatedAt) body.push(h('p', { class: 'small muted' }, `${t('lastUpdated')}: ${fmtDate(s.updatedAt)}`));
  shell('setup', h('h1', {}, t('setup')), ...body);
}

// ---------- messages ----------
function notice() {
  const hrs = me.subscription?.supportResponseHours;
  return h('div', { class: 'notice small' }, hrs ? h('div', {}, t('responseTime', hrs)) : null, h('div', {}, t('notEmergency')));
}

async function viewThreads() {
  const threads = (await api('/threads')).data || [];
  shell('messages',
    h('div', { class: 'row' }, h('h1', {}, t('messages')), h('a', { class: 'btn', href: '#/messages/new' }, t('newMessage'))),
    notice(),
    h('div', { class: 'card' },
      threads.length
        ? threads.map((x) =>
            h('a', { class: 'thread-row', href: `#/messages/${x.id}` },
              h('div', { class: 'row' }, h('span', { class: 'title' }, x.subject), badge(t(x.status), thKind[x.status] || '')),
              h('div', { class: 'small muted' }, `${t(`cat_${x.category}`)} · ${t('lastMsg')}: ${fmtDateTime(x.lastMessageAt)}`)))
        : h('p', { class: 'muted' }, t('noThreads'))));
}

function viewNewThread() {
  const subject = h('input', { id: 'subject', maxlength: 120, required: true });
  const category = h('select', { id: 'category' }, ['issue', 'question', 'billing', 'other'].map((c) => h('option', { value: c }, t(`cat_${c}`))));
  const body = h('textarea', { id: 'body', maxlength: 5000, required: true });
  const msg = h('div', { role: 'status' });
  const btn = h('button', { class: 'btn', type: 'submit' }, t('send'));
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      if (!subject.value.trim() || !body.value.trim()) return msg.replaceChildren(h('p', { class: 'error' }, t('fillAll')));
      btn.disabled = true;
      const r = await api('/threads', { method: 'POST', body: { subject: subject.value, category: category.value, body: body.value } });
      if (r.ok) location.hash = `#/messages/${r.data.id}`;
      else {
        btn.disabled = false;
        msg.replaceChildren(h('p', { class: 'error' }, r.status === 429 ? t('tooMany') : t('error')));
      }
    },
  }, h('label', { for: 'subject' }, t('subject')), subject, h('label', { for: 'category' }, t('category')), category,
    h('label', { for: 'body' }, t('message')), body, btn, msg);
  shell('messages', h('h1', {}, t('newMessage')), notice(), h('div', { class: 'card' }, form));
}

async function viewThread(id) {
  const r = await api(`/threads/${encodeURIComponent(id)}`);
  if (!r.ok) { location.hash = '#/messages'; return; }
  const { meta, messages } = r.data;
  const body = h('textarea', { id: 'body', maxlength: 5000, required: true });
  const msg = h('div', { role: 'status' });
  const btn = h('button', { class: 'btn', type: 'submit' }, t('send'));
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      if (!body.value.trim()) return;
      btn.disabled = true;
      const res = await api(`/threads/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { body: body.value } });
      if (res.ok) viewThread(id);
      else {
        btn.disabled = false;
        msg.replaceChildren(h('p', { class: 'error' }, res.status === 429 ? t('tooMany') : t('error')));
      }
    },
  }, h('label', { for: 'body' }, t('reply')), body, btn, msg);

  shell('messages',
    h('p', {}, h('a', { href: '#/messages' }, `← ${t('back')}`)),
    h('div', { class: 'row' }, h('h1', {}, meta.subject), badge(t(meta.status), thKind[meta.status] || '')),
    messages.map((m) =>
      h('div', { class: `msg ${m.from === 'koni' ? 'koni' : ''}` },
        h('div', { class: 'who' }, `${m.from === 'koni' ? t('koni') : t('you')} · ${fmtDateTime(m.at)}`),
        h('div', { class: 'text' }, m.body))),
    notice(),
    h('div', { class: 'card' }, form));
}

// ---------- security (passkeys) ----------
let flash = null;

async function viewSecurity() {
  const list = (await api('/passkeys')).data || [];
  const msg = h('div', { role: 'status' });
  const setMsg = (text, ok) => msg.replaceChildren(h('p', { class: ok ? 'ok-text' : 'error' }, text));
  if (flash) { setMsg(flash, true); flash = null; }

  const name = h('input', { id: 'pkname', maxlength: 60, placeholder: t('passkeyNamePh'), autocomplete: 'off' });
  const btn = h('button', { class: 'btn', type: 'submit' }, t('addPasskey'));
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      if (!passkeysSupported()) return setMsg(t('passkeyUnsupported'));
      btn.disabled = true;
      try {
        const o = await api('/passkeys/options', { method: 'POST' });
        if (!o.ok) { setMsg(o.status === 409 ? t('passkeyLimit') : t('error')); btn.disabled = false; return; }
        const cred = await navigator.credentials.create({ publicKey: creationOptions(o.data) });
        const r = await api('/passkeys/verify', { method: 'POST', body: { name: name.value, response: registrationJSON(cred) } });
        if (r.ok) { me.passkeys = (me.passkeys || 0) + 1; flash = t('passkeyAdded'); return viewSecurity(); }
        setMsg(r.status === 409 ? t('passkeyExists') : t('passkeyFailed'));
      } catch (err) {
        setMsg(err.name === 'InvalidStateError' ? t('passkeyExists') : err.name === 'NotAllowedError' ? t('passkeyCancelled') : t('passkeyFailed'));
      }
      btn.disabled = false;
    },
  }, h('label', { for: 'pkname' }, t('passkeyNameLabel')), name, btn, msg);

  const rows = list.map((p) => {
    let armed = false;
    const rm = h('button', {
      class: 'btn secondary small', type: 'button',
      onclick: async () => {
        if (!armed) { armed = true; rm.textContent = t('confirmRemove'); return; }
        rm.disabled = true;
        const r = await api(`/passkeys/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
        if (r.ok) { me.passkeys = Math.max(0, (me.passkeys || 1) - 1); return viewSecurity(); }
        rm.disabled = false;
        setMsg(t('error'));
      },
    }, t('remove'));
    return h('li', { class: 'row' },
      h('div', {}, h('strong', {}, p.name),
        h('div', { class: 'small muted' }, `${t('createdOn')} ${fmtDateTime(p.createdAt)} · ${t('lastUsed')} ${p.lastUsed ? fmtDateTime(p.lastUsed) : t('never')}`)),
      rm);
  });

  shell('security', h('h1', {}, t('passkeys')),
    h('div', { class: 'card' }, h('p', { class: 'muted' }, t('passkeyIntro')),
      rows.length ? h('ul', { class: 'plain' }, rows) : h('p', { class: 'muted' }, t('noPasskeys')),
      passkeysSupported() ? form : h('p', { class: 'error' }, t('passkeyUnsupported'))));
}

// ---------- router ----------
async function route() {
  if (!me) return;
  const hash = location.hash || '#/';
  try {
    if (hash === '#/' || hash === '') return await viewOverview();
    if (hash === '#/setup') return await viewSetup();
    if (hash === '#/security') return await viewSecurity();
    if (hash === '#/messages') return await viewThreads();
    if (hash === '#/messages/new') return viewNewThread();
    const m = hash.match(/^#\/messages\/([a-z0-9_-]+)$/);
    if (m) return await viewThread(m[1]);
    location.hash = '#/';
  } catch (e) {
    console.error(e);
    shell('overview', h('div', { class: 'card' }, h('p', { class: 'error' }, t('error'))));
  }
}

async function boot() {
  const r = await api('/me');
  if (!r.ok) return renderLogin();
  me = r.data;
  lang = me.profile.language === 'en' ? 'en' : 'de';
  document.documentElement.lang = lang;
  await route();
}

window.addEventListener('hashchange', route);
boot();
