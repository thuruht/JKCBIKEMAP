import type { D1Database, Fetcher, R2Bucket } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  KV: KVNamespace;
  ROUTE_CACHE: KVNamespace;
  SEND_EMAIL: any;
  AVATARS_BUCKET: R2Bucket;
  APP_URL?: string | undefined;
}
