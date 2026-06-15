import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDB } from "./db.js";

export function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

export function cleanAdminName(name) {
  return normalizeName(name).replace(/[\s._-]/g, "").replace(/[|il]/g, "1");
}

export function send(res, status, data) {
  res.status(status).json(data);
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return await new Promise((resolve) => {
    let raw = "";
    req.on("data", chunk => raw += chunk);
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export function getBearerToken(req, body = {}) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return body.token || body.adminToken || body.playerToken || "";
}

export function id(value) {
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

export async function createSession(db, type, user) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

  await db.collection("sessions").insertOne({
    token,
    type,
    userId: user._id,
    username: user.username,
    displayName: user.displayName,
    rank: user.rank || "Player",
    owner: !!user.owner,
    createdAt: now,
    expiresAt
  });

  return token;
}

export async function getSession(req, body = {}, type = null) {
  const token = getBearerToken(req, body);
  if (!token) return null;

  const db = await getDB();
  const session = await db.collection("sessions").findOne({
    token,
    expiresAt: { $gt: new Date() },
    ...(type ? { type } : {})
  });

  return session;
}

export async function requirePlayer(req, body = {}) {
  const session = await getSession(req, body, "player");
  if (!session) {
    const err = new Error("Player login required");
    err.status = 401;
    throw err;
  }
  return session;
}

export async function requireAdmin(req, body = {}, allowedRanks = null) {
  const session = await getSession(req, body, "admin");
  if (!session) {
    const err = new Error("Admin login required");
    err.status = 401;
    throw err;
  }

  if (allowedRanks && !allowedRanks.includes(session.rank)) {
    const err = new Error("Not enough admin permission");
    err.status = 403;
    throw err;
  }

  return session;
}

export function publicAdmin(admin) {
  return {
    id: String(admin._id),
    ign: admin.displayName || admin.username,
    username: admin.username,
    rank: admin.rank || "Admin",
    owner: !!admin.owner,
    createdAt: admin.createdAt
  };
}

export function publicTicket(ticket) {
  return {
    id: String(ticket._id),
    ticketId: ticket.ticketId,
    ign: ticket.ign,
    userId: ticket.userId ? String(ticket.userId) : null,
    type: ticket.type,
    discord: ticket.discord || "",
    order: ticket.order || "",
    explain: ticket.explain || "",
    attachmentName: ticket.attachmentName || "",
    status: ticket.status || "Pending",
    response: ticket.response || "",
    solvedBy: ticket.solvedBy || null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt
  };
}

export function publicUpdate(update) {
  return {
    id: String(update._id),
    title: update.title,
    desc: update.desc,
    images: update.images || [],
    author: update.author,
    authorId: update.authorId ? String(update.authorId) : null,
    rank: update.rank || "Admin",
    pinned: !!update.pinned,
    reactions: update.reactions || {},
    comments: (update.comments || []).map(c => ({
      id: c.id,
      author: c.author,
      body: c.body,
      createdAt: c.createdAt
    })),
    createdAt: update.createdAt,
    updatedAt: update.updatedAt
  };
}

export async function ensureOwnerAdmin(db) {
  const ownerName = process.env.OWNER_USERNAME || "ZenZboy";
  const ownerPassword = process.env.OWNER_PASSWORD || "boltpvp12";
  const username = normalizeName(ownerName);

  const existing = await db.collection("admins").findOne({ username });

  if (!existing) {
    const passwordHash = await bcrypt.hash(ownerPassword, 10);
    await db.collection("admins").insertOne({
      username,
      displayName: ownerName,
      passwordHash,
      rank: "Owner",
      owner: true,
      createdAt: new Date()
    });
    return;
  }

  await db.collection("admins").updateOne(
    { _id: existing._id },
    { $set: { rank: "Owner", owner: true, displayName: existing.displayName || ownerName } }
  );
}

export function handleError(res, error) {
  send(res, error.status || 500, {
    ok: false,
    error: error.message || "Server error"
  });
}
