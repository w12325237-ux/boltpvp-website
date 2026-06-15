import bcrypt from "bcryptjs";
import { getDB } from "./db.js";
import {
  normalizeName,
  cleanAdminName,
  readBody,
  send,
  createSession,
  requireAdmin,
  ensureOwnerAdmin,
  publicAdmin,
  handleError
} from "./utils.js";

const MANAGE_RANKS = ["Owner", "Executive"];

async function findAdmin(db, usernameRaw) {
  const admins = await db.collection("admins").find({}).toArray();
  const clean = cleanAdminName(usernameRaw);
  return admins.find(a => normalizeName(a.displayName || a.username) === normalizeName(usernameRaw))
    || admins.find(a => cleanAdminName(a.displayName || a.username) === clean)
    || null;
}

export default async function handler(req, res) {
  try {
    const db = await getDB();
    await ensureOwnerAdmin(db);
    const body = await readBody(req);

    if (req.method === "GET") {
      await requireAdmin(req, body, MANAGE_RANKS);
      const admins = await db.collection("admins").find({}).sort({ rank: 1, displayName: 1 }).toArray();
      return send(res, 200, { ok: true, admins: admins.map(publicAdmin) });
    }

    if (req.method !== "POST") {
      return send(res, 405, { ok: false, error: "Method not allowed" });
    }

    const action = body.action;

    if (action === "login") {
      const usernameRaw = String(body.ign || body.username || "").trim();
      const password = String(body.password || "").trim();

      if (!usernameRaw || !password) {
        return send(res, 400, { ok: false, error: "Admin username and password required" });
      }

      const admin = await findAdmin(db, usernameRaw);
      if (!admin) return send(res, 404, { ok: false, error: "Admin account not found" });

      const good = await bcrypt.compare(password, admin.passwordHash);
      if (!good) return send(res, 401, { ok: false, error: "Wrong admin password" });

      const token = await createSession(db, "admin", {
        _id: admin._id,
        username: admin.username,
        displayName: admin.displayName,
        rank: admin.rank,
        owner: admin.owner
      });

      return send(res, 200, {
        ok: true,
        token,
        admin: publicAdmin(admin)
      });
    }

    if (action === "logout") {
      const token = body.token || "";
      if (token) await db.collection("sessions").deleteOne({ token, type: "admin" });
      return send(res, 200, { ok: true });
    }

    if (action === "add") {
      const current = await requireAdmin(req, body, MANAGE_RANKS);

      const ignRaw = String(body.ign || body.username || "").trim();
      const password = String(body.password || "").trim();
      const rank = String(body.rank || "Admin").trim();

      if (!ignRaw || !password) return send(res, 400, { ok: false, error: "IGN and password required" });

      if (rank === "Owner" && current.rank !== "Owner") {
        return send(res, 403, { ok: false, error: "Only Owner can create another Owner" });
      }

      const username = normalizeName(ignRaw);
      const old = await findAdmin(db, ignRaw);
      const passwordHash = await bcrypt.hash(password, 10);

      const doc = {
        username,
        displayName: ignRaw,
        passwordHash,
        rank,
        owner: rank === "Owner",
        createdAt: new Date()
      };

      if (old) {
        await db.collection("admins").updateOne({ _id: old._id }, { $set: doc });
      } else {
        await db.collection("admins").insertOne(doc);
      }

      return send(res, 200, { ok: true });
    }

    if (action === "remove") {
      const current = await requireAdmin(req, body, MANAGE_RANKS);
      const target = await findAdmin(db, body.ign || body.username || "");

      if (!target) return send(res, 404, { ok: false, error: "Admin not found" });
      if (target.owner && current.rank !== "Owner") return send(res, 403, { ok: false, error: "Only Owner can remove Owner" });
      if (target.owner && normalizeName(target.displayName) === normalizeName(process.env.OWNER_USERNAME || "ZenZboy")) {
        return send(res, 403, { ok: false, error: "Main owner is locked" });
      }

      await db.collection("admins").deleteOne({ _id: target._id });
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { ok: false, error: "Unknown action" });
  } catch (error) {
    return handleError(res, error);
  }
}
