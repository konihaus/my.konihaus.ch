// Reply to a customer thread and notify them by email (without the message text).
//   npm run reply -- <customer-id> <thread-id> "Your answer"
//   npm run reply -- <customer-id> <thread-id> --close        # mark as closed, no message
import { addMessage, getCustomer, setThreadStatus, validateMessage } from '../lib/store.js';
import { sendMail } from '../lib/mail.js';

const [cid, tid, ...rest] = process.argv.slice(2);
if (!cid || !tid) {
  console.error('Usage: npm run reply -- <customer-id> <thread-id> "text" | --close');
  process.exit(1);
}
const customer = await getCustomer(cid);
if (!customer) {
  console.error(`unknown customer ${cid}`);
  process.exit(1);
}

if (rest[0] === '--close') {
  await setThreadStatus(cid, tid, 'closed');
  console.log('thread closed');
  process.exit(0);
}

const body = rest.join(' ');
if (validateMessage({ body }, { needSubject: false }).length) {
  console.error('message empty or too long');
  process.exit(1);
}
const meta = await addMessage(cid, tid, { from: 'koni', body });
if (!meta) {
  console.error('thread not found');
  process.exit(1);
}

const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const de = customer.profile.language !== 'en';
await sendMail({
  to: customer.profile.email,
  subject: de ? 'Neue Antwort von Konihaus' : 'New reply from Konihaus',
  text: de
    ? `Guten Tag ${customer.profile.name}\n\nSie haben eine neue Antwort zu «${meta.subject}». Sie finden sie nach der Anmeldung in Ihrem Konto:\n\n${base}\n\nKonihaus`
    : `Hello ${customer.profile.name}\n\nYou have a new reply to "${meta.subject}". You can read it after signing in:\n\n${base}\n\nKonihaus`,
});
console.log(`replied (${meta.status}) and notified ${customer.profile.email}`);
