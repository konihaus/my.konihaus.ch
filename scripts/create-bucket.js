// Creates the private bucket for the portal on the configured S3-compatible storage (Safe Swiss Cloud).
//   node --env-file=.env scripts/create-bucket.js            -> creates the bucket named in S3_BUCKET
//   node --env-file=.env scripts/create-bucket.js my-name    -> creates a bucket with another name
// If your provider does not allow bucket creation over the S3 API, create it in the Cloud Services Portal instead.
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const endpoint = (process.env.S3_ENDPOINT || '').trim();
const name = process.argv[2] || process.env.S3_BUCKET;
if (!name) { console.error('Give a bucket name: node --env-file=.env scripts/create-bucket.js konihaus-portal'); process.exit(1); }
const s3 = new S3Client({
  region: process.env.S3_REGION || 'ch-zh1',
  ...(endpoint ? { endpoint, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' } : {}),
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});
console.log(`Endpoint ${endpoint || 'aws'}, region ${process.env.S3_REGION || 'ch-zh1'}, bucket "${name}"`);
try {
  await s3.send(new CreateBucketCommand({ Bucket: name })); // no ACL given: buckets are private by default
  console.log('Created.');
} catch (e) {
  if (e.name === 'BucketAlreadyOwnedByYou') console.log('Bucket already exists and belongs to you, nothing to do.');
  else if (e.name === 'BucketAlreadyExists') { console.error('The name is already taken by another account. Pick another name, e.g. konihaus-portal-ch.'); process.exit(1); }
  else { console.error(`Could not create it: ${e.name} (HTTP ${e.$metadata?.httpStatusCode}) ${e.message}\nIf this is a permission error, create the bucket in the Safe Swiss Cloud portal (Object Storage -> Buckets) instead.`); process.exit(1); }
}
try { await s3.send(new HeadBucketCommand({ Bucket: name })); console.log('Bucket is reachable with your keys.'); } catch (e) { console.error('Created, but not reachable with these keys:', e.name); process.exit(1); }
console.log(`\nNext: set S3_BUCKET=${name} in .env and in the Vercel project, then run: npm run s3check`);
