import { collections, getNextSequence } from "./index";
import { getOrSetRedisCache } from "@/lib/cache/redis-cache";
import { toPlainObject } from "@/lib/utils";
import type { PostDoc } from "./schema";
import { ObjectId } from "mongodb";

export interface PopulatedUser {
    id: string;
    _id?: any;
    name: string;
    email: string;
    image: string | null;
    emailVerified: boolean | null;
    createdAt: Date;
    updatedAt: Date;
}

export async function findUsersByIds(userIds: (string | undefined | null)[]): Promise<Map<string, PopulatedUser>> {
    const validIds = Array.from(new Set(userIds.filter((id): id is string => Boolean(id && String(id).trim()))));
    if (!validIds.length) return new Map<string, PopulatedUser>();

    const objectIds: ObjectId[] = [];
    const stringIds: string[] = [];

    for (const rawId of validIds) {
        const idStr = String(rawId).trim();
        stringIds.push(idStr);
        if (ObjectId.isValid(idStr) && String(new ObjectId(idStr)) === idStr) {
            objectIds.push(new ObjectId(idStr));
        }
    }

    const orClauses: any[] = [
        { id: { $in: stringIds } },
        { _id: { $in: stringIds } },
    ];
    if (objectIds.length > 0) {
        orClauses.push({ _id: { $in: objectIds } });
    }

    const userDocs = await collections.users.find({ $or: orClauses }).toArray();
    const userMap = new Map<string, PopulatedUser>();
    const now = new Date();

    for (const u of userDocs) {
        const resolvedId = u.id || (u._id ? String(u._id) : "");
        const normalized: PopulatedUser = {
            id: resolvedId,
            _id: u._id,
            name: u.name || (u.email ? u.email.split("@")[0] : "Author"),
            email: u.email || "",
            image: u.image ?? null,
            emailVerified: typeof u.emailVerified === "boolean" ? u.emailVerified : null,
            createdAt: u.createdAt instanceof Date ? u.createdAt : (u.createdAt ? new Date(u.createdAt) : now),
            updatedAt: u.updatedAt instanceof Date ? u.updatedAt : (u.updatedAt ? new Date(u.updatedAt) : now),
        };

        if (resolvedId) userMap.set(resolvedId, normalized);
        if (u._id) userMap.set(String(u._id), normalized);
        if (u.id) userMap.set(String(u.id), normalized);
    }

    return userMap;
}

async function populatePosts(posts: PostDoc[]) {
    if (!posts.length) return [];

    const postIds = posts.map((p) => p.id);
    const authorIds = Array.from(new Set(posts.map((p) => p.authorId)));

    const authorMap = await findUsersByIds(authorIds);

    const postTagDocs = await collections.postTags.find({ postId: { $in: postIds } }).toArray();
    const tagIds = Array.from(new Set(postTagDocs.map((pt) => pt.tagId)));

    const tagDocs = await collections.tags.find({ id: { $in: tagIds } }).toArray();
    const tagMap = new Map<number, any>();
    for (const t of tagDocs) {
        tagMap.set(t.id, {
            id: t.id,
            name: t.name,
            slug: t.slug,
        });
    }

    const postTagsByPostId = new Map<number, Array<{ tag: any }>>();
    for (const pt of postTagDocs) {
        const tag = tagMap.get(pt.tagId);
        if (tag) {
            const list = postTagsByPostId.get(pt.postId) || [];
            list.push({ tag });
            postTagsByPostId.set(pt.postId, list);
        }
    }

    const populated = posts.map((p) => {
        const { _id, ...rest } = p;
        const author = authorMap.get(p.authorId) ||
                       (p.authorId ? authorMap.get(String(p.authorId)) : null) || {
                           id: p.authorId,
                           name: "Author",
                           email: "",
                           image: null,
                       };

        return {
            ...rest,
            coverImage: p.coverImage ?? null,
            scheduledAt: p.scheduledAt ?? null,
            publishedAt: p.publishedAt ?? null,
            author,
            postTags: postTagsByPostId.get(p.id) || [],
        };
    });

    return toPlainObject(populated);
}

async function publishDueScheduledPosts() {
    const now = new Date();
    await collections.posts.updateMany(
        {
            published: false,
            scheduledAt: { $ne: null, $lte: now },
        },
        {
            $set: {
                published: true,
                status: "published",
                publishedAt: now,
                updatedAt: now,
            },
        }
    );
}

async function runCached<T>(
    keyParts: string[],
    tags: string[],
    revalidateSeconds: number,
    getData: () => Promise<T>
) {
    return getOrSetRedisCache({
        keyParts,
        tags,
        ttlSeconds: revalidateSeconds,
        getData,
    });
}

// Get all posts
export async function getAllPosts(userId?: string) {
    try {
        await publishDueScheduledPosts();

        return runCached(
            ["getAllPosts", userId ?? "anon"],
            ["posts", userId ? `feed:${userId}` : "feed:anon"],
            30,
            async () => {
                const postDocs = await collections.posts
                    .find({ published: true })
                    .sort({ createdAt: -1 })
                    .toArray();

                const allPosts = await populatePosts(postDocs);

                if (!userId) {
                    return allPosts;
                }

                const [hidden, reported] = await Promise.all([
                    collections.notInterestedPosts.find({ userId }).toArray(),
                    collections.postReports.find({ userId }).toArray(),
                ]);

                const hiddenPostIds = new Set(hidden.map((e) => e.postId));
                const reportedPostIds = new Set(reported.map((e) => e.postId));

                return allPosts.filter(
                    (post) => !hiddenPostIds.has(post.id) && !reportedPostIds.has(post.id)
                );
            }
        );
    } catch (e) {
        console.log(e);
        return [];
    }
}

export async function getPostBySlug(slug: string) {
    try {
        await publishDueScheduledPosts();

        return runCached(
            ["getPostBySlug", slug],
            ["posts", `post:${slug}`],
            60,
            async () => {
                const post = await collections.posts.findOne({ slug });
                if (!post) return null;
                const [populated] = await populatePosts([post]);
                return populated ?? null;
            }
        );
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function getPostById(id: number) {
    try {
        const post = await collections.posts.findOne({ id: Number(id) });
        if (!post) return null;
        const [populated] = await populatePosts([post]);
        return populated ?? null;
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function getYourPosts(userId: string) {
    try {
        await publishDueScheduledPosts();

        return runCached(
            ["getYourPosts", userId],
            ["posts", `feed:${userId}`],
            30,
            async () => {
                const posts = await collections.posts
                    .find({ authorId: userId })
                    .sort({ createdAt: -1 })
                    .toArray();

                return populatePosts(posts);
            }
        );
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function getPostsByTag(tagSlug: string) {
    try {
        await publishDueScheduledPosts();

        const tag = await collections.tags.findOne({ slug: tagSlug });
        if (!tag) {
            return { tag: null, posts: [] };
        }

        const postTagMappings = await collections.postTags.find({ tagId: tag.id }).toArray();
        const postIds = postTagMappings.map((item) => item.postId);

        if (!postIds.length) {
            return { tag: { id: tag.id, name: tag.name, slug: tag.slug }, posts: [] };
        }

        const postDocs = await collections.posts
            .find({ id: { $in: postIds }, published: true })
            .sort({ createdAt: -1 })
            .toArray();

        const populated = await populatePosts(postDocs);
        return { tag: { id: tag.id, name: tag.name, slug: tag.slug }, posts: populated };
    } catch (e) {
        console.log(e);
        return { tag: null, posts: [] };
    }
}

export async function getPostEngagementCounts(postId: number) {
    const pId = Number(postId);
    const post = await collections.posts.findOne({ id: pId });

    const [
        likes,
        dislikes,
        comments,
        views,
        bookmarks,
        subscribers,
        shares,
        reports,
    ] = await Promise.all([
        collections.postReactions.countDocuments({ postId: pId, type: "like" }),
        collections.postReactions.countDocuments({ postId: pId, type: "dislike" }),
        collections.comments.countDocuments({ postId: pId, status: "approved" }),
        collections.postViews.countDocuments({ postId: pId }),
        collections.bookmarks.countDocuments({ postId: pId }),
        post?.authorId
            ? collections.authorSubscriptions.countDocuments({ authorId: post.authorId })
            : 0,
        collections.postShares.countDocuments({ postId: pId }),
        collections.postReports.countDocuments({ postId: pId }),
    ]);

    return {
        likes,
        dislikes,
        comments,
        views,
        bookmarks,
        subscribers,
        shares,
        reports,
    };
}

export async function getUserPostEngagementState(postId: number, userId?: string) {
    if (!userId) {
        return {
            reactionType: null as "like" | "dislike" | null,
            isBookmarked: false,
            isSubscribed: false,
            notifyOnAuthorPost: false,
            isNotInterested: false,
        };
    }

    const pId = Number(postId);
    const post = await collections.posts.findOne({ id: pId });

    const [reaction, bookmark, subscription, notInterested] = await Promise.all([
        collections.postReactions.findOne({ postId: pId, userId }),
        collections.bookmarks.findOne({ postId: pId, userId }),
        post?.authorId
            ? collections.authorSubscriptions.findOne({ authorId: post.authorId, userId })
            : null,
        collections.notInterestedPosts.findOne({ postId: pId, userId }),
    ]);

    const reactionType: "like" | "dislike" | null =
        reaction?.type === "like" || reaction?.type === "dislike" ? reaction.type : null;

    return {
        reactionType,
        isBookmarked: Boolean(bookmark),
        isSubscribed: Boolean(subscription),
        notifyOnAuthorPost: Boolean(subscription?.notifyOnPost),
        isNotInterested: Boolean(notInterested),
    };
}

export async function getPostCommentsWithReplies(postId: number) {
    const pId = Number(postId);
    const allComments = await collections.comments
        .find({ postId: pId })
        .sort({ createdAt: -1 })
        .toArray();

    const userIds = Array.from(new Set(allComments.map((c) => c.userId)));
    const userMap = await findUsersByIds(userIds);

    const commentsWithUser = allComments.map((comment) => {
        const { _id, ...commentRest } = comment;
        const user = userMap.get(comment.userId) ||
                     (comment.userId ? userMap.get(String(comment.userId)) : null) ||
                     null;

        return {
            ...commentRest,
            parentId: comment.parentId ?? null,
            user,
        };
    });

    const visible = commentsWithUser.filter((comment) => comment.status === "approved");
    const topLevel = visible.filter((comment) => !comment.parentId);

    return toPlainObject(
        topLevel.map((comment) => ({
            ...comment,
            replies: visible
                .filter((reply) => reply.parentId === comment.id)
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        }))
    );
}

interface AnalyticsFilters {
    startDate?: Date;
    endDate?: Date;
    comparePreviousPeriod?: boolean;
}

export async function getAuthorAnalytics(authorId: string, filters?: AnalyticsFilters) {
    await publishDueScheduledPosts();

    const authorPosts = await collections.posts
        .find({ authorId })
        .sort({ createdAt: -1 })
        .toArray();
    const publishedPosts = authorPosts.filter((p) => p.published);
    const postIds = authorPosts.map((p) => p.id);

    const startDate = filters?.startDate;
    const endDate = filters?.endDate;

    const getSummary = async (rangeStart?: Date, rangeEnd?: Date) => {
        const dateQuery = rangeStart && rangeEnd ? { createdAt: { $gte: rangeStart, $lt: rangeEnd } } : {};

        if (!postIds.length) {
            return {
                totalPosts: 0,
                totalViews: 0,
                totalLikes: 0,
                totalDislikes: 0,
                totalComments: 0,
                totalBookmarks: 0,
                totalShares: 0,
                totalSubscribers: 0,
                uniqueVisitors: 0,
                returningVisitors: 0,
                avgSessionDuration: 0,
            };
        }

        const [viewsDocs, likesCount, dislikesCount, commentsCount, bookmarksCount, sharesCount, subscribersCount] =
            await Promise.all([
                collections.postViews
                    .find({ postId: { $in: postIds }, ...dateQuery })
                    .toArray(),
                collections.postReactions.countDocuments({
                    postId: { $in: postIds },
                    type: "like",
                    ...dateQuery,
                }),
                collections.postReactions.countDocuments({
                    postId: { $in: postIds },
                    type: "dislike",
                    ...dateQuery,
                }),
                collections.comments.countDocuments({
                    postId: { $in: postIds },
                    status: "approved",
                    ...dateQuery,
                }),
                collections.bookmarks.countDocuments({
                    postId: { $in: postIds },
                    ...dateQuery,
                }),
                collections.postShares.countDocuments({
                    postId: { $in: postIds },
                    ...dateQuery,
                }),
                collections.authorSubscriptions.countDocuments({
                    authorId,
                    ...dateQuery,
                }),
            ]);

        const visitorCounts = new Map<string, number>();
        let totalDuration = 0;
        for (const v of viewsDocs) {
            const visitorKey = v.userId || v.sessionId || v.ipAddress || "anon";
            visitorCounts.set(visitorKey, (visitorCounts.get(visitorKey) || 0) + 1);
            totalDuration += Number(v.durationSeconds || 0);
        }

        const uniqueVisitors = visitorCounts.size;
        let returningVisitors = 0;
        for (const count of visitorCounts.values()) {
            if (count > 1) returningVisitors++;
        }

        const avgSessionDuration = viewsDocs.length > 0 ? Number((totalDuration / viewsDocs.length).toFixed(1)) : 0;

        return {
            totalPosts: authorPosts.length,
            totalViews: viewsDocs.length,
            totalLikes: likesCount,
            totalDislikes: dislikesCount,
            totalComments: commentsCount,
            totalBookmarks: bookmarksCount,
            totalShares: sharesCount,
            totalSubscribers: subscribersCount,
            uniqueVisitors,
            returningVisitors,
            avgSessionDuration,
        };
    };

    const normalizedSummary = await getSummary(startDate, endDate);

    const postDateQuery = startDate && endDate ? { createdAt: { $gte: startDate, $lt: endDate } } : {};

    const postBreakdown = await Promise.all(
        publishedPosts.map(async (p) => {
            const [views, likes, dislikes, comments, bookmarks, shares, subscribers] = await Promise.all([
                collections.postViews.countDocuments({ postId: p.id, ...postDateQuery }),
                collections.postReactions.countDocuments({ postId: p.id, type: "like", ...postDateQuery }),
                collections.postReactions.countDocuments({ postId: p.id, type: "dislike", ...postDateQuery }),
                collections.comments.countDocuments({ postId: p.id, status: "approved", ...postDateQuery }),
                collections.bookmarks.countDocuments({ postId: p.id, ...postDateQuery }),
                collections.postShares.countDocuments({ postId: p.id, ...postDateQuery }),
                collections.authorSubscriptions.countDocuments({ authorId }),
            ]);

            return {
                postId: p.id,
                title: p.title,
                slug: p.slug,
                views,
                likes,
                dislikes,
                comments,
                bookmarks,
                shares,
                subscribers,
            };
        })
    );

    let compareSummary: null | {
        previous: typeof normalizedSummary;
        deltas: Record<string, number>;
    } = null;

    if (filters?.comparePreviousPeriod && startDate && endDate) {
        const rangeMs = Math.max(1, endDate.getTime() - startDate.getTime());
        const previousStart = new Date(startDate.getTime() - rangeMs);
        const previousEnd = new Date(startDate.getTime());
        const previous = await getSummary(previousStart, previousEnd);

        const calcDelta = (current: number, before: number) => {
            if (before === 0) {
                return current > 0 ? 100 : 0;
            }
            return Number((((current - before) / before) * 100).toFixed(1));
        };

        compareSummary = {
            previous,
            deltas: {
                totalViews: calcDelta(normalizedSummary.totalViews, previous.totalViews),
                totalLikes: calcDelta(normalizedSummary.totalLikes, previous.totalLikes),
                totalComments: calcDelta(normalizedSummary.totalComments, previous.totalComments),
                totalBookmarks: calcDelta(normalizedSummary.totalBookmarks, previous.totalBookmarks),
                totalShares: calcDelta(normalizedSummary.totalShares, previous.totalShares),
                uniqueVisitors: calcDelta(normalizedSummary.uniqueVisitors, previous.uniqueVisitors),
                returningVisitors: calcDelta(normalizedSummary.returningVisitors, previous.returningVisitors),
                avgSessionDuration: calcDelta(normalizedSummary.avgSessionDuration, previous.avgSessionDuration),
            },
        };
    }

    return {
        summary: normalizedSummary,
        postBreakdown,
        comparison: compareSummary,
    };
}

export async function getSavedPosts(userId: string) {
    try {
        const savedEntries = await collections.bookmarks
            .find({ userId })
            .sort({ createdAt: -1 })
            .toArray();

        const postIds = savedEntries.map((e) => e.postId);
        if (!postIds.length) return [];

        const posts = await collections.posts.find({ id: { $in: postIds } }).toArray();
        const populated = await populatePosts(posts);
        const populatedMap = new Map(populated.map((p) => [p.id, p]));

        return savedEntries
            .map((entry) => populatedMap.get(entry.postId))
            .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } catch (e) {
        console.log(e);
        return [];
    }
}

export async function getSuggestedPostsFromSubscribedAuthors(userId: string) {
    try {
        await publishDueScheduledPosts();

        const subscriptions = await collections.authorSubscriptions.find({ userId }).toArray();
        const authorIds = subscriptions.map((s) => s.authorId);
        if (!authorIds.length) return [];

        const posts = await collections.posts
            .find({ authorId: { $in: authorIds }, published: true })
            .sort({ createdAt: -1 })
            .limit(6)
            .toArray();

        return populatePosts(posts);
    } catch (e) {
        console.log(e);
        return [];
    }
}

export async function getSubscribedAuthorNotifications(userId: string) {
    try {
        await publishDueScheduledPosts();

        const notifySubscriptions = await collections.authorSubscriptions
            .find({ userId, notifyOnPost: true })
            .toArray();

        const authorIds = notifySubscriptions.map((s) => s.authorId);
        if (!authorIds.length) return [];

        const posts = await collections.posts
            .find({ authorId: { $in: authorIds }, published: true })
            .sort({ createdAt: -1 })
            .limit(8)
            .toArray();

        return populatePosts(posts);
    } catch (e) {
        console.log(e);
        return [];
    }
}

export async function getPostRevisionHistory(postId: number, authorId: string) {
    const pId = Number(postId);
    const post = await collections.posts.findOne({ id: pId, authorId });
    if (!post) return [];

    const revs = await collections.postRevisions
        .find({ postId: pId })
        .sort({ createdAt: -1 })
        .toArray();

    return revs.map((r) => {
        const { _id, ...rest } = r;
        return rest;
    });
}

export async function getFollowedAuthorsFeed(userId: string) {
    await publishDueScheduledPosts();

    return runCached(
        ["getFollowedAuthorsFeed", userId],
        ["posts", `feed:${userId}`],
        30,
        async () => {
            const subscriptions = await collections.authorSubscriptions.find({ userId }).toArray();
            const authorIds = subscriptions.map((item) => item.authorId);
            if (!authorIds.length) return [];

            const posts = await collections.posts
                .find({ authorId: { $in: authorIds }, published: true })
                .sort({ createdAt: -1 })
                .toArray();

            return populatePosts(posts);
        }
    );
}

export async function getSmartRecommendations(userId?: string, limit = 6) {
    try {
        await publishDueScheduledPosts();

        const allPostsDocs = await collections.posts
            .find({ published: true })
            .sort({ createdAt: -1 })
            .toArray();

        const allPosts = await populatePosts(allPostsDocs);

        if (!userId) {
            return allPosts.slice(0, limit);
        }

        const [viewed, bookmarked, reacted] = await Promise.all([
            collections.postViews.find({ userId }).toArray(),
            collections.bookmarks.find({ userId }).toArray(),
            collections.postReactions.find({ userId }).toArray(),
        ]);

        const interactedPostIds = new Set<number>([
            ...viewed.map((item) => item.postId),
            ...bookmarked.map((item) => item.postId),
            ...reacted.map((item) => item.postId),
        ]);

        const interactedTagSlugs = new Set<string>();
        allPosts.forEach((post) => {
            if (interactedPostIds.has(post.id)) {
                (post.postTags ?? []).forEach((tagMapping: any) =>
                    interactedTagSlugs.add(tagMapping.tag.slug)
                );
            }
        });

        const scored = allPosts
            .filter((post) => !interactedPostIds.has(post.id) && post.authorId !== userId)
            .map((post) => {
                const tagMatches = (post.postTags ?? []).filter((tagMapping: any) =>
                    interactedTagSlugs.has(tagMapping.tag.slug)
                ).length;
                const postTime = post.createdAt ? new Date(post.createdAt).getTime() : Date.now();
                const freshness = Math.max(
                    0,
                    100 - Math.floor((Date.now() - postTime) / (1000 * 60 * 60 * 24))
                );
                return {
                    post,
                    score: tagMatches * 10 + freshness,
                };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((item) => item.post);

        return scored.length ? scored : allPosts.slice(0, limit);
    } catch (e) {
        console.error("getSmartRecommendations error:", e);
        return [];
    }
}

interface AdvancedSearchFilters {
    query?: string;
    tag?: string;
    author?: string;
    sort?: "newest" | "trending";
    minReadMinutes?: number;
    dateFrom?: Date;
    dateTo?: Date;
}

export async function searchPostsAdvanced(filters: AdvancedSearchFilters, userId?: string) {
    const postsList = await getAllPosts(userId);
    const query = (filters.query ?? "").trim().toLowerCase();
    const tag = (filters.tag ?? "").trim().toLowerCase();
    const author = (filters.author ?? "").trim().toLowerCase();

    const withMetrics = await Promise.all(
        postsList.map(async (post) => {
            const views = await collections.postViews.countDocuments({ postId: post.id });
            const words = post.content.trim().split(/\s+/).filter(Boolean).length;
            const readMinutes = Math.max(1, Math.ceil(words / 200));

            return {
                ...post,
                views,
                readMinutes,
            };
        })
    );

    const filtered = withMetrics.filter((post) => {
        const haystack = `${post.title} ${post.description} ${post.content} ${post.author?.name ?? ""}`.toLowerCase();
        const matchesQuery = !query || haystack.includes(query);
        const matchesTag =
            !tag ||
            (post.postTags ?? []).some(
                (tagMapping: any) =>
                    tagMapping.tag.slug.includes(tag) ||
                    tagMapping.tag.name.toLowerCase().includes(tag)
            );
        const matchesAuthor =
            !author || (post.author?.name ?? "").toLowerCase().includes(author);
        const matchesRead =
            !filters.minReadMinutes || post.readMinutes >= filters.minReadMinutes;
        const matchesDateFrom =
            !filters.dateFrom || new Date(post.createdAt) >= filters.dateFrom;
        const matchesDateTo =
            !filters.dateTo || new Date(post.createdAt) <= filters.dateTo;

        return (
            matchesQuery &&
            matchesTag &&
            matchesAuthor &&
            matchesRead &&
            matchesDateFrom &&
            matchesDateTo
        );
    });

    if (filters.sort === "trending") {
        filtered.sort(
            (a, b) =>
                b.views - a.views ||
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    } else {
        filtered.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    return filtered;
}

export async function getModerationDashboard(authorId: string) {
    const authorPosts = await collections.posts
        .find({ authorId })
        .project({ id: 1, title: 1, slug: 1 })
        .toArray();

    const postIds = authorPosts.map((post) => post.id);
    if (!postIds.length) {
        return {
            reports: [],
            commentsQueue: [],
            blockedWords: [],
        };
    }

    const postMap = new Map(authorPosts.map((p) => [p.id, { id: p.id, title: p.title, slug: p.slug }]));

    const [rawReports, rawComments, rawBlockedWords] = await Promise.all([
        collections.postReports
            .find({ postId: { $in: postIds }, status: "open" })
            .sort({ createdAt: -1 })
            .toArray(),
        collections.comments
            .find({ postId: { $in: postIds }, status: "pending" })
            .sort({ createdAt: -1 })
            .toArray(),
        collections.authorBlockWords
            .find({ authorId })
            .sort({ word: 1 })
            .toArray(),
    ]);

    const userIds = Array.from(
        new Set([...rawReports.map((r) => r.userId), ...rawComments.map((c) => c.userId)])
    );
    const userMap = await findUsersByIds(userIds);

    const reports = rawReports.map((r) => {
        const { _id, ...rRest } = r;
        const u = userMap.get(r.userId) || (r.userId ? userMap.get(String(r.userId)) : null);
        return {
            ...rRest,
            post: postMap.get(r.postId) ?? { id: r.postId, title: "Deleted Post", slug: "" },
            user: u ?? { id: r.userId, name: "Reader", email: "" },
        };
    });

    const commentsQueue = rawComments.map((c) => {
        const { _id, ...cRest } = c;
        const u = userMap.get(c.userId) || (c.userId ? userMap.get(String(c.userId)) : null);
        return {
            ...cRest,
            post: postMap.get(c.postId) ?? { id: c.postId, title: "Deleted Post", slug: "" },
            user: u ?? { id: c.userId, name: "Reader", email: "" },
        };
    });

    const blockedWords = rawBlockedWords.map((w) => {
        const { _id, ...wRest } = w;
        return wRest;
    });

    return {
        reports,
        commentsQueue,
        blockedWords,
    };
}

export async function getNotificationPreferences(userId: string) {
    const existing = await collections.notificationPreferences.findOne({ userId });
    if (existing) {
        const { _id, ...rest } = existing;
        return rest as any;
    }

    const nextId = await getNextSequence("notificationPreferences");
    const doc = {
        id: nextId,
        userId,
        notifyCommentsOnMyPosts: true,
        notifyNewPostsFromFollowedAuthors: true,
        notifyRepliesToMyComments: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await collections.notificationPreferences.insertOne(doc);
    return doc;
}

export async function getNotificationCenter(userId: string) {
    const prefs = await getNotificationPreferences(userId);

    const authorPosts = await collections.posts.find({ authorId: userId }).toArray();
    const authorPostIds = authorPosts.map((p) => p.id);
    const postMap = new Map(authorPosts.map((p) => [p.id, p]));

    const followedPostsPromise = prefs.notifyNewPostsFromFollowedAuthors
        ? getSubscribedAuthorNotifications(userId)
        : Promise.resolve([]);

    const commentsOnMyPostsPromise =
        prefs.notifyCommentsOnMyPosts && authorPostIds.length > 0
            ? (async () => {
                  const rawComments = await collections.comments
                      .find({
                          postId: { $in: authorPostIds },
                          userId: { $ne: userId },
                          status: "approved",
                      })
                      .sort({ createdAt: -1 })
                      .limit(20)
                      .toArray();

                  const commenterIds = Array.from(new Set(rawComments.map((c) => c.userId)));
                  const commenterMap = await findUsersByIds(commenterIds);

                  return rawComments.map((c) => {
                      const p = postMap.get(c.postId);
                      const commenter = commenterMap.get(c.userId) || (c.userId ? commenterMap.get(String(c.userId)) : null);
                      return {
                          commentId: c.id,
                          content: c.content,
                          createdAt: c.createdAt,
                          postSlug: p?.slug ?? "",
                          postTitle: p?.title ?? "",
                          commenterName: commenter?.name ?? "Reader",
                      };
                  });
              })()
            : Promise.resolve([]);

    const repliesToMyCommentsPromise = prefs.notifyRepliesToMyComments
        ? (async () => {
              const myComments = await collections.comments
                  .find({ userId })
                  .project({ id: 1 })
                  .toArray();
              const myCommentIds = myComments.map((c) => c.id);

              if (!myCommentIds.length) return [];

              const childComments = await collections.comments
                  .find({
                      parentId: { $in: myCommentIds },
                      userId: { $ne: userId },
                      status: "approved",
                  })
                  .sort({ createdAt: -1 })
                  .limit(20)
                  .toArray();

              if (!childComments.length) return [];

              const childPostIds = Array.from(new Set(childComments.map((c) => c.postId)));
              const childUserIds = Array.from(new Set(childComments.map((c) => c.userId)));

              const [postsDocs, cUserMap] = await Promise.all([
                  collections.posts.find({ id: { $in: childPostIds } }).toArray(),
                  findUsersByIds(childUserIds),
              ]);

              const cPostMap = new Map(postsDocs.map((p) => [p.id, p]));

              return childComments.map((c) => {
                  const p = cPostMap.get(c.postId);
                  const commenter = cUserMap.get(c.userId) || (c.userId ? cUserMap.get(String(c.userId)) : null);
                  return {
                      commentId: c.id,
                      content: c.content,
                      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
                      postSlug: p?.slug ?? "",
                      postTitle: p?.title ?? "",
                      commenterName: commenter?.name ?? "Reader",
                  };
              });
          })()
        : Promise.resolve([]);

    const [followedPosts, commentsOnMyPosts, repliesToMyComments] = await Promise.all([
        followedPostsPromise,
        commentsOnMyPostsPromise,
        repliesToMyCommentsPromise,
    ]);

    return {
        preferences: prefs,
        followedPosts,
        commentsOnMyPosts,
        repliesToMyComments,
    };
}