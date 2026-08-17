/**
 * Storage helpers against the app's own S3-compatible bucket (EU) — replaces
 * the Manus platform storage module with an API-compatible implementation.
 *
 * Uploads go straight to the bucket; downloads keep returning
 * `/manus-storage/{key}` paths served via 307 redirect (see
 * server/_core/storageProxy.ts), so URLs already stored in the database and
 * hardcoded in the client keep working unchanged.
 *
 * Mode is picked from the environment (first match wins):
 *
 *   S3_ENDPOINT + S3_REGION + S3_BUCKET + S3_ACCESS_KEY + S3_SECRET_KEY
 *     → direct S3 client against your own bucket (the escape hatch: your
 *       credentials, your bucket, no Sovyn in the path). Optional
 *       S3_KEY_PREFIX: folder every object of THIS deployment lives under,
 *       for deployments that share a bucket; unset for a bucket the
 *       deployment has to itself.
 *
 *   SOVYN_FORGE_URL + SOVYN_FORGE_TOKEN
 *     → Sovyn Forge gateway (default: injected at provision). The gateway
 *       presigns GET/PUT URLs for the bucket bound to this deployment — the
 *       platform's storage credentials never live in this app's env, and
 *       file bytes still flow directly between app and storage.
 *
 * Direct env deliberately wins: apps carrying both (provisioned before the
 * gateway, or bringing their own bucket) keep exactly their current path.
 */

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface S3Config {
  client: S3Client;
  bucket: string;
  /** Normalized: either "" or a single-slash-terminated folder. */
  prefix: string;
}

let cached: S3Config | null = null;

/**
 * Folder inside the bucket this deployment owns.
 *
 * Deployments that SHARE one bucket (a staging environment alongside
 * production) each get their own prefix, so neither writes among nor reads the
 * other's files. Empty by default, which is what every single-deployment app
 * has always been — existing objects keep their keys.
 */
function normalizePrefix(raw: string | undefined): string {
  const folder = (raw ?? "").trim().replace(/^\/+|\/+$/g, "");
  return folder ? `${folder}/` : "";
}

interface GatewayConfig {
  url: string;
  token: string;
}

/**
 * The Sovyn Forge gateway binding, or null. Only consulted when the direct
 * S3 env is incomplete — see the mode order in the header.
 */
function getGatewayConfig(): GatewayConfig | null {
  const url = process.env.SOVYN_FORGE_URL;
  const token = process.env.SOVYN_FORGE_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

function hasDirectS3Env(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_REGION &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY &&
      process.env.S3_SECRET_KEY,
  );
}

function getS3Config(): S3Config {
  if (cached) return cached;

  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;

  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Storage config missing: set SOVYN_FORGE_URL + SOVYN_FORGE_TOKEN (gateway) or S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY (direct)",
    );
  }

  cached = {
    bucket,
    prefix: normalizePrefix(process.env.S3_KEY_PREFIX),
    client: new S3Client({
      endpoint,
      region,
      // Path-style keeps bucket names free of DNS constraints on
      // S3-compatible hosts.
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
  return cached;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/**
 * Ask the gateway to presign one URL. The deployment's bucket (and, for
 * shared buckets, its key prefix) hang off the token server-side — this app
 * cannot name a bucket, so it cannot reach another one.
 */
async function gatewayPresign(
  gateway: GatewayConfig,
  op: "get" | "put",
  key: string,
  contentType?: string,
): Promise<string> {
  const res = await fetch(`${gateway.url}/forge/v1/storage/presign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gateway.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ op, key, ...(contentType ? { contentType } : {}) }),
  });
  if (!res.ok) {
    // The gateway explains itself (e.g. a 429 names the cap and its reset
    // time) — surface that instead of a bare status code.
    const detail = await res.text().catch(() => "");
    throw new Error(
      `[storage] Sovyn Forge gateway responded HTTP ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    );
  }
  const body = (await res.json()) as { url?: unknown };
  if (typeof body.url !== "string" || !body.url) {
    throw new Error("[storage] Sovyn Forge gateway returned no presigned URL");
  }
  return body.url;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

/**
 * The returned `key` and `url` stay PREFIX-FREE: the prefix belongs to the
 * deployment, not to the file reference. A key persisted in the database
 * therefore always resolves against the objects of whatever deployment reads it
 * — which is what keeps a database copied between deployments consistent.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data) : data;

  if (!hasDirectS3Env()) {
    const gateway = getGatewayConfig();
    if (gateway) {
      const presigned = await gatewayPresign(gateway, "put", key, contentType);
      // The content type is part of the signature — the upload must send
      // exactly what was presigned or storage rejects it.
      const res = await fetch(presigned, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        // Re-wrapped, not passed through: since TypeScript 5.7 a `Buffer` is
        // typed `Buffer<ArrayBufferLike>`, which no longer satisfies the
        // `ArrayBufferView<ArrayBuffer>` that `BodyInit` asks for — `tsc`
        // rejects it even though fetch accepts it at runtime. Copying into a
        // plain `Uint8Array` is the one spelling that compiles on every
        // TypeScript version an imported app might pin. The copy costs one
        // extra buffer of an upload that is already fully in memory.
        body: new Uint8Array(body),
      });
      if (!res.ok) {
        throw new Error(
          `[storage] upload rejected with HTTP ${res.status}`,
        );
      }
      return { key, url: `/manus-storage/${key}` };
    }
  }

  const { client, bucket, prefix } = getS3Config();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${prefix}${key}`,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);

  if (!hasDirectS3Env()) {
    const gateway = getGatewayConfig();
    if (gateway) return gatewayPresign(gateway, "get", key);
  }

  const { client, bucket, prefix } = getS3Config();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: `${prefix}${key}` }),
    { expiresIn: 3600 },
  );
}
