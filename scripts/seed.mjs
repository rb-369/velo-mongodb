import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";

// Load .env if present
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const connectionString =
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  process.env.DB_URL ||
  process.env.MONGO_URL ||
  "mongodb://127.0.0.1:27017/velo-blog";

const SEED_AUTHORS = [
  {
    id: "usr_elena_vance",
    name: "Elena Vance",
    email: "elena.vance@velo.design",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: "usr_marcus_chen",
    name: "Marcus Chen",
    email: "marcus.chen@velo.design",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: "usr_aris_thorne",
    name: "Dr. Aris Thorne",
    email: "aris.thorne@velo.design",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: "usr_sofia_rostova",
    name: "Sofia Rostova",
    email: "sofia.rostova@velo.design",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: "usr_jordan_blake",
    name: "Jordan Blake",
    email: "jordan.blake@velo.design",
    image: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: "usr_maya_patel",
    name: "Maya Patel",
    email: "maya.patel@velo.design",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: "usr_kai_takahashi",
    name: "Kai Takahashi",
    email: "kai.takahashi@velo.design",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: "usr_liam_oconnor",
    name: "Liam O'Connor",
    email: "liam.oconnor@velo.design",
    image: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=400&auto=format&fit=crop",
  },
];

const SEED_POSTS = [
  {
    title: "Architecting Event-Driven Microfrontends with Next.js 16 and RSC",
    slug: "architecting-event-driven-microfrontends-nextjs-16",
    description:
      "A deep dive into decomposing monolithic interfaces into composable, zero-runtime React Server Components orchestrated via streaming events.",
    category: "Engineering",
    coverImage:
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "elena.vance@velo.design",
    tags: ["Next.js", "Architecture", "RSC", "TypeScript", "Performance"],
    content: `## The Monolith Decomposition Dilemma

Modern web engineering often faces an architectural inflection point: when is an application too large for a singular bundle boundary, yet too interconnected to cleanly divide across independent deployment boundaries?

With Next.js 16 and refined React Server Components, the traditional tradeoffs between microfrontends and unified design systems are undergoing a fundamental shift.

### 1. Server-Driven Composition

Instead of dynamic script injection and client-side iframe choreography, modern server components allow teams to compose modules directly at the edge:

\`\`\`typescript
export async function FeedContainer({ userId }: { userId: string }) {
  const [personalization, stream] = await Promise.all([
    fetchUserSignals(userId),
    openEventStream(),
  ]);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <Suspense fallback={<ModuleSkeleton />}>
        <ActivityStream signals={personalization} />
      </Suspense>
      <Suspense fallback={<SidebarSkeleton />}>
        <RecommendationEngine context={stream.meta} />
      </Suspense>
    </section>
  );
}
\`\`\`

### 2. State Synchronization Across Autonomous Boundaries

The primary failure mode in microfrontend architecture has always been ambient synchronization. When one component modifies active state (e.g. following an author or saving a bookmark), how do peripheral components receive instant reconciliation without triggering global re-renders?

1. Lightweight Broadcast Channels: Leverage the browser Native BroadcastChannel API for intra-tab messaging.
2. Server-Sent Revalidation: Trigger granular router cache invalidation using optimistic tags.
3. Deterministic Contract Schemas: Use shared Zod validators to guarantee message contracts across independent service teams.

### Looking Ahead

As edge runtimes gain lower latency boundaries, composing web interfaces will resemble distributed microservices more than bundled client scripts. The teams that master this boundary early will build the fastest, most scalable experiences on the web.`,
  },
  {
    title: "The Death of Flat Design: Crafting Tactile, High-End Interfaces",
    slug: "death-of-flat-design-tactile-interfaces",
    description:
      "Why modern software is moving away from corporate sterile minimalism toward rich textural surfaces, calibrated lighting, and physical feedback.",
    category: "Design Systems",
    coverImage:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "marcus.chen@velo.design",
    tags: ["UI/UX", "Design Systems", "CSS", "Aesthetics", "Typography"],
    content: `## The Homogenization of Modern Software

For a decade, digital interfaces have suffered from an excess of aesthetic conservatism. Flat design, while efficient for early responsive mobile web viewports, stripped away affordance, physical hierarchy, and emotional delight.

Today, high-craft digital products are reclaiming material depth without falling into the gaudy traps of early skeuomorphism.

### The New Principles of Tactile Craft

1. Photometric Light Calibration: Surfaces should have directional light awareness. A 1px translucent highlight on the top edge paired with a soft ambient shadow creates immediate physical grounding.
2. Kinetic Resistance: Motion is not decoration; motion is mass. Interactive elements should possess subtle spring kinematics that reflect their visual weight.
3. Intentional Typographic Densities: High contrast between wide display headers and ultra-legible editorial body text gives content rhythm and dignity.

> "A great interface is not one you merely see, but one you feel through every micro-interaction."

### Implementing Dual-Tone Borders in CSS

\`\`\`css
.card-tactile {
  background: hsl(var(--card) / 0.85);
  border: 1px solid hsl(var(--border) / 0.7);
  box-shadow: 
    0 1px 2px 0 hsl(0 0% 0% / 0.05),
    inset 0 1px 0 0 hsl(0 0% 100% / 0.08);
  backdrop-filter: blur(16px);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
\`\`\`

When software feels solid, users trust it with their work. Depth is returning to the web, and it is better engineered than ever before.`,
  },
  {
    title: "Zero-Copy Context Streaming in Local LLM Agent Workflows",
    slug: "zero-copy-context-streaming-llm-agents",
    description:
      "Eliminating memory bottlenecks and token serialization overhead when piping multi-modal tool inputs through local reasoning engines.",
    category: "AI & Research",
    coverImage:
      "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "aris.thorne@velo.design",
    tags: ["AI", "LLM", "Agents", "Performance", "Rust"],
    content: `## The Memory Ceiling of Agentic Orchestration

As autonomous software agents progress from single-turn prompts to long-horizon workflows spanning thousands of tool executions, standard tokenization pipelines create crippling memory and latency overheads.

When an agent searches a codebase, reads a hundred files, and generates diffs, naive string duplication across JSON-RPC boundaries wastes substantial clock cycles.

### The Pipeline Architecture

Our benchmark architecture implements shared-memory buffers and zero-copy byte slices for context propagation:
- Memory-Mapped Vector Stores: Read directly from disk caches without heap allocation.
- Incremental KV-Cache Reuse: Retain stable prefix prompts across consecutive tool executions.
- Binary Streaming Protocols: Swap heavy JSON tool responses for compact Arrow/Protobuf IPC formats.

The results show that optimizing the data plane of LLM orchestrators is just as important as the underlying weights.`,
  },
  {
    title: "High-Throughput PostgreSQL: Partitioning Strategies for 100M+ Rows",
    slug: "high-throughput-postgresql-partitioning-strategies",
    description:
      "Lessons learned scaling time-series analytics, reaction streams, and notification logs in production with declarative partitioning.",
    category: "Architecture",
    coverImage:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "elena.vance@velo.design",
    tags: ["PostgreSQL", "Database", "Drizzle", "SQL", "Scaling"],
    content: `## Why Single-Table Architectures Collapse

In blogging platforms and creator networks, high-frequency tables like post_views, post_reactions, and activity_notifications exhibit distinct write patterns:
- Heavy append traffic during peak hours
- Read queries concentrated almost entirely on the latest 30 days
- Costly vacuum locks and index bloat over time

Declarative table partitioning allows us to maintain microsecond query performance regardless of total table cardinality.

### Partitioning by Range on Timestamps

\`\`\`sql
CREATE TABLE post_views_partitioned (
    id BIGSERIAL,
    post_id INT NOT NULL,
    user_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
\`\`\`

### Key Takeaways for Teams
1. Always include the partition key in composite primary keys.
2. Ensure automated cron workers pre-allocate future partition slices.
3. Leverage partition pruning in query planner execution plans.`,
  },
  {
    title: "Designing for Kinetic Typographic Hierarchy on the Modern Web",
    slug: "kinetic-typographic-hierarchy-modern-web",
    description:
      "How variable fonts, optical sizing, and fluid clamp scales elevate digital storytelling into an editorial art form.",
    category: "Design Systems",
    coverImage:
      "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "sofia.rostova@velo.design",
    tags: ["Typography", "CSS", "Design Systems", "Frontend", "Editorial"],
    content: `## Words as Architecture

Typography on the web is too often treated as an afterthought or a utility stylesheet. Yet in publishing platforms, the type is 95% of the user experience.

When typography is calibrated with precision:
- Reading fatigue vanishes
- Visual scanning becomes intuitive
- The brand voice resonates before the reader finishes the first sentence

Combining balanced headlines with comfortable line heights transforms digital articles into publication-grade reading experiences.`,
  },
  {
    title: "The Anatomy of a 10x Developer Platform: Lessons from Building VELO",
    slug: "anatomy-of-10x-developer-platform-lessons-from-velo",
    description:
      "Exploring the architectural patterns, latency optimizations, and developer ergonomics that power modern creator tools.",
    category: "Product Strategy",
    coverImage:
      "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "jordan.blake@velo.design",
    tags: ["Product Strategy", "SaaS", "Creators", "Web Development", "Analytics"],
    content: `## What Separates Great Tools from Average Ones?

Developer and creator tools share a common truth: practitioners demand uncompromised speed, predictable feedback loops, and intuitive discovery.

When we designed VELO, our mission was to eliminate all friction between capturing an insight and publishing it to a global audience.

### 1. Zero-Friction Authoring
Markdown and rich visual previews should never drift out of sync. Autosaving to local drafts paired with optimistic UI updates ensures creators never lose a thought to connectivity blips.

### 2. Analytics with Actionable Narrative
Raw charts do not help creators grow. Instead, analytics must answer direct questions:
- Which topics drive loyal returning readership?
- What time of day generates the highest engagement?
- How does current reach compare to historical baselines?`,
  },
  {
    title: "Scaling MongoDB Atlas for Multi-Tenant Creator Platforms at High Velocity",
    slug: "scaling-mongodb-atlas-multi-tenant-creator-platforms",
    description:
      "Architectural blueprint for schema design, compound indexing, aggregation pipelines, and connection pooling in cloud-native MongoDB Atlas environments.",
    category: "Database",
    coverImage:
      "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "maya.patel@velo.design",
    tags: ["MongoDB", "Database", "Atlas", "Backend", "Scaling", "NoSQL"],
    content: `## The Modern Document Store Paradigm

When scaling content systems with polymorphic post formats, variable analytics streams, and dynamic tag associations, rigid tabular schemas often require expensive multi-table joins.

MongoDB Atlas provides a native document model that fits modern JavaScript and TypeScript stacks seamlessly, offering horizontal scaling and flexible document structures.

### 1. Compound Index Strategies for Fast Feed Queries

To achieve sub-10ms response times across millions of published posts, compound indexes must mirror access patterns precisely:

\`\`\`javascript
// Optimize published post lookups with author filtering and reverse chronological ordering
db.posts.createIndex(
  { published: 1, authorId: 1, createdAt: -1 },
  { background: true, name: "idx_posts_published_author_created" }
);

// Full-text search index across titles, tags, and descriptions
db.posts.createIndex(
  { title: "text", description: "text", content: "text" },
  { weights: { title: 10, description: 5, content: 1 }, name: "idx_posts_text_search" }
);
\`\`\`

### 2. Resilient Connection Pooling in Next.js Serverless Functions

Serverless runtimes spin up and tear down instances dynamically. Maintaining a cached singleton connection across invocations prevents socket exhaustion:

\`\`\`typescript
import { MongoClient } from "mongodb";

let cachedClient: MongoClient | null = null;

export async function getDbClient() {
  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGODB_URI!, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 60000,
    });
    await cachedClient.connect();
  }
  return cachedClient;
}
\`\`\`

### 3. Aggregation Pipelines for Social Metrics

Using Atlas aggregation pipelines allows calculating engagement rates, bookmark counts, and follower signals in a single round-trip without overloading application memory.`,
  },
  {
    title: "Modern Authentication Architecture: Session Cookies, Multi-Tenant OAuth, and Passkeys",
    slug: "modern-authentication-architecture-session-cookies-oauth-passkeys",
    description:
      "How we engineered secure session management, OAuth callback verification, and brute-force defenses using Better Auth and distributed stores.",
    category: "Security",
    coverImage:
      "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "liam.oconnor@velo.design",
    tags: ["Authentication", "Security", "OAuth", "Better Auth", "Web Security"],
    content: `## Defense in Depth for Creator Platforms

Authentication is the front door of your product. If auth breaks or leaks credentials, user trust is destroyed instantly.

Modern web architectures must balance two competing goals: frictionless sign-in (e.g. one-click Google OAuth, WebAuthn Passkeys) and rigorous protection against CSRF, session fixation, and cross-origin leakage.

### 1. Strict Session Cookie Hygiene

Never store JWTs or sensitive bearer tokens in \`localStorage\`. They are vulnerable to XSS extraction. Instead, leverage partitioned, HttpOnly, SameSite cookies:

- **HttpOnly**: Completely blocks JavaScript access via \`document.cookie\`.
- **SameSite=Lax**: Prevents ambient cookie transmission in third-party cross-site request contexts.
- **Secure**: Restricts cookie transport strictly to HTTPS tunnels.

### 2. Dynamic Host Allowlisting & Proxy Trust

Behind reverse proxies like Vercel or Cloudflare, origin validation must dynamically check incoming \`x-forwarded-host\` headers against trusted domain patterns while rejecting spoofed headers.

With Better Auth, specifying \`allowedHosts: ["*.vercel.app", "yourdomain.com"]\` ensures preview branches receive automatic CSRF protection without manual reconfiguration.

### 3. Passkey Readiness

Passkeys (FIDO2 / WebAuthn) replace vulnerable passwords with cryptographic public-key signatures. By eliminating shared secrets entirely, credential phishing is rendered mathematically impossible.`,
  },
  {
    title: "Mastering React 19 Actions, Server Functions, and Optimistic UI Mutations",
    slug: "mastering-react-19-actions-server-functions-optimistic-mutations",
    description:
      "A masterclass in eliminating client-side loading spinners with useActionState, useOptimistic, and zero-bundle server mutations.",
    category: "Engineering",
    coverImage:
      "https://images.unsplash.com/photo-1633356122544-f134324a6cee?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "elena.vance@velo.design",
    tags: ["React", "Next.js", "Frontend", "JavaScript", "TypeScript"],
    content: `## The End of \`useEffect\` Data Mutations

For years, React developers wrote boilerplate state variables (\`isLoading\`, \`error\`, \`data\`) alongside \`useEffect\` hooks to manage form submissions and like buttons.

React 19 revolutionizes this workflow by treating asynchronous state transitions as first-class citizens.

### 1. Zero-Flicker Optimistic UI

When a reader clicks the like button or bookmarks a post, the interface should respond within a single animation frame (16ms), long before the server confirms the mutation:

\`\`\`tsx
"use client";
import { useOptimistic, useTransition } from "react";
import { togglePostReaction } from "@/actions/social-actions";

export function LikeButton({ postId, initialLikes }: { postId: number; initialLikes: number }) {
  const [isPending, startTransition] = useTransition();
  const [likes, setOptimisticLikes] = useOptimistic(
    initialLikes,
    (current, delta: number) => current + delta
  );

  const handleLike = () => {
    startTransition(async () => {
      setOptimisticLikes(1);
      await togglePostReaction(postId, "like");
    });
  };

  return (
    <button onClick={handleLike} className="flex items-center gap-2 font-medium">
      <span>❤️</span>
      <span>{likes}</span>
    </button>
  );
}
\`\`\`

### 2. Server Functions as Direct RPC Endpoints

Server actions eliminate the need for manual API route boilerplate. They provide automatic type inference, input sanitization via Zod, and granular cache tag revalidation in one unified syntax.`,
  },
  {
    title: "Sub-Millisecond Read Latency: Multi-Tier Caching with Upstash Redis and Next.js",
    slug: "sub-millisecond-read-latency-upstash-redis-nextjs",
    description:
      "Designing a resilient read-through cache architecture with TTL invalidation, distributed locks, and database fallback circuits.",
    category: "Performance",
    coverImage:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "jordan.blake@velo.design",
    tags: ["Performance", "Redis", "Caching", "Next.js", "Edge"],
    content: `## The Latency Pyramid in Web Applications

Every database query carries network overhead. When an article trends on social media and receives thousands of requests per second, querying MongoDB or PostgreSQL on every request quickly degrades responsiveness.

A multi-tier caching strategy guarantees sub-10ms response times globally.

### 1. Cache-Aside Pattern with Automatic Circuit Breakers

In VELO, our caching layer is built to be resilient: if the Redis cluster ever becomes unreachable, queries fail open and transparently query the primary database:

\`\`\`typescript
export async function runCached<T>(
  keySegments: (string | number)[],
  tags: string[],
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cacheKey = keySegments.join(":");
  
  try {
    const cached = await redis.get<T>(cacheKey);
    if (cached !== null) return cached;
  } catch (err) {
    console.warn("Redis read failed, falling back to database:", err);
  }

  const freshData = await fetcher();

  try {
    await redis.set(cacheKey, freshData, { ex: ttlSeconds });
  } catch (err) {
    // Non-blocking write failure logging
  }

  return freshData;
}
\`\`\`

### 2. Tag-Based Invalidation

Instead of guessing raw keys to clear, tag-based invalidation allows flushing all posts belonging to an author or topic with a single tag broadcast.`,
  },
  {
    title: "Zero-Config Modern Styling: Migrating to Tailwind CSS v4 and CSS Cascade Layers",
    slug: "zero-config-styling-migrating-tailwind-css-v4",
    description:
      "Adopting Tailwind CSS v4's high-speed CSS-first engine, container queries, and seamless dark mode tokens without config fatigue.",
    category: "Design Systems",
    coverImage:
      "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "marcus.chen@velo.design",
    tags: ["Tailwind", "CSS", "UI/UX", "Design Systems", "Frontend"],
    content: `## The Next Evolution of Utility CSS

Tailwind CSS v4 is a ground-up rewrite engineered in Rust. It eliminates \`tailwind.config.js\` entirely in favor of native CSS syntax powered by \`@theme\` directives and cascade layers.

### 1. CSS-First Design Tokens

Defining custom typography, color tokens, and animation curves now happens directly inside \`globals.css\`:

\`\`\`css
@import "tailwindcss";

@theme {
  --font-editorial: "Plus Jakarta Sans", sans-serif;
  --color-brand-primary: hsl(265 85% 60%);
  --color-surface-glass: hsl(240 10% 4% / 0.8);
  --radius-card: 1rem;
}
\`\`\`

### 2. Native CSS Container Queries

Breakpoints based solely on viewport width are no longer sufficient for modular component architecture. Container queries allow a post card to re-layout from vertical to horizontal based on its immediate parent container's width, not the whole window.

### 3. Build Times Slashed by 10x

By ditching Babel and heavy PostCSS plugins, development recompilations drop from hundreds of milliseconds to single-digit milliseconds, making UI design truly feel real-time.`,
  },
  {
    title: "Building Production Multi-Agent Systems with Long-Term Vector Memory and Function Calling",
    slug: "building-production-multi-agent-systems-vector-memory",
    description:
      "Orchestrating autonomous LLM pipelines that plan, browse, execute tools, and maintain persistent semantic state across sessions.",
    category: "AI & Research",
    coverImage:
      "https://images.unsplash.com/photo-1677442136019-21780efad99a?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "kai.takahashi@velo.design",
    tags: ["AI", "Agents", "LLM", "Vector DB", "Embeddings"],
    content: `## From Chatbots to Autonomous Digital Colleagues

Prompt engineering alone does not make an agent. Production-grade agentic architectures require four non-negotiable pillars:

1. **Deterministic Structured Output**: Validating tool call payloads with strict schemas.
2. **Context Window Compression**: Distilling conversation history into condensed working memories.
3. **Execution Guardrails**: Sandboxed tool runners with explicit approval loops for destructive actions.
4. **Adversarial Self-Critique**: A secondary verification pass before presenting results to human operators.

### Semantic Memory Retrieval Loop

When an agent needs context from past research, querying high-dimensional embedding vectors locates relevant insights within milliseconds:

\`\`\`typescript
export async function retrieveAgentContext(query: string, limit = 5) {
  const queryVector = await generateEmbedding(query);

  const matchedMemories = await vectorStore.search({
    vector: queryVector,
    filter: { confidenceScore: { $gte: 0.85 } },
    topK: limit,
  });

  return matchedMemories.map((m) => m.documentText);
}
\`\`\`

Combining dense vector search with lexical BM25 indexing (hybrid search) yields superior retrieval accuracy for technical terminology and code symbols.`,
  },
  {
    title: "Global Edge Computing: Deploying Serverless Functions with Zero Cold Starts",
    slug: "global-edge-computing-serverless-functions-zero-cold-starts",
    description:
      "How modern edge infrastructure, V8 isolates, and global distributed routing revolutionize backend execution speed.",
    category: "DevOps",
    coverImage:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "liam.oconnor@velo.design",
    tags: ["DevOps", "Edge", "Cloudflare", "Serverless", "Architecture"],
    content: `## The End of Regional Latency Bottlenecks

Traditional cloud servers host applications in a single availability zone (e.g., \`us-east-1\`). For users in Tokyo, London, or Sydney, every round-trip packet must cross oceans, incurring 150ms+ of physical speed-of-light delay.

Edge computing moves logic to hundreds of points of presence (PoPs) worldwide, executing within 10ms of the end user.

### V8 Isolates vs Docker Containers

Standard serverless functions package micro-VMs or container images. When a container spins up from cold, it can take 500ms to 2 seconds to initialize Node.js runtime bindings.

In contrast, V8 Isolates run thousands of isolated browser-grade JavaScript processes inside a shared heap:
- Startup time: **< 5ms**
- Memory footprint per isolate: **~ 3 MB**
- Instant global distribution upon git push

When coupled with geo-replicated databases and regional caching, applications become indistinguishable from local software.`,
  },
  {
    title: "Crafting High-Frequency Interactive Analytics Dashboards with Recharts and Canvas",
    slug: "crafting-high-frequency-analytics-dashboards-recharts",
    description:
      "Building reactive creator analytics with smooth line transitions, dual-axis comparison curves, and accessible data tables.",
    category: "Data Visualization",
    coverImage:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1600&auto=format&fit=crop",
    authorEmail: "sofia.rostova@velo.design",
    tags: ["Analytics", "Data Visualization", "Recharts", "UI/UX", "Dashboard"],
    content: `## Visualizing Growth Without Cognitive Overload

Analytics dashboards fail when they dump numbers without narrative context. A creator does not just want to see "12,400 views"; they need to understand:
- Is this higher or lower than typical performance?
- What caused the spike on Tuesday?
- Are readers finishing long-form articles or bouncing at the headline?

### Dual-Period Comparative Charting

In VELO, we built our charts using Recharts with custom SVG gradients and smooth Bézier curve interpolation:

\`\`\`tsx
<ResponsiveContainer width="100%" height={280}>
  <AreaChart data={chartData}>
    <defs>
      <linearGradient id="currentViews" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
      </linearGradient>
    </defs>
    <Tooltip content={<CustomAnalyticsTooltip />} />
    <Area
      type="monotone"
      dataKey="currentViews"
      stroke="hsl(var(--primary))"
      strokeWidth={2.5}
      fill="url(#currentViews)"
    />
  </AreaChart>
</ResponsiveContainer>
\`\`\`

By combining crisp visuals with dark-mode optimized color palettes, data transforms into an inspiring creator command center.`,
  },
];

async function seed() {
  console.log("[seed] Connecting to MongoDB Atlas database...");
  const client = new MongoClient(connectionString);

  try {
    await client.connect();
    console.log("[seed] Connected successfully.");
    const db = client.db();

    const usersCol = db.collection("users");
    const postsCol = db.collection("posts");
    const tagsCol = db.collection("tags");
    const postTagsCol = db.collection("postTags");
    const postReactionsCol = db.collection("postReactions");
    const countersCol = db.collection("counters");

    async function getNextSeq(name) {
      const res = await countersCol.findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" }
      );
      return res?.seq ?? 1;
    }

    // Insert Authors
    const authorIdMap = new Map();
    for (const author of SEED_AUTHORS) {
      const existing = await usersCol.findOne({ email: author.email });
      if (existing) {
        authorIdMap.set(author.email, existing.id || String(existing._id));
        console.log(`[seed] Author already exists: ${author.name}`);
      } else {
        await usersCol.insertOne({
          id: author.id,
          name: author.name,
          email: author.email,
          image: author.image,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        authorIdMap.set(author.email, author.id);
        console.log(`[seed] Created author: ${author.name}`);
      }
    }

    // Insert Posts
    for (const post of SEED_POSTS) {
      const authorId = authorIdMap.get(post.authorEmail);
      if (!authorId) continue;

      let pDoc = await postsCol.findOne({ slug: post.slug });
      let postId;
      if (pDoc) {
        postId = pDoc.id;
        console.log(`[seed] Post already exists: ${post.title}`);
      } else {
        postId = await getNextSeq("posts");
        pDoc = {
          id: postId,
          title: post.title,
          description: post.description,
          category: post.category,
          status: "published",
          slug: post.slug,
          coverImage: post.coverImage,
          content: post.content,
          published: true,
          publishedAt: new Date(),
          authorId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await postsCol.insertOne(pDoc);
        console.log(`[seed] Created post: ${post.title} (id: ${postId})`);

        // Seed initial like
        const rxExisting = await postReactionsCol.findOne({ postId, userId: authorId });
        if (!rxExisting) {
          const rxId = await getNextSeq("postReactions");
          await postReactionsCol.insertOne({
            id: rxId,
            postId,
            userId: authorId,
            type: "like",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      // Tags
      for (const tag of post.tags) {
        const tagSlug = tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        let tDoc = await tagsCol.findOne({ slug: tagSlug });
        let tagId;
        if (tDoc) {
          tagId = tDoc.id;
        } else {
          tagId = await getNextSeq("tags");
          tDoc = {
            id: tagId,
            name: tag,
            slug: tagSlug,
            createdAt: new Date(),
          };
          await tagsCol.insertOne(tDoc);
        }

        const ptExisting = await postTagsCol.findOne({ postId, tagId });
        if (!ptExisting) {
          const ptId = await getNextSeq("postTags");
          await postTagsCol.insertOne({
            id: ptId,
            postId,
            tagId,
            createdAt: new Date(),
          });
        }
      }
    }

    console.log("[seed] Seeding completed successfully!");
  } catch (err) {
    console.error("[seed] Error during seeding:", err.message);
  } finally {
    await client.close();
  }
}

seed();
