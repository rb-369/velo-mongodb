import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { client, db } from "./db";
import { normalizeUrl } from "./utils";

function extractHost(raw?: string | null): string {
    const normalized = normalizeUrl(raw);
    if (!normalized) return "";
    try {
        return new URL(normalized).host;
    } catch {
        return "";
    }
}

function getCandidateUrls(): string[] {
    const rawCandidates = [
        process.env.BETTER_AUTH_URL,
        process.env.NEXT_PUBLIC_BASE_URL,
        process.env.NEXT_PUBLIC_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.NEXT_PUBLIC_SITE_URL,
        process.env.BASE_URL,
        process.env.APP_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
        process.env.VERCEL_URL,
        process.env.VERCEL_BRANCH_URL,
    ];

    return rawCandidates
        .map((candidate) => normalizeUrl(candidate))
        .filter((url): url is string => Boolean(url));
}

function resolvePrimaryBaseUrl(): string {
    const candidates = getCandidateUrls();

    if (process.env.NODE_ENV === "production") {
        const prodCandidate = candidates.find(
            (url) => !url.includes("localhost") && !url.includes("127.0.0.1")
        );
        if (prodCandidate) {
            return prodCandidate;
        }
        return "https://velo-blogs1.vercel.app";
    }

    return candidates[0] || "http://localhost:3000";
}

const primaryBaseUrl = resolvePrimaryBaseUrl();

const candidateHosts = getCandidateUrls()
    .map((url) => extractHost(url))
    .filter(Boolean);

const allowedHosts = Array.from(
    new Set([
        "*.vercel.app",
        "velo-blogs1.vercel.app",
        "velo-blogs.vercel.app",
        "localhost:*",
        "localhost",
        "127.0.0.1:*",
        "127.0.0.1",
        extractHost(primaryBaseUrl),
        ...candidateHosts,
    ])
).filter(Boolean);

const candidateOrigins = getCandidateUrls();
const trustedOrigins = Array.from(
    new Set([
        "https://*.vercel.app",
        "*.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:*",
        "https://velo-blogs1.vercel.app",
        "https://velo-blogs.vercel.app",
        primaryBaseUrl,
        ...candidateOrigins,
    ])
).filter(Boolean);

export const auth = betterAuth({
    appName: "VELO",
    secret: process.env.BETTER_AUTH_SECRET || "BETTER_AUTH_SECRET",
    baseURL: {
        allowedHosts,
        protocol: process.env.NODE_ENV === "production" ? "https" : "auto",
        fallback: primaryBaseUrl,
    },
    trustedOrigins,
    database: mongodbAdapter(db, {
        client,
        usePlural: true,
    }),
    databaseHooks: {
        user: {
            create: {
                after: async (user) => {
                    try {
                        const { collections } = await import("./db");
                        const { ObjectId } = await import("mongodb");
                        if (user && user.id) {
                            const filter: any = ObjectId.isValid(user.id)
                                ? { $or: [{ _id: new ObjectId(user.id) }, { _id: user.id }] }
                                : { _id: user.id };
                            await collections.users.updateOne(filter, { $set: { id: user.id } });
                        }
                    } catch (err) {
                        console.error("[auth] Database hook user.create error:", err);
                    }
                },
            },
        },
    },
    socialProviders: {
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? {
                  google: {
                      clientId: process.env.GOOGLE_CLIENT_ID,
                      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                  },
              }
            : {}),
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        minPasswordLength: 6,
        maxPasswordLength: 128,
        autoSignIn: false,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5,
        },
        disableSessionRefresh: true,
    },
    advanced: {
        trustedProxyHeaders: true,
        useSecureCookies: process.env.NODE_ENV === "production",
        defaultCookieAttributes: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        },
    },
});