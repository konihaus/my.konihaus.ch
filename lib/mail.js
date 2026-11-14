// Email via the Resend REST API. Without RESEND_API_KEY the mail is logged (development).
// Swap this file out to use Postmark / SES / etc. — nothing else depends on it.

const clean = (s) => String(s).replace(/[\r\n]+/g, ' ').trim();

export async function sendMail({ to, subject, text }) {
  const from = process.env.MAIL_FROM || 'Konihaus <portal@konihaus.ch>';
  if (!process.env.RESEND_API_KEY) {
    console.log(`[mail:dev] to=${to}\nsubject=${clean(subject)}\n${text}\n`);
    return { dev: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject: clean(subject), text }),
  });
  if (!res.ok) {
    throw new Error(`Mail provider error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}
