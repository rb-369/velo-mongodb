"use server";

import { auth } from "@/lib/auth";
import { collections, getNextSequence } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { invalidateCacheTags } from "@/lib/cache/redis-cache";
import { syncPostTags } from "./social-actions";
import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

async function invalidatePostTags(options: { slug?: string; authorId?: string }) {
    const tags = ["posts", "feed:anon"];

    if (options.slug) {
        tags.push(`post:${options.slug}`);
    }

    if (options.authorId) {
        tags.push(`feed:${options.authorId}`);
    }

    await invalidateCacheTags(tags);

    for (const tag of tags) {
        revalidateTag(tag, "max");
    }
}

function isValidCoverImage(value: string): boolean {
    if (!value) return true;
    if (value.startsWith("/") || value.startsWith("/api/")) {
        return true;
    }

    if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value)) {
        return true;
    }

    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

export async function createPost(formData: FormData) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session || !session?.user) {
            return {
                success: false,
                message: "You must be logged in to create a post"
            };
        }

        const title = String(formData.get("title") ?? "").trim();
        const description = String(formData.get("description") ?? "").trim();
        const category = String(formData.get("category") ?? "General").trim() || "General";
        const tagInput = String(formData.get("tags") ?? "").trim();
        const coverImageRaw = String(formData.get("coverImage") ?? "").trim();
        const content = String(formData.get("content") ?? "").trim();
        const coverImage = coverImageRaw ? coverImageRaw : null;
        const publishMode = String(formData.get("publishMode") ?? "publish").trim();
        const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();

        if (!title) {
            return {
                success: false,
                message: "You must give a title"
            };
        } else if (!description) {
            return {
                success: false,
                message: "You must give some description"
            };
        } else if (!content) {
            return {
                success: false,
                message: "You must give some content"
            };
        } else if (coverImageRaw) {
            if (!isValidCoverImage(coverImageRaw)) {
                return {
                    success: false,
                    message: "Cover image must be a valid URL or uploaded image"
                };
            }
        }

        const slug = slugify(title);
        const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;

        if (publishMode === "schedule" && (!scheduledAt || Number.isNaN(scheduledAt.getTime()))) {
            return {
                success: false,
                message: "Please provide a valid schedule date"
            };
        }

        const isDraft = publishMode === "draft";
        const isScheduled = publishMode === "schedule";
        const finalStatus = isDraft ? "draft" : isScheduled ? "scheduled" : "published";
        const shouldPublishNow = finalStatus === "published";

        const existingPost = await collections.posts.findOne({ slug });

        if (existingPost) {
            return {
                success: false,
                message: "A post with the same title already exists! Pls try with a different one"
            };
        }

        const nextId = await getNextSequence("posts");

        const insertedPost = {
            id: nextId,
            title,
            description,
            category,
            content,
            coverImage,
            slug,
            status: finalStatus,
            published: shouldPublishNow,
            scheduledAt: isScheduled ? scheduledAt : null,
            publishedAt: shouldPublishNow ? new Date() : null,
            authorId: session.user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await collections.posts.insertOne(insertedPost);
        await syncPostTags(nextId, tagInput);

        await invalidatePostTags({ slug, authorId: session.user.id });
        revalidatePath("/");
        revalidatePath(`/post/${slug}`);
        revalidatePath("/profile");
        revalidatePath("/following");
        revalidatePath("/analytics");

        return {
            success: true,
            message: "Post created successfully",
            slug
        };

    } catch (e) {
        console.log(e);

        return {
            success: false,
            message: "Failed to create Post! :( " + e
        };
    }
}

export async function updatePost(postId: number, formData: FormData) {
    try {
        const pId = Number(postId);
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session || !session.user) {
            return {
                success: false,
                message: "You must be logged in to edit the post"
            };
        }

        const title = String(formData.get("title") ?? "").trim();
        const description = String(formData.get("description") ?? "").trim();
        const category = String(formData.get("category") ?? "General").trim() || "General";
        const tagInput = String(formData.get("tags") ?? "").trim();
        const coverImageRaw = String(formData.get("coverImage") ?? "").trim();
        const content = String(formData.get("content") ?? "").trim();
        const coverImage = coverImageRaw ? coverImageRaw : null;
        const publishMode = String(formData.get("publishMode") ?? "publish").trim();
        const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();

        if (!title) {
            return {
                success: false,
                message: "You must give a title"
            };
        } else if (!description) {
            return {
                success: false,
                message: "You must give some description"
            };
        } else if (!content) {
            return {
                success: false,
                message: "You must give some content"
            };
        } else if (coverImageRaw) {
            if (!isValidCoverImage(coverImageRaw)) {
                return {
                    success: false,
                    message: "Cover image must be a valid URL or uploaded image"
                };
            }
        }

        const slug = slugify(title);
        const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;

        if (publishMode === "schedule" && (!scheduledAt || Number.isNaN(scheduledAt.getTime()))) {
            return {
                success: false,
                message: "Please provide a valid schedule date"
            };
        }

        const isDraft = publishMode === "draft";
        const isScheduled = publishMode === "schedule";
        const finalStatus = isDraft ? "draft" : isScheduled ? "scheduled" : "published";
        const shouldPublishNow = finalStatus === "published";

        const exists = await collections.posts.findOne({ slug, id: { $ne: pId } });

        if (exists) {
            return {
                success: false,
                message: "A post with the same title already exists! Pls try with a different one"
            };
        }

        const updatedPost = await collections.posts.findOne({ id: pId });

        if (!updatedPost || updatedPost.authorId !== session.user.id) {
            return {
                success: false,
                message: "Only owners of the post can edit this!!"
            };
        }

        const existingPostTags = await collections.postTags.find({ postId: pId }).toArray();
        const tagIds = existingPostTags.map((pt) => pt.tagId);
        const existingTags = await collections.tags.find({ id: { $in: tagIds } }).toArray();
        const existingTagNames = existingTags.map((t) => t.name).join(", ");

        const revId = await getNextSequence("postRevisions");
        await collections.postRevisions.insertOne({
            id: revId,
            postId: pId,
            editorId: session.user.id,
            title: updatedPost.title,
            description: updatedPost.description,
            category: updatedPost.category,
            coverImage: updatedPost.coverImage,
            content: updatedPost.content,
            slug: updatedPost.slug,
            tagsSnapshot: existingTagNames,
            createdAt: new Date(),
        });

        await collections.posts.updateOne(
            { id: pId },
            {
                $set: {
                    title,
                    description,
                    category,
                    content,
                    coverImage,
                    slug,
                    status: finalStatus,
                    published: shouldPublishNow,
                    scheduledAt: isScheduled ? scheduledAt : null,
                    publishedAt: shouldPublishNow ? new Date() : updatedPost.publishedAt,
                    updatedAt: new Date(),
                },
            }
        );

        await syncPostTags(pId, tagInput);

        await invalidatePostTags({ slug, authorId: session.user.id });
        if (updatedPost.slug !== slug) {
            await invalidateCacheTags([`post:${updatedPost.slug}`]);
            revalidateTag(`post:${updatedPost.slug}`, "max");
        }
        revalidatePath("/");
        revalidatePath(`/post/${slug}`);
        revalidatePath("/profile");
        revalidatePath("/following");
        revalidatePath("/analytics");

        return {
            success: true,
            message: "Post Edited Successfully!: )",
            slug,
        };
    } catch (e) {
        console.log(e, "Failed to edit");

        return {
            success: false,
            message: "Failed to Edit Post! :( " + e
        };
    }
}

export async function deletePost(postId: number) {
    try {
        const pId = Number(postId);
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session || !session.user) {
            return {
                success: false,
                message: "You must be logged in to Delete the post"
            };
        }

        const delPost = await collections.posts.findOne({ id: pId });

        if (!delPost) {
            return {
                success: false,
                message: "Post not Found!:("
            };
        }

        if (delPost.authorId !== session.user.id) {
            return {
                success: false,
                message: "Only owners of the post can delete this!!"
            };
        }

        await collections.posts.deleteOne({ id: pId });
        await Promise.all([
            collections.postTags.deleteMany({ postId: pId }),
            collections.postReactions.deleteMany({ postId: pId }),
            collections.postViews.deleteMany({ postId: pId }),
            collections.postRevisions.deleteMany({ postId: pId }),
            collections.bookmarks.deleteMany({ postId: pId }),
            collections.postSubscriptions.deleteMany({ postId: pId }),
            collections.postReports.deleteMany({ postId: pId }),
            collections.notInterestedPosts.deleteMany({ postId: pId }),
            collections.postShares.deleteMany({ postId: pId }),
            collections.comments.deleteMany({ postId: pId }),
        ]);

        await invalidatePostTags({ slug: delPost.slug, authorId: delPost.authorId });
        revalidatePath("/");
        revalidatePath("/profile");
        revalidatePath("/following");

        return {
            success: true,
            message: "Post Deleted Successfully!!"
        };

    } catch (e) {
        console.log(e);
        return {
            success: false,
            message: "Failed to Delete Post! :( " + e
        };
    }
}

export async function restorePostRevision(postId: number, revisionId: number) {
    try {
        const pId = Number(postId);
        const rId = Number(revisionId);

        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return {
                success: false,
                message: "You must be logged in to restore revisions",
            };
        }

        const post = await collections.posts.findOne({ id: pId });

        if (!post || post.authorId !== session.user.id) {
            return {
                success: false,
                message: "Only post owner can restore revisions",
            };
        }

        const revision = await collections.postRevisions.findOne({ id: rId, postId: pId });

        if (!revision) {
            return {
                success: false,
                message: "Revision not found",
            };
        }

        await collections.posts.updateOne(
            { id: pId },
            {
                $set: {
                    title: revision.title,
                    description: revision.description,
                    category: revision.category,
                    coverImage: revision.coverImage,
                    content: revision.content,
                    slug: revision.slug,
                    updatedAt: new Date(),
                },
            }
        );

        await syncPostTags(pId, revision.tagsSnapshot ?? "");

        await invalidatePostTags({ slug: revision.slug, authorId: post.authorId });
        if (post.slug !== revision.slug) {
            await invalidateCacheTags([`post:${post.slug}`]);
            revalidateTag(`post:${post.slug}`, "max");
        }
        revalidatePath("/");
        revalidatePath(`/post/${revision.slug}`);
        revalidatePath("/profile");
        revalidatePath("/analytics");

        return {
            success: true,
            message: "Revision restored",
            slug: revision.slug,
        };
    } catch (e) {
        console.log(e);
        return {
            success: false,
            message: "Failed to restore revision",
        };
    }
}