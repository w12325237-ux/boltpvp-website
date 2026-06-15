import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI in Vercel Environment Variables");
}

let clientPromise;

if (!globalThis._boltpvpMongoPromise) {
  const client = new MongoClient(uri);
  globalThis._boltpvpMongoPromise = client.connect();
}

clientPromise = globalThis._boltpvpMongoPromise;

export async function getDB() {
  const client = await clientPromise;
  return client.db("boltpvp");
}
