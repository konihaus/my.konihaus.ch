// Minimal S3 JSON store with optimistic concurrency (If-Match / If-None-Match).
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

let client;

function getClient() {
  if (client) return client;
  // Safe Swiss Cloud (or any S3-compatible storage): set S3_ENDPOINT (e.g. https://s3.ewstorage.ch) and S3_ACCESS_KEY_ID /
  // S3_SECRET_ACCESS_KEY. Without S3_ENDPOINT this talks to AWS S3 as before. (Vercel reserves the AWS_* names, hence S3_*.)
  const endpoint = (process.env.S3_ENDPOINT || '').trim();
  const config = { region: process.env.S3_REGION || (endpoint ? 'ch-zh1' : 'eu-central-2') };
  if (endpoint) {
    config.endpoint = endpoint;
    config.forcePathStyle = true; // https://host/bucket/key
    // Newer AWS SDKs add CRC32 checksums by default; many non-AWS services reject them.
    config.requestChecksumCalculation = 'WHEN_REQUIRED';
    config.responseChecksumValidation = 'WHEN_REQUIRED';
  }
  const keyId = (process.env.S3_ACCESS_KEY_ID || '').trim();
  const secret = (process.env.S3_SECRET_ACCESS_KEY || '').trim();
  if (keyId && secret) {
    config.credentials = { accessKeyId: keyId, secretAccessKey: secret };
  } else if (process.env.AWS_ROLE_ARN && !process.env.AWS_ACCESS_KEY_ID) {
    // Vercel OIDC federation: short-lived credentials, no stored keys.
    // Imported lazily so local development works without the package context.
    config.credentials = async (...args) => {
      const { awsCredentialsProvider } = await import('@vercel/functions/oidc');
      return awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN })(...args);
    };
  }
  // Otherwise the SDK default chain applies (env keys, profile, ...)
  client = new S3Client(config);
  return client;
}

// Test hook: inject a fake client.
export function _setClient(c) {
  client = c;
}

const Bucket = () => {
  const name = process.env.S3_BUCKET || process.env.S3_BUCKET_NAME;
  if (!name) throw new Error('S3_BUCKET is not set');
  return name;
};

export class ConflictError extends Error {
  constructor(msg = 'Precondition failed') {
    super(msg);
    this.name = 'ConflictError';
  }
}

const isNotFound = (e) =>
  e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
const isConflict = (e) =>
  e?.$metadata?.httpStatusCode === 412 ||
  e?.name === 'PreconditionFailed' ||
  e?.$metadata?.httpStatusCode === 409;

/** Returns { data, etag } or null when the object does not exist. */
export async function getJson(key) {
  try {
    const res = await getClient().send(new GetObjectCommand({ Bucket: Bucket(), Key: key }));
    const text = await res.Body.transformToString();
    return { data: JSON.parse(text), etag: res.ETag };
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

/**
 * Writes JSON.
 *  - { create: true }  -> only if the key does not exist yet (If-None-Match: *)
 *  - { ifMatch: etag } -> only if unchanged since read (If-Match)
 * Throws ConflictError on a failed precondition.
 */
export async function putJson(key, data, { create = false, ifMatch } = {}) {
  const params = {
    Bucket: Bucket(),
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  };
  if (create) params.IfNoneMatch = '*';
  // Safe Swiss Cloud (Ceph) accepts If-Match only without the quotes that GetObject puts around the ETag.
  if (ifMatch) params.IfMatch = String(ifMatch).replace(/"/g, '');
  try {
    const res = await getClient().send(new PutObjectCommand(params));
    return { etag: res.ETag };
  } catch (e) {
    if (isConflict(e)) throw new ConflictError();
    throw e;
  }
}

/** Read-modify-write with retry on conflict. `mutate(data) -> newData`. */
export async function updateJson(key, mutate, { retries = 10 } = {}) {
  for (let i = 0; i <= retries; i++) {
    const cur = await getJson(key);
    if (!cur) throw new Error(`Object not found: ${key}`);
    const next = await mutate(structuredClone(cur.data));
    try {
      await putJson(key, next, { ifMatch: cur.etag });
      return next;
    } catch (e) {
      if (!(e instanceof ConflictError) || i === retries) throw e;
      // jittered backoff so competing writers stop colliding
      await new Promise((r) => setTimeout(r, Math.random() * 25 * (i + 1)));
    }
  }
}

/** Deletes one object (used by scripts/s3-check.js to clean up its test key). */
export async function deleteKey(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: Bucket(), Key: key }));
}

/** Lists keys under a prefix (all pages). */
export async function listKeys(prefix) {
  const keys = [];
  let ContinuationToken;
  do {
    const res = await getClient().send(
      new ListObjectsV2Command({ Bucket: Bucket(), Prefix: prefix, ContinuationToken })
    );
    for (const o of res.Contents || []) keys.push(o.Key);
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

/** Lists immediate "sub-folders" under a prefix (e.g. thread ids). */
export async function listFolders(prefix) {
  const out = [];
  let ContinuationToken;
  do {
    const res = await getClient().send(
      new ListObjectsV2Command({
        Bucket: Bucket(),
        Prefix: prefix,
        Delimiter: '/',
        ContinuationToken,
      })
    );
    for (const p of res.CommonPrefixes || []) out.push(p.Prefix.slice(prefix.length).replace(/\/$/, ''));
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return out;
}
