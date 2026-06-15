import { getDB } from "./db.js";
import {
  id,
  readBody,
  send,
  getSession,
  requirePlayer,
  requireAdmin,
  publicTicket,
  handleError
} from "./utils.js";

export default async function handler(req, res) {
  try {
    const db = await getDB();
    const body = await readBody(req);
    const tickets = db.collection("tickets");

    if (req.method === "GET") {
      const adminSession = await getSession(req, body, "admin");
      if (adminSession) {
        const rows = await tickets.find({}).sort({ createdAt: -1 }).toArray();
        return send(res, 200, { ok: true, tickets: rows.map(publicTicket) });
      }

      const playerSession = await getSession(req, body, "player");
      if (!playerSession) return send(res, 401, { ok: false, error: "Login required" });

      const rows = await tickets.find({ userId: playerSession.userId }).sort({ createdAt: -1 }).toArray();
      return send(res, 200, { ok: true, tickets: rows.map(publicTicket) });
    }

    if (req.method !== "POST") {
      return send(res, 405, { ok: false, error: "Method not allowed" });
    }

    const action = body.action;

    if (action === "create") {
      const player = await requirePlayer(req, body);
      const createdAt = new Date();

      const ticket = {
        ticketId: "BOLT-" + Math.floor(100000 + Math.random() * 900000),
        userId: player.userId,
        ign: player.displayName || player.username,
        type: String(body.type || "General Support"),
        discord: String(body.discord || ""),
        order: String(body.order || ""),
        explain: String(body.explain || body.problem || ""),
        attachmentName: String(body.attachmentName || ""),
        status: "Pending",
        response: "",
        createdAt,
        updatedAt: createdAt
      };

      const result = await tickets.insertOne(ticket);
      const saved = await tickets.findOne({ _id: result.insertedId });

      return send(res, 200, { ok: true, ticket: publicTicket(saved) });
    }

    if (["reply", "solve", "unsolve"].includes(action)) {
      const admin = await requireAdmin(req, body);
      const ticketObjectId = id(body.id || body.ticketId);
      if (!ticketObjectId) return send(res, 400, { ok: false, error: "Invalid ticket id" });

      const update = {
        updatedAt: new Date()
      };

      if (action === "reply") {
        update.response = String(body.response || "");
        update.status = "Solved";
        update.solvedBy = {
          ign: admin.displayName || admin.username,
          rank: admin.rank
        };
      }

      if (action === "solve") {
        update.status = "Solved";
        update.solvedBy = {
          ign: admin.displayName || admin.username,
          rank: admin.rank
        };
      }

      if (action === "unsolve") {
        update.status = "Pending";
        update.solvedBy = null;
      }

      await tickets.updateOne({ _id: ticketObjectId }, { $set: update });
      const saved = await tickets.findOne({ _id: ticketObjectId });

      return send(res, 200, { ok: true, ticket: publicTicket(saved) });
    }

    return send(res, 400, { ok: false, error: "Unknown action" });
  } catch (error) {
    return handleError(res, error);
  }
}
