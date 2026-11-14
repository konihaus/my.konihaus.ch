// List support threads that need your answer.
//   npm run threads            # open threads only (waiting for you)
//   npm run threads -- --all   # everything
//   npm run threads -- <customer-id> <thread-id>   # print one conversation
import { listCustomerIds, listThreads, getThread, getCustomer } from '../lib/store.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const all = process.argv.includes('--all');

if (args.length === 2) {
  const [cid, tid] = args;
  const t = await getThread(cid, tid);
  if (!t) {
    console.error('not found');
    process.exit(1);
  }
  console.log(`${t.meta.subject}  [${t.meta.status}]  (${t.meta.category})\n`);
  for (const m of t.messages) console.log(`--- ${m.from} · ${m.at}\n${m.body}\n`);
  process.exit(0);
}

for (const cid of await listCustomerIds()) {
  const c = await getCustomer(cid);
  if (!c) continue;
  for (const t of await listThreads(cid)) {
    if (!all && t.status !== 'open') continue;
    console.log(`${t.lastMessageAt}  ${c.profile.name} (${cid})  ${t.id}  [${t.status}]  ${t.subject}`);
  }
}
