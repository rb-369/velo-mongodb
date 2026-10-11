import { createAuthClient } from "better-auth/react";
import { normalizeUrl } from "./utils";

function resolveAuthBaseUrl(): string {
    if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin;
    }

    const rawCandidates = [
        process.env.NEXT_PUBLIC_BASE_URL,
        process.env.NEXT_PUBLIC_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.NEXT_PUBLIC_SITE_URL,
        process.env.BETTER_AUTH_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
        process.env.VERCEL_URL,
        process.env.BASE_URL,
    ];

    for (const candidate of rawCandidates) {
        const normalized = normalizeUrl(candidate);
        if (normalized) {
            return normalized;
        }
    }

    return "https://velo-blogs1.vercel.app";
}

export const authClient = createAuthClient({
    baseURL: resolveAuthBaseUrl(),
});

export const {signUp, signIn, signOut, useSession} = authClient;