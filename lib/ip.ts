import "server-only";
import { createHash } from "node:crypto";

/** Ekstrak IP klien dari headers permintaan HTTP. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return "127.0.0.1";
}

/** Hash SHA-256 IP + IP_HASH_SALT untuk privasi pelanggan (AGENTS.md §8.6). */
export function hashIp(ip: string, salt: string = process.env.IP_HASH_SALT || ""): string {
  return createHash("sha256").update(ip + salt).digest("hex");
}

export function getClientIpHash(req: Request): string {
  const ip = getClientIp(req);
  return hashIp(ip);
}
