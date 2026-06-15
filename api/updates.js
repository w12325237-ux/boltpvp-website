import crypto from "crypto";
import { getDB } from "./db.js";
import {
  id,
  readBody,
  send,
  getSession,
  requireAdmin,
  publicUpdate,
  handleError
} from "./utils.js";

export default async function handler(req, res) {
  try {
    const db = await getDB();
    const body = await readBody(req);
    const updates = db.collection("updates");

    if (req.method === "GET") {
      const rows = await updates.find({}).sort({ pinned: -1, createdAt: -1 }).toArray();
      return send(res, 200, { ok: true, updates: rows.map(publicUpdate) });
    }

    if (req.method !== "POST") {
      return send(res, 405, { ok: false, error: "Method not allowed" });
    }

    const action = body.action;

    if (action === "create") {
      const admin = await requireAdmin(req, body);
      const now = new Date();

      const doc = {
        title: String(body.title || "").trim(),
        desc: String(body.desc || "").trim(),
        images: Array.isArray(body.images) ? body.images : [],
        authorId: admin.userId,
        author: admin.displayName || admin.username,
        rank: admin.rank,
        pinned: false,
        reactions: { "🔥": 0, "❤️": 0, "😂": 0, "😮": 0, "👍": 0 },
        reactedBy: {},
        comments: [],
        createdAt: now,
        updatedAt: now
      };

      if (!doc.title || !doc.desc) return send(res, 400, { ok: false, error: "Title and description required" });

      const result = await updates.insertOne(doc);
      const saved = await updates.findOne({ _id: result.insertedId });
      return send(res, 200, { ok: true, update: publicUpdate(saved) });
    }

    if (action === "edit") {
      const admin = await requireAdmin(req, body);
      const updateId = id(body.id);
      if (!updateId) return send(res, 400, { ok: false, error: "Invalid update id" });

      const old = await updates.findOne({ _id: updateId });
      if (!old) return send(res, 404, { ok: false, error: "Update not found" });

      const isOwner = admin.rank === "Owner";
      const isPoster = String(old.authorId) === String(admin.userId);
      if (!isOwner && !isPoster) return send(res, 403, { ok: false, error: "Only poster or Owner can edit" });

      await updates.updateOne(
        { _id: updateId },
        {
          $set: {
            title: String(body.title || old.title),
            desc: String(body.desc || old.desc),
            images: Array.isArray(body.images) ? body.images : old.images,
            updatedAt: new Date()
          }
        }
      );

      const saved = await updates.findOne({ _id: updateId });
      return send(res, 200, { ok: true, update: publicUpdate(saved) });
    }

    if (action === "pin") {
      const admin = await requireAdmin(req, body, ["Owner"]);
      const updateId = id(body.id);
      if (!updateId) return send(res, 400, { ok: false, error: "Invalid update id" });

      const old = await updates.findOne({ _id: updateId });
      await updates.updateOne({ _id: updateId }, { $set: { pinned: !old?.pinned, updatedAt: new Date() } });
      const saved = await updates.findOne({ _id: updateId });
      return send(res, 200, { ok: true, update: publicUpdate(saved) });
    }

    if (action === "delete") {
      await requireAdmin(req, body, ["Owner"]);
      const updateId = id(body.id);
      if (!updateId) return send(res, 400, { ok: false, error: "Invalid update id" });

      await updates.deleteOne({ _id: updateId });
      return send(res, 200, { ok: true });
    }

    if (action === "comment") {
      const session = await getSession(req, body, "player") || await getSession(req, body, "admin");
      if (!session) return send(res, 401, { ok: false, error: "Login required to comment" });

      const updateId = id(body.id);
      if (!updateId) return send(res, 400, { ok: false, error: "Invalid update id" });

      const comment = {
        id: crypto.randomBytes(8).toString("hex"),
        author: session.displayName || session.username,
        body: String(body.comment || body.body || "").trim(),
        createdAt: new Date()
      };

      if (!comment.body) return send(res, 400, { ok: false, error: "Comment cannot be empty" });

      await updates.updateOne({ _id: updateId }, { $push: { comments: comment }, $set: { updatedAt: new Date() } });
      const saved = await updates.findOne({ _id: updateId });
      return send(res, 200, { ok: true, update: publicUpdate(saved) });
    }

    if (action === "react") {
      const session = await getSession(req, body, "player") || await getSession(req, body, "admin");
      if (!session) return send(res, 401, { ok: false, error: "Login required to react" });

      const updateId = id(body.id);
      const emoji = String(body.emoji || "👍");
      if (!updateId) return send(res, 400, { ok: false, error: "Invalid update id" });

      await updates.updateOne(
        { _id: updateId },
        {
          $inc: { [`reactions.${emoji}`]: 1 },
          $set: { updatedAt: new Date() }
        }
      );

      const saved = await updates.findOne({ _id: updateId });
      return send(res, 200, { ok: true, update: publicUpdate(saved) });
    }

    return send(res, 400, { ok: false, error: "Unknown action" });
  } catch (error) {
    return handleError(res, error);
  }
}
