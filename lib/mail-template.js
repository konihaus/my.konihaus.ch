// Branded HTML + plain-text versions of the sign-in email.
// Table layout and inline styles only: that is what mail clients render reliably.
// The logo is a PNG served from /email-logo.png (SVG does not work in most mail clients).

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const BRAND = { green: '#2a4a35', cream: '#fafaf8', copper: '#c47f2b', text: '#1c1f1d', muted: '#5a615d', line: '#dcdfdb' };

const COPY = {
  de: {
    subject: 'Ihr Anmeldelink für Konihaus',
    preheader: 'Ihr persönlicher Anmeldelink – 15 Minuten gültig.',
    greeting: (name) => (name ? `Guten Tag ${name}` : 'Guten Tag'),
    intro: 'Hier ist Ihr persönlicher Anmeldelink für Ihr Konihaus-Konto. Er ist 15 Minuten gültig und kann nur einmal verwendet werden.',
    button: 'Bei Konihaus anmelden',
    fallback: 'Falls die Schaltfläche nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:',
    ignore: 'Wenn Sie diesen Link nicht angefordert haben, können Sie diese E-Mail ignorieren. Ihr Konto bleibt sicher.',
    regards: 'Freundliche Grüsse',
  },
  en: {
    subject: 'Your Konihaus sign-in link',
    preheader: 'Your personal sign-in link – valid for 15 minutes.',
    greeting: (name) => (name ? `Hello ${name}` : 'Hello'),
    intro: 'Here is your personal sign-in link for your Konihaus account. It is valid for 15 minutes and can only be used once.',
    button: 'Sign in to Konihaus',
    fallback: 'If the button does not work, copy this link into your browser:',
    ignore: 'If you did not request this link, you can ignore this email. Your account stays secure.',
    regards: 'Kind regards',
  },
};

export function loginMail({ lang = 'de', link, name, baseUrl }) {
  const c = COPY[lang === 'en' ? 'en' : 'de'];
  const logo = `${baseUrl}/email-logo.png`;
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

  const text = `${c.greeting(name)},\n\n${c.intro}\n\n${c.button}:\n${link}\n\n${c.ignore}\n\n${c.regards}\nKonihaus\nkonihaus.ch`;

  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(c.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.cream};">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-radius:12px;overflow:hidden;border:1px solid ${BRAND.line};background:#ffffff;">
    <tr><td align="center" style="background:${BRAND.green};padding:0;">
      <img src="${esc(logo)}" width="294" height="104" alt="Konihaus" style="display:block;width:294px;max-width:100%;height:auto;border:0;">
    </td></tr>
    <tr><td style="padding:32px 32px 8px;font-family:${font};color:${BRAND.text};">
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600;color:${BRAND.green};">${esc(c.greeting(name))}</h1>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:${BRAND.text};">${esc(c.intro)}</p>
    </td></tr>
    <tr><td align="center" style="padding:0 32px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td align="center" style="border-radius:8px;background:${BRAND.green};">
          <a href="${esc(link)}" style="display:inline-block;padding:14px 28px;font-family:${font};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(c.button)}</a>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:0 32px 8px;font-family:${font};color:${BRAND.muted};">
      <p style="margin:0 0 6px;font-size:13px;line-height:1.5;">${esc(c.fallback)}</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${esc(link)}" style="color:${BRAND.green};">${esc(link)}</a></p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.5;">${esc(c.ignore)}</p>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.5;color:${BRAND.text};">${esc(c.regards)}<br><strong>Konihaus</strong></p>
    </td></tr>
    <tr><td style="padding:16px 32px 24px;border-top:1px solid ${BRAND.line};font-family:${font};font-size:12px;line-height:1.5;color:${BRAND.muted};">
      <span style="color:${BRAND.copper};">&bull;</span> <a href="https://konihaus.ch" style="color:${BRAND.muted};text-decoration:none;">konihaus.ch</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: c.subject, text, html };
}
