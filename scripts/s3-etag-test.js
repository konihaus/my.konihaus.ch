// Diagnostic: which If-Match format does the storage accept?   node --env-file=.env scripts/s3-etag-test.js
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const endpoint = (process.env.S3_ENDPOINT || '').trim();
const s3 = new S3Client({
  region: process.env.S3_REGION || 'ch-zh1',
  ...(endpoint ? { endpoint, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' } : {}),
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});
const Bucket = process.env.S3_BUCKET || process.env.S3_BUCKET_NAME;
const Key = `portal-selftest/etag-${Date.now()}.json`;
const put = (extra) => s3.send(new PutObjectCommand({ Bucket, Key, Body: JSON.stringify({ t: Date.now() }), ContentType: 'application/json', ...extra }));
const status = (e) => `${e.name} (HTTP ${e.$metadata?.httpStatusCode})`;

try {
  const first = await put({});
  const got = await s3.send(new GetObjectCommand({ Bucket, Key }));
  const head = await s3.send(new HeadObjectCommand({ Bucket, Key }));
  console.log('ETag from PUT :', first.ETag);
  console.log('ETag from GET :', got.ETag);
  console.log('ETag from HEAD:', head.ETag);
  const raw = got.ETag;
  const variants = [
    ['as returned (with quotes)', raw],
    ['without quotes', raw.replace(/"/g, '')],
    ['ETag from PUT response', first.ETag],
    ['wildcard *', '*'],
  ];
  for (const [name, value] of variants) {
    try { await put({ IfMatch: value }); console.log(`PASS  If-Match ${name}`); }
    catch (e) { console.log(`FAIL  If-Match ${name}: ${status(e)}`); }
  }
  // stale value must be refused
  try { await put({ IfMatch: '"00000000000000000000000000000000"' }); console.log('WARN  a wrong ETag was accepted: If-Match is ignored'); }
  catch (e) { console.log(`PASS  wrong ETag refused: ${status(e)}`); }
} catch (e) {
  console.log('ERROR', status(e), e.message);
} finally {
  try { await s3.send(new DeleteObjectCommand({ Bucket, Key })); console.log('cleaned up'); } catch { console.log('could not delete', Key); }
}
