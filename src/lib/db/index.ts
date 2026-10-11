import { MongoClient, Db, Collection } from "mongodb";
import * as schema from "./schema";
import type {
  UserDoc,
  PostDoc,
  TagDoc,
  PostTagDoc,
  PostReactionDoc,
  PostViewDoc,
  PostRevisionDoc,
  BookmarkDoc,
  AuthorSubscriptionDoc,
  PostSubscriptionDoc,
  PostReportDoc,
  NotInterestedPostDoc,
  PostShareDoc,
  CommentDoc,
  AuthorBlockWordDoc,
  NotificationPreferenceDoc,
} from "./schema";

function getMongoUri(): string {
  const candidates = [
    { name: "MONGODB_URI", value: process.env.MONGODB_URI },
    { name: "DATABASE_URL", value: process.env.DATABASE_URL },
    { name: "DB_URL", value: process.env.DB_URL },
    { name: "MONGO_URL", value: process.env.MONGO_URL },
    { name: "MONGODB_URL", value: process.env.MONGODB_URL },
  ];

  const matched = candidates.find(
    (c) => typeof c.value === "string" && c.value.trim().length > 0
  );

  if (matched?.value) {
    return matched.value.trim();
  }

  return "mongodb://127.0.0.1:27017/velo-blog";
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var _mongoUri: string | undefined;
}

function getClientInstance(): MongoClient {
  const uri = getMongoUri();

  if (!global._mongoClient || global._mongoUri !== uri) {
    global._mongoClient = new MongoClient(uri);
    global._mongoClientPromise = global._mongoClient.connect();
    global._mongoUri = uri;
  }

  return global._mongoClient;
}

export const client: MongoClient = getClientInstance();
export const db: Db = client.db();
export const clientPromise: Promise<MongoClient> =
  global._mongoClientPromise || client.connect();

export function getDb(): Db {
  return getClientInstance().db();
}

export const collections = {
  get users(): Collection<UserDoc> {
    return getDb().collection<UserDoc>(schema.users);
  },
  get posts(): Collection<PostDoc> {
    return getDb().collection<PostDoc>(schema.posts);
  },
  get tags(): Collection<TagDoc> {
    return getDb().collection<TagDoc>(schema.tags);
  },
  get postTags(): Collection<PostTagDoc> {
    return getDb().collection<PostTagDoc>(schema.postTags);
  },
  get postReactions(): Collection<PostReactionDoc> {
    return getDb().collection<PostReactionDoc>(schema.postReactions);
  },
  get postViews(): Collection<PostViewDoc> {
    return getDb().collection<PostViewDoc>(schema.postViews);
  },
  get postRevisions(): Collection<PostRevisionDoc> {
    return getDb().collection<PostRevisionDoc>(schema.postRevisions);
  },
  get bookmarks(): Collection<BookmarkDoc> {
    return getDb().collection<BookmarkDoc>(schema.bookmarks);
  },
  get authorSubscriptions(): Collection<AuthorSubscriptionDoc> {
    return getDb().collection<AuthorSubscriptionDoc>(schema.authorSubscriptions);
  },
  get postSubscriptions(): Collection<PostSubscriptionDoc> {
    return getDb().collection<PostSubscriptionDoc>(schema.postSubscriptions);
  },
  get postReports(): Collection<PostReportDoc> {
    return getDb().collection<PostReportDoc>(schema.postReports);
  },
  get notInterestedPosts(): Collection<NotInterestedPostDoc> {
    return getDb().collection<NotInterestedPostDoc>(schema.notInterestedPosts);
  },
  get postShares(): Collection<PostShareDoc> {
    return getDb().collection<PostShareDoc>(schema.postShares);
  },
  get comments(): Collection<CommentDoc> {
    return getDb().collection<CommentDoc>(schema.comments);
  },
  get authorBlockWords(): Collection<AuthorBlockWordDoc> {
    return getDb().collection<AuthorBlockWordDoc>(schema.authorBlockWords);
  },
  get notificationPreferences(): Collection<NotificationPreferenceDoc> {
    return getDb().collection<NotificationPreferenceDoc>(schema.notificationPreferences);
  },
  get counters(): Collection<{ _id: string; seq: number }> {
    return getDb().collection<{ _id: string; seq: number }>(schema.counters);
  },
};

export async function getNextSequence(name: string): Promise<number> {
  const result = await collections.counters.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  return result?.seq ?? 1;
}

export async function setSequenceFloor(name: string, minSeq: number): Promise<void> {
  await collections.counters.updateOne(
    { _id: name },
    { $max: { seq: minSeq } },
    { upsert: true }
  );
}

export async function getClient(): Promise<MongoClient> {
  return clientPromise;
}

export { schema };
export default clientPromise;