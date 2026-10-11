import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {

  return text
  .toLowerCase()
  .replace(/[^a-z0-9 ]+/g, "")
  .replace(/ +/g, "-")
  //converts space to hyphens "-" eg. Next js 15 -> Next-js-15 

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