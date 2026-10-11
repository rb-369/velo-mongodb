import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  const cleaned = (text ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || `post-${Date.now().toString(36)}`;
}

export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function estimateReadTime(content: string): string {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

export function toPlainObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (Array.isArray(obj)) return obj.map((item) => toPlainObject(item)) as any;
  if (typeof obj === "object") {
    if ((obj as any)._bsontype === "ObjectID" || (obj as any).buffer) {
      return undefined as any;
    }
    const plain: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "_id") continue;
      const cleaned = toPlainObject(value);
      if (cleaned !== undefined) {
        plain[key] = cleaned;
      }
    }
    return plain as T;
  }
  return obj;
}

/**
 * Normalizes any URL string into a valid absolute URL with protocol (https:// or http://).
 * Strips quotes, handles missing protocols, trims trailing slashes, and never throws.
 */
export function normalizeUrl(raw?: string | null): string {
  if (!raw) return "";
  let trimmed = String(raw).trim();
  if (!trimmed) return "";

  // Strip wrapping quotes
  trimmed = trimmed.replace(/^["']|["']$/g, "").trim();
  if (!trimmed) return "";

  // Ensure protocol
  if (!/^https?:\/\//i.test(trimmed)) {
    if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed) || trimmed.startsWith("localhost")) {
      trimmed = `http://${trimmed}`;
    } else {
      trimmed = `https://${trimmed}`;
    }
  }

  // Strip trailing slashes
  trimmed = trimmed.replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return "";
  }
}

/**
 * Returns the best canonical site URL for metadata, SEO, and fallbacks.
 */
export function getSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.BETTER_AUTH_URL,
    process.env.BASE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate);
    if (normalized && !normalized.includes("localhost")) {
      return normalized;
    }
  }

  if (process.env.NODE_ENV === "production") {
    return "https://velo-blogs1.vercel.app";
  }

  return "http://localhost:3000";
}