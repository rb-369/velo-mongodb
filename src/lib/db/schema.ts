export interface UserDoc {
  _id?: any;
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDoc {
  _id?: any;
  id: string;
  userId: string;
  token?: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountDoc {
  _id?: any;
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  idToken?: string | null;
  accessTokenExpiresAt?: Date | null;
  refreshTokenExpiresAt?: Date | null;
  scope?: string | null;
  password?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationDoc {
  _id?: any;
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostDoc {
  _id?: any;
  id: number;
  title: string;
  description: string;
  category: string;
  status: string; // draft | published | scheduled
  slug: string;
  coverImage: string | null;
  content: string;
  published: boolean;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagDoc {
  _id?: any;
  id: number;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface PostTagDoc {
  _id?: any;
  id: number;
  postId: number;
  tagId: number;
  createdAt: Date;
}

export interface PostReactionDoc {
  _id?: any;
  id: number;
  postId: number;
  userId: string;
  type: "like" | "dislike";
  createdAt: Date;
  updatedAt: Date;
}

export interface PostViewDoc {
  _id?: any;
  id: number;
  postId: number;
  userId?: string | null;
  sessionId?: string | null;
  ipAddress?: string | null;
  durationSeconds: number;
  createdAt: Date;
}

export interface PostRevisionDoc {
  _id?: any;
  id: number;
  postId: number;
  editorId: string;
  title: string;
  description: string;
  category: string;
  coverImage: string | null;
  content: string;
  slug: string;
  tagsSnapshot: string;
  createdAt: Date;
}

export interface BookmarkDoc {
  _id?: any;
  id: number;
  postId: number;
  userId: string;
  createdAt: Date;
}

export interface PostSubscriptionDoc {
  _id?: any;
  id: number;
  postId: number;
  userId: string;
  createdAt: Date;
}

export interface AuthorSubscriptionDoc {
  _id?: any;
  id: number;
  authorId: string;
  userId: string;
  notifyOnPost: boolean;
  createdAt: Date;
}

export interface PostReportDoc {
  _id?: any;
  id: number;
  postId: number;
  userId: string;
  reason: string;
  status: "open" | "reviewed";
  createdAt: Date;
}

export interface NotInterestedPostDoc {
  _id?: any;
  id: number;
  postId: number;
  userId: string;
  createdAt: Date;
}

export interface PostShareDoc {
  _id?: any;
  id: number;
  postId: number;
  userId?: string | null;
  channel: string;
  createdAt: Date;
}

export interface CommentDoc {
  _id?: any;
  id: number;
  postId: number;
  userId: string;
  parentId: number | null;
  content: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthorBlockWordDoc {
  _id?: any;
  id: number;
  authorId: string;
  word: string;
  createdAt: Date;
}

export interface NotificationPreferenceDoc {
  _id?: any;
  id: number;
  userId: string;
  notifyCommentsOnMyPosts: boolean;
  notifyNewPostsFromFollowedAuthors: boolean;
  notifyRepliesToMyComments: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Collection names
export const users = "users";
export const sessions = "sessions";
export const accounts = "accounts";
export const verifications = "verifications";
export const posts = "posts";
export const tags = "tags";
export const postTags = "postTags";
export const postReactions = "postReactions";
export const postViews = "postViews";
export const postRevisions = "postRevisions";
export const bookmarks = "bookmarks";
export const postSubscriptions = "postSubscriptions";
export const authorSubscriptions = "authorSubscriptions";
export const postReports = "postReports";
export const notInterestedPosts = "notInterestedPosts";
export const postShares = "postShares";
export const comments = "comments";
export const authorBlockWords = "authorBlockWords";
export const notificationPreferences = "notificationPreferences";
export const counters = "counters";