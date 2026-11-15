// Email sender. Provider is picked from the environment:
//   BREVO_API_KEY   -> Brevo transactional API (https://api.brevo.com/v3/smtp/email)
//   RESEND_API_KEY  -> Resend REST API
//   neither         -> the mail is printed to the log (development)
// Swap this file out to use Postmark / SES / etc. — nothing else depends on it.

const clean = (s) => String(s).replace(/[\r\n]+/g, ' ').trim();

// "Konihaus <hello@konihaus.ch>" -> { name, email }
function parseFrom(from) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: clean(m[1]) || 'Konihaus', email: clean(m[2]) } : { name: 'Konihaus', email: clean(from) };
}

async function fail(provider, res) {
  throw new Error(`Mail provider error (${provider}) ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || 'Konihaus <hello@konihaus.ch>';

  if (process.env.BREVO_API_KEY) {
    const sender = parseFrom(from);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ sender, to: [{ email: to }], subject: clean(subject), textContent: text, ...(html ? { htmlContent: html } : {}) }),
    });
    if (!res.ok) await fail('brevo', res);
    return res.json();
  }

  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject: clean(subject), text, ...(html ? { html } : {}) }),
    });
    if (!res.ok) await fail('resend', res);
    return res.json();
  }

  console.log(`[mail:dev] to=${to}\nsubject=${clean(subject)}\n${text}\n`);
  return { dev: true };
}
