import bcrypt from "bcryptjs";
import { getDB } from "./db.js";
import {
  normalizeName,
  readBody,
  send,
  createSession,
  getSession,
  handleError
} from "./utils.js";

export default async function handler(req, res) {
  try {
    const db = await getDB();
    const body = await readBody(req);

    if (req.method === "GET") {
      const session = await getSession(req, body, "player");
      if (!session) return send(res, 200, { ok: true, user: null });
      return send(res, 200, {
        ok: true,
        user: {
          ign: session.displayName || session.username,
          username: session.username
        }
      });
    }

    if (req.method !== "POST") {
      return send(res, 405, { ok: false, error: "Method not allowed" });
    }

    const action = body.action;
    const ignRaw = String(body.ign || body.username || "").trim();
    const password = String(body.password || "");

    if (action === "logout") {
      const token = body.token || "";
      if (token) await db.collection("sessions").deleteOne({ token });
      return send(res, 200, { ok: true });
    }

    if (!ignRaw || !password) {
      return send(res, 400, { ok: false, error: "Username and password required" });
    }

    const username = normalizeName(ignRaw);
    const users = db.collection("users");

    if (action === "signup") {
      const exists = await users.findOne({ username });
      if (exists) return send(res, 409, { ok: false, error: "Account already exists" });

      const passwordHash = await bcrypt.hash(password, 10);
      const result = await users.insertOne({
        username,
        displayName: ignRaw,
        passwordHash,
        createdAt: new Date()
      });

      const user = await users.findOne({ _id: result.insertedId });
      const token = await createSession(db, "player", user);

      return send(res, 200, {
        ok: true,
        token,
        user: { ign: user.displayName, username: user.username }
      });
    }

    if (action === "login") {
      const user = await users.findOne({ username });
      if (!user) return send(res, 404, { ok: false, error: "Account not found" });

      const good = await bcrypt.compare(password, user.passwordHash);
      if (!good) return send(res, 401, { ok: false, error: "Wrong password" });

      const token = await createSession(db, "player", user);

      return send(res, 200, {
        ok: true,
        token,
        user: { ign: user.displayName, username: user.username }
      });
    }

    return send(res, 400, { ok: false, error: "Unknown action" });
  } catch (error) {
    return handleError(res, error);
  }
}
