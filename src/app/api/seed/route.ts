import { NextResponse } from "next/server";
import { collections, getNextSequence } from "@/lib/db";
import { SEED_AUTHORS, SEED_POSTS } from "@/lib/db/seed-data";
import { invalidateCacheTags } from "@/lib/cache/redis-cache";

export async function runSeeder() {
  const authorMap = new Map<string, string>();
  const createdAuthors: string[] = [];
  const createdPosts: string[] = [];

  // 1. Seed Authors
  for (const author of SEED_AUTHORS) {
    const existing = await collections.users.findOne({ email: author.email });

    if (existing) {
      authorMap.set(author.email, existing.id);
    } else {
      const newAuthor = {
        id: author.id,
        name: author.name,
        email: author.email,
        image: author.image,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await collections.users.insertOne(newAuthor);

      authorMap.set(author.email, author.id);
      createdAuthors.push(author.name);
    }
  }

  // 2. Seed Posts and Tags
  for (const postData of SEED_POSTS) {
    const authorId = authorMap.get(postData.authorEmail);
    if (!authorId) continue;

    let post = await collections.posts.findOne({ slug: postData.slug });

    if (!post) {
      const nextPostId = await getNextSequence("posts");
      const newPost = {
        id: nextPostId,
        title: postData.title,
        description: postData.description,
        category: postData.category,
        status: "published",
        slug: postData.slug,
        coverImage: postData.coverImage,
        content: postData.content,
        published: true,
        scheduledAt: null,
        publishedAt: new Date(),
        authorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await collections.posts.insertOne(newPost);
      post = await collections.posts.findOne({ slug: postData.slug });
      if (!post) continue;
      createdPosts.push(postData.title);

      // Seed initial like from author
      try {
        const nextReactionId = await getNextSequence("postReactions");
        await collections.postReactions.insertOne({
          id: nextReactionId,
          postId: post.id,
          userId: authorId,
          type: "like",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch {
        // ignore duplicate reaction
      }
    }

    if (!post) continue;

    // Associate Tags
    for (const tagName of postData.tags) {
      const tagSlug = tagName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      let tag = await collections.tags.findOne({ slug: tagSlug });

      if (!tag) {
        const nextTagId = await getNextSequence("tags");
        const newTag = {
          id: nextTagId,
          name: tagName,
          slug: tagSlug,
          createdAt: new Date(),
        };
        await collections.tags.insertOne(newTag);
        tag = await collections.tags.findOne({ slug: tagSlug });
      }

      if (tag && post) {
        const existingPostTag = await collections.postTags.findOne({
          postId: post.id,
          tagId: tag.id,
        });

        if (!existingPostTag) {
          const nextPostTagId = await getNextSequence("postTags");
          await collections.postTags.insertOne({
            id: nextPostTagId,
            postId: post.id,
            tagId: tag.id,
            createdAt: new Date(),
          });
        }
      }
    }
  }

  await invalidateCacheTags(["posts", "tags", "feed:anon"]);

  return {
    success: true,
    totalAuthorsSeeded: createdAuthors.length,
    totalPostsSeeded: createdPosts.length,
    createdAuthors,
    createdPosts,
    message:
      createdPosts.length > 0
        ? `Successfully seeded ${createdPosts.length} posts across ${createdAuthors.length} authors.`
        : "Database already contains all seed posts and authors (idempotent run).",
  };
}

export async function GET() {
  try {
    const result = await runSeeder();
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[seed-error]", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to seed database";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        hint: "Please verify that your MongoDB Atlas cluster is online and MONGODB_URI is set correctly.",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
