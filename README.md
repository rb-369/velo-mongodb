# VELO

VELO is a full-stack creator platform built with Next.js App Router, MongoDB Atlas, and Better Auth.
It combines blogging, social interactions, creator analytics, moderation tools, and personalized discovery.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- MongoDB Atlas (Official `mongodb` driver)
- Better Auth (`@better-auth/mongo-adapter`)
- Tailwind CSS
- Recharts (analytics visualizations)
- Cloudinary (image uploads)

## Core Features

- Authentication and protected routes
- Create, edit, delete posts
- Drafts, scheduled posts, auto-publish of due posts
- Post revision history with restore
- Reactions, comments, bookmarks, shares, reporting
- Follow authors and follow-based feed
- Smart recommendations
- Advanced search and filtering
- Analytics dashboard with time filters and comparison mode
- Moderation dashboard (reports, pending comments, blocked words)
- Notification center with granular notification preferences

## Project Structure

- `src/app` - routes and pages
- `src/components` - UI and feature components
- `src/actions` - server actions
- `src/lib/db` - MongoDB client, schema definitions, and query layer
- `scripts` - database seed script

## Environment Variables

Create `.env` in the project root:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.yahvere.mongodb.net/velo-blog?retryWrites=true&w=majority
# (DB_URL and DATABASE_URL are also supported fallbacks)
BETTER_AUTH_SECRET=<strong-random-secret-32-chars>
BASE_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_URL=cloudinary://<api-key>:<api-secret>@<cloud-name>
UPSTASH_REDIS_REST_URL=<upstash-redis-rest-url>
UPSTASH_REDIS_REST_TOKEN=<upstash-redis-rest-token>
```

Notes:

- Use a strong `BETTER_AUTH_SECRET` (at least 32 chars).
- **MongoDB Atlas**: Provide your Atlas connection string in `MONGODB_URI` (or `DB_URL` / `DATABASE_URL`).
- **Google OAuth**: Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Add authorized redirect URI: `https://velo-blogs.vercel.app/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google`).
- In production (Vercel), set `BASE_URL` and `NEXT_PUBLIC_BASE_URL` to your deployed domain, e.g. `https://velo-blogs.vercel.app`.
- Cloudinary, Unsplash, and Google avatars are configured for remote image rendering in `next.config.ts`.

## Setup

```bash
npm install
```

Seed dummy posts and authors into MongoDB Atlas:

```bash
npm run seed
# or navigate to http://localhost:3000/api/seed in your browser
```

Start dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
npm run start
```

## Analytics Notes

- Time filters: `Today`, `Last 7 Days`, `Last 30 Days`, `Custom`
- Optional previous-period comparison
- Metrics include:
  - views
  - unique visitors
  - returning visitors
  - average session duration
  - likes/comments/bookmarks/shares/dislikes/subscribers

## Key Routes

- `/` - home feed
- `/analytics` - creator analytics
- `/following` - followed authors feed
- `/moderation` - moderation tools
- `/notifications` - notification center
- `/search` - advanced search
- `/yourPosts` - creator post management

## License

Private project.
