"use server";

import { auth } from "@/lib/auth";
import { invalidateCacheTags } from "@/lib/cache/redis-cache";
import { collections, getNextSequence } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

async function getSession() {
    return auth.api.getSession({
        headers: await headers(),
    });
}

async function requireSession() {
    const session = await getSession();

    if (!session?.user) {
        throw new Error("You must be logged in to do this action");
    }

    return session;
}

async function revalidatePostTagsById(postId: number, viewerId?: string) {
    const tags = ["posts", "feed:anon"];

    if (viewerId) {
        tags.push(`feed:${viewerId}`);
    }

    const post = await collections.posts.findOne(
        { id: postId },
        { projection: { slug: 1, authorId: 1 } }
    );

    if (post?.slug) {
        tags.push(`post:${post.slug}`);
    }

    if (post?.authorId) {
        tags.push(`feed:${post.authorId}`);
    }

    await invalidateCacheTags(tags);

    for (const tag of tags) {
        revalidateTag(tag, "max");
    }
}

export async function syncPostTags(postId: number, rawTagInput: string) {
    const tagsFromInput = rawTagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 10);

    const deduped = Array.from(new Set(tagsFromInput.map((item) => item.toLowerCase())));

    await collections.postTags.deleteMany({ postId });

    if (!deduped.length) {
        return;
    }

    for (const lowerTag of deduped) {
        const displayName = lowerTag
            .split(" ")
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");

        const tagSlug = slugify(lowerTag);

        let tag = await collections.tags.findOne({ slug: tagSlug });

        if (!tag) {
            const nextTagId = await getNextSequence("tags");
            await collections.tags.insertOne({
                id: nextTagId,
                name: displayName,
                slug: tagSlug,
                createdAt: new Date(),
            });
            tag = await collections.tags.findOne({ slug: tagSlug });
        }

        if (tag) {
            const nextPostTagId = await getNextSequence("postTags");
            await collections.postTags.insertOne({
                id: nextPostTagId,
                postId,
                tagId: tag.id,
                createdAt: new Date(),
            });
        }
    }
}

export async function togglePostReaction(
    postId: number,
    reactionType: "like" | "dislike",
    desiredState?: "like" | "dislike" | null
) {
    try {
        const session = await requireSession();
        const pId = Number(postId);

        const existing = await collections.postReactions.findOne({
            postId: pId,
            userId: session.user.id,
        });

        let finalReaction: "like" | "dislike" | null = null;

        if (desiredState !== undefined) {
            finalReaction = desiredState;
            if (desiredState === null) {
                if (existing) {
                    await collections.postReactions.deleteOne({ _id: existing._id });
                }
            } else if (!existing) {
                const nextId = await getNextSequence("postReactions");
                await collections.postReactions.insertOne({
                    id: nextId,
                    postId: pId,
                    userId: session.user.id,
                    type: desiredState,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            } else if (existing.type !== desiredState) {
                await collections.postReactions.updateOne(
                    { _id: existing._id },
                    {
                        $set: {
                            type: desiredState,
                            updatedAt: new Date(),
                        },
                    }
                );
            }
        } else {
            if (!existing) {
                const nextId = await getNextSequence("postReactions");
                await collections.postReactions.insertOne({
                    id: nextId,
                    postId: pId,
                    userId: session.user.id,
                    type: reactionType,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                finalReaction = reactionType;
            } else if (existing.type === reactionType) {
                await collections.postReactions.deleteOne({ _id: existing._id });
                finalReaction = null;
            } else {
                await collections.postReactions.updateOne(
                    { _id: existing._id },
                    {
                        $set: {
                            type: reactionType,
                            updatedAt: new Date(),
                        },
                    }
                );
                finalReaction = reactionType;
            }
        }

        await revalidatePostTagsById(pId, session.user.id);
        revalidatePath("/");
        revalidatePath("/analytics");
        return { success: true, reactionType: finalReaction };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to update reaction" };
    }
}

export async function toggleBookmark(postId: number, desiredState?: boolean) {
    try {
        const session = await requireSession();
        const pId = Number(postId);

        const existing = await collections.bookmarks.findOne({
            postId: pId,
            userId: session.user.id,
        });

        let isBookmarked = false;
        if (desiredState !== undefined) {
            isBookmarked = desiredState;
            if (!desiredState && existing) {
                await collections.bookmarks.deleteOne({ _id: existing._id });
            } else if (desiredState && !existing) {
                const nextId = await getNextSequence("bookmarks");
                await collections.bookmarks.insertOne({
                    id: nextId,
                    postId: pId,
                    userId: session.user.id,
                    createdAt: new Date(),
                });
            }
        } else {
            if (existing) {
                await collections.bookmarks.deleteOne({ _id: existing._id });
                isBookmarked = false;
            } else {
                const nextId = await getNextSequence("bookmarks");
                await collections.bookmarks.insertOne({
                    id: nextId,
                    postId: pId,
                    userId: session.user.id,
                    createdAt: new Date(),
                });
                isBookmarked = true;
            }
        }

        await revalidatePostTagsById(pId, session.user.id);
        revalidatePath("/analytics");
        return { success: true, isBookmarked };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to update bookmark" };
    }
}

export async function toggleAuthorSubscription(authorId: string, desiredState?: boolean) {
    try {
        const session = await requireSession();

        if (session.user.id === authorId) {
            return { success: false, message: "You cannot subscribe to yourself" };
        }

        const existing = await collections.authorSubscriptions.findOne({
            authorId,
            userId: session.user.id,
        });

        let isSubscribed = false;
        if (desiredState !== undefined) {
            isSubscribed = desiredState;
            if (!desiredState && existing) {
                await collections.authorSubscriptions.deleteOne({ _id: existing._id });
            } else if (desiredState && !existing) {
                const nextId = await getNextSequence("authorSubscriptions");
                await collections.authorSubscriptions.insertOne({
                    id: nextId,
                    authorId,
                    userId: session.user.id,
                    notifyOnPost: true,
                    createdAt: new Date(),
                });
            }
        } else {
            if (existing) {
                await collections.authorSubscriptions.deleteOne({ _id: existing._id });
                isSubscribed = false;
            } else {
                const nextId = await getNextSequence("authorSubscriptions");
                await collections.authorSubscriptions.insertOne({
                    id: nextId,
                    authorId,
                    userId: session.user.id,
                    notifyOnPost: true,
                    createdAt: new Date(),
                });
                isSubscribed = true;
            }
        }

        await invalidateCacheTags([`feed:${session.user.id}`, "posts"]);
        revalidateTag(`feed:${session.user.id}`, "max");
        revalidateTag("posts", "max");
        revalidatePath("/analytics");
        return { success: true, isSubscribed };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to update subscription" };
    }
}

export async function toggleAuthorNotify(authorId: string) {
    try {
        const session = await requireSession();

        const existing = await collections.authorSubscriptions.findOne({
            authorId,
            userId: session.user.id,
        });

        if (!existing) {
            return { success: false, message: "Subscribe to the author first" };
        }

        await collections.authorSubscriptions.updateOne(
            { _id: existing._id },
            { $set: { notifyOnPost: !existing.notifyOnPost } }
        );

        await invalidateCacheTags([`feed:${session.user.id}`]);
        revalidateTag(`feed:${session.user.id}`, "max");
        revalidatePath("/analytics");
        return { success: true, notifyOnPost: !existing.notifyOnPost };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to update notification setting" };
    }
}

export async function markPostAsNotInterested(postId: number) {
    try {
        const session = await requireSession();
        const pId = Number(postId);

        const existing = await collections.notInterestedPosts.findOne({
            postId: pId,
            userId: session.user.id,
        });

        if (!existing) {
            const nextId = await getNextSequence("notInterestedPosts");
            await collections.notInterestedPosts.insertOne({
                id: nextId,
                postId: pId,
                userId: session.user.id,
                createdAt: new Date(),
            });
        }

        await revalidatePostTagsById(pId, session.user.id);
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to mark not interested" };
    }
}

export async function reportPost(postId: number, reason: string) {
    try {
        const session = await requireSession();
        const pId = Number(postId);

        const trimmed = reason.trim();
        if (!trimmed) {
            return { success: false, message: "Please provide a reason" };
        }

        const nextId = await getNextSequence("postReports");
        await collections.postReports.insertOne({
            id: nextId,
            postId: pId,
            userId: session.user.id,
            reason: trimmed,
            status: "open",
            createdAt: new Date(),
        });

        const existingHidden = await collections.notInterestedPosts.findOne({
            postId: pId,
            userId: session.user.id,
        });

        if (!existingHidden) {
            const hiddenId = await getNextSequence("notInterestedPosts");
            await collections.notInterestedPosts.insertOne({
                id: hiddenId,
                postId: pId,
                userId: session.user.id,
                createdAt: new Date(),
            });
        }

        await revalidatePostTagsById(pId, session.user.id);
        revalidatePath("/");
        revalidatePath("/search");

        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to report post" };
    }
}

export async function recordPostShare(postId: number, channel = "copy_link") {
    try {
        const session = await getSession();
        const pId = Number(postId);

        const nextId = await getNextSequence("postShares");
        await collections.postShares.insertOne({
            id: nextId,
            postId: pId,
            userId: session?.user?.id ?? null,
            channel,
            createdAt: new Date(),
        });

        await revalidatePostTagsById(pId, session?.user?.id);
        revalidatePath("/analytics");
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to track share" };
    }
}

export async function recordPostView(postId: number, sessionId?: string, ipAddress?: string) {
    try {
        const session = await getSession();
        const pId = Number(postId);

        const nextId = await getNextSequence("postViews");
        await collections.postViews.insertOne({
            id: nextId,
            postId: pId,
            userId: session?.user?.id ?? null,
            sessionId: sessionId ?? null,
            ipAddress: ipAddress ?? null,
            durationSeconds: 0,
            createdAt: new Date(),
        });

        await revalidatePostTagsById(pId, session?.user?.id);
        revalidatePath("/analytics");
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to track view" };
    }
}

export async function addComment(postId: number, content: string, parentId?: number) {
    try {
        const session = await requireSession();
        const pId = Number(postId);

        const trimmed = content.trim();
        if (!trimmed) {
            return { success: false, message: "Comment cannot be empty" };
        }

        const post = await collections.posts.findOne({ id: pId });

        if (!post) {
            return { success: false, message: "Post not found" };
        }

        const blockedWords = await collections.authorBlockWords.find({
            authorId: post.authorId,
        }).toArray();

        const lowered = trimmed.toLowerCase();
        const matchedBlockedWord = blockedWords.find((item) => lowered.includes(item.word.toLowerCase()));
        const commentStatus = matchedBlockedWord ? "rejected" : "approved";

        const nextId = await getNextSequence("comments");
        await collections.comments.insertOne({
            id: nextId,
            postId: pId,
            userId: session.user.id,
            parentId: parentId ? Number(parentId) : null,
            content: trimmed,
            status: commentStatus,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await revalidatePostTagsById(pId, session.user.id);
        revalidatePath(`/post`);
        revalidatePath("/analytics");
        return {
            success: true,
            message: matchedBlockedWord
                ? "Comment submitted but held by moderation filter"
                : "Comment added",
        };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to add comment" };
    }
}

export async function deleteComment(commentId: number) {
    try {
        const session = await requireSession();
        const cId = Number(commentId);

        const comment = await collections.comments.findOne({ id: cId });

        if (!comment) {
            return { success: false, message: "Comment not found" };
        }

        const post = await collections.posts.findOne({ id: comment.postId });

        if (!post || post.authorId !== session.user.id) {
            return { success: false, message: "Only the post author can remove comments" };
        }

        await collections.comments.deleteMany({
            $or: [{ id: cId }, { parentId: cId }],
        });

        await revalidatePostTagsById(comment.postId, session.user.id);
        if (post?.slug) {
            revalidatePath(`/post/${post.slug}`);
        }
        revalidatePath("/analytics");
        return { success: true, message: "Comment removed" };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to delete comment" };
    }
}

export async function moderateComment(commentId: number, status: "approved" | "rejected") {
    try {
        const session = await requireSession();
        const cId = Number(commentId);

        const comment = await collections.comments.findOne({ id: cId });

        if (!comment) {
            return { success: false, message: "Comment not found" };
        }

        const post = await collections.posts.findOne({ id: comment.postId });

        if (!post || post.authorId !== session.user.id) {
            return { success: false, message: "Only post author can moderate comments" };
        }

        await collections.comments.updateOne(
            { id: cId },
            {
                $set: {
                    status,
                    updatedAt: new Date(),
                },
            }
        );

        await revalidatePostTagsById(comment.postId, session.user.id);
        revalidatePath("/analytics");
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to moderate comment" };
    }
}

export async function addAuthorBlockedWord(word: string) {
    try {
        const session = await requireSession();
        const cleaned = word.trim().toLowerCase();

        if (!cleaned || cleaned.length < 2) {
            return { success: false, message: "Blocked word must be at least 2 characters" };
        }

        const existing = await collections.authorBlockWords.findOne({
            authorId: session.user.id,
            word: cleaned,
        });

        if (!existing) {
            const nextId = await getNextSequence("authorBlockWords");
            await collections.authorBlockWords.insertOne({
                id: nextId,
                authorId: session.user.id,
                word: cleaned,
                createdAt: new Date(),
            });
        }

        revalidatePath("/moderation");
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to add blocked word" };
    }
}

export async function removeAuthorBlockedWord(blockWordId: number) {
    try {
        const session = await requireSession();
        const bId = Number(blockWordId);

        await collections.authorBlockWords.deleteOne({
            id: bId,
            authorId: session.user.id,
        });

        revalidatePath("/moderation");
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to remove blocked word" };
    }
}

export async function reviewPostReport(reportId: number, status: "open" | "reviewed") {
    try {
        const session = await requireSession();
        const rId = Number(reportId);

        const report = await collections.postReports.findOne({ id: rId });

        if (!report) {
            return { success: false, message: "Report not found" };
        }

        const post = await collections.posts.findOne({ id: report.postId });

        if (!post || post.authorId !== session.user.id) {
            return { success: false, message: "Report not found" };
        }

        await collections.postReports.updateOne(
            { id: rId },
            { $set: { status } }
        );

        revalidatePath("/moderation");
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to review report" };
    }
}

export async function updateNotificationPreferences(values: {
    notifyCommentsOnMyPosts: boolean;
    notifyNewPostsFromFollowedAuthors: boolean;
    notifyRepliesToMyComments: boolean;
}) {
    try {
        const session = await requireSession();

        const existing = await collections.notificationPreferences.findOne({
            userId: session.user.id,
        });

        if (existing) {
            await collections.notificationPreferences.updateOne(
                { _id: existing._id },
                {
                    $set: {
                        ...values,
                        updatedAt: new Date(),
                    },
                }
            );
        } else {
            const nextId = await getNextSequence("notificationPreferences");
            await collections.notificationPreferences.insertOne({
                id: nextId,
                userId: session.user.id,
                ...values,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        revalidatePath("/notifications");
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Failed to update notification preferences" };
    }
}
