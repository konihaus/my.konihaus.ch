// Checks that the configured object storage (Safe Swiss Cloud, AWS, ...) behaves the way the portal needs:
// the portal relies on conditional writes (If-None-Match: * = "create only if new", If-Match = "write only if unchanged").
//   npm run s3check
// Writes one small test object (portal-selftest/<time>.json) and deletes it again.
import { getJson, putJson, deleteKey, ConflictError } from '../lib/s3.js';

const key = `portal-selftest/${Date.now()}.json`;
const results = [];
const check = (name, ok, hint = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + hint}`); };
const conflicts = async (fn) => { try { await fn(); return false; } catch (e) { if (e instanceof ConflictError) return true; throw e; } };

try {
  await putJson(key, { n: 1 }, { create: true });
  check('create a new object (If-None-Match: *)', true);

  check('creating the same key again is refused', await conflicts(() => putJson(key, { n: 99 }, { create: true })),
    'storage ignores If-None-Match: two requests could both "create" the same login link or message');

  const first = await getJson(key);
  let okMatch = true;
  try { await putJson(key, { n: 2 }, { ifMatch: first.etag }); } catch (e) { okMatch = false; console.log('      If-Match error:', e.name, e.$metadata?.httpStatusCode || ''); }
  check('update with the current ETag (If-Match) works', okMatch, 'storage rejects a correct If-Match (ETag format?): updates would fail');

  if (okMatch) {
    check('update with a stale ETag is refused', await conflicts(() => putJson(key, { n: 3 }, { ifMatch: first.etag })),
      'storage ignores If-Match: concurrent updates could overwrite each other (e.g. a login link used twice)');
  }
} catch (e) {
  console.log('ERROR', e.name, e.message);
  results.push(false);
} finally {
  try { await deleteKey(key); console.log('cleaned up test object'); } catch (e) { console.log('could not delete', key, '-', e.name); }
}
console.log(results.every(Boolean) ? '\nAll good: the portal can use this storage.' : '\nSome checks failed. Do not go live with this storage before this is solved.');
process.exit(results.every(Boolean) ? 0 : 1);
