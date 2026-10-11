import { auth } from "@/lib/auth";
import { collections, getNextSequence } from "@/lib/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const postId = Number(body?.postId);
        const durationSeconds = Number(body?.durationSeconds ?? 0);
        const sessionKeyRaw = String(body?.sessionKey ?? "").trim();

        if (!Number.isInteger(postId) || postId <= 0) {
            return NextResponse.json({ message: "Invalid post id" }, { status: 400 });
        }

        const headerStore = await headers();
        const session = await auth.api.getSession({ headers: headerStore });

        const ipAddress = headerStore.get("x-forwarded-for") ?? undefined;
        const sessionId = sessionKeyRaw || headerStore.get("x-vercel-id") || undefined;
        const safeDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
            ? Math.floor(durationSeconds)
            : 0;

        const existing = sessionId
            ? await collections.postViews.findOne(
                { postId, sessionId },
                { sort: { createdAt: -1 } }
            )
            : null;

        if (existing) {
            await collections.postViews.updateOne(
                { _id: existing._id },
                {
                    $set: {
                        durationSeconds: Math.max(existing.durationSeconds ?? 0, safeDuration),
                    },
                }
            );
        } else {
            const nextId = await getNextSequence("postViews");
            await collections.postViews.insertOne({
                id: nextId,
                postId,
                userId: session?.user?.id ?? null,
                sessionId: sessionId ?? null,
                ipAddress: ipAddress ?? null,
                durationSeconds: safeDuration,
                createdAt: new Date(),
            });
        }

        revalidatePath("/analytics");

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
