import fs from "fs";
import path from "path";
import { MongoClient, ObjectId } from "mongodb";

function loadEnv() {
  const envContent = fs.readFileSync(".env", "utf-8");
  const env = {};
  for (const line of envContent.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx !== -1) {
      let v = t.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[t.slice(0, idx).trim()] = v;
    }
  }
  return env;
}

async function run() {
  const env = loadEnv();
  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  console.log("Connected to MongoDB.");

  // 1. Backfill 'id' on users collection where 'id' is missing
  const usersWithoutId = await db.collection("users").find({
    $or: [{ id: { $exists: false } }, { id: null }, { id: "" }]
  }).toArray();

  console.log(`Found ${usersWithoutId.length} users without 'id' field.`);

  for (const u of usersWithoutId) {
    const idString = String(u._id);
    await db.collection("users").updateOne(
      { _id: u._id },
      { $set: { id: idString } }
    );
    console.log(`Updated user ${u.email || u.name || u._id} -> id: ${idString}`);
  }

  // 2. Also check all posts to ensure authorId is string
  const posts = await db.collection("posts").find({}).toArray();
  for (const p of posts) {
    const authorIdStr = String(p.authorId);
    if (typeof p.authorId !== "string") {
      await db.collection("posts").updateOne(
        { _id: p._id },
        { $set: { authorId: authorIdStr } }
      );
      console.log(`Normalized post ${p.id} (${p.title}) authorId to string: ${authorIdStr}`);
    }

    // Verify author exists
    const author = await db.collection("users").findOne({
      $or: [
        { id: authorIdStr },
        { _id: authorIdStr },
        ...(ObjectId.isValid(authorIdStr) && String(new ObjectId(authorIdStr)) === authorIdStr
          ? [{ _id: new ObjectId(authorIdStr) }]
          : [])
      ]
    });

    if (author) {
      console.log(`Post ${p.id} "${p.title}" -> Author resolved: ${author.name} (${author.email})`);
    } else {
      console.warn(`Post ${p.id} "${p.title}" -> WARNING: Author NOT found for authorId: ${authorIdStr}`);
    }
  }

  await client.close();
  console.log("Backfill complete.");
}

run().catch(console.error);
