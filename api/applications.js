import { getDB } from "./db.js";
import {
  id,
  readBody,
  send,
  getSession,
  requirePlayer,
  requireAdmin,
  handleError
} from "./utils.js";

function publicApplication(app) {
  return {
    id: String(app._id),
    appId: app.appId,
    userId: app.userId ? String(app.userId) : null,
    ign: app.ign,
    type: app.type,
    answers: app.answers || {},
    status: app.status || "pending",
    response: app.response || "",
    respondedBy: app.respondedBy || "",
    respondedByRank: app.respondedByRank || "",
    createdAt: app.createdAt,
    updatedAt: app.updatedAt
  };
}

export default async function handler(req, res) {
  try {
    const db = await getDB();
    const body = await readBody(req);
    const applications = db.collection("applications");

    if (req.method === "GET") {
      const adminSession = await getSession(req, body, "admin");

      if (adminSession) {
        const rows = await applications.find({}).sort({ createdAt: -1 }).toArray();
        return send(res, 200, {
          ok: true,
          applications: rows.map(publicApplication)
        });
      }

      const playerSession = await getSession(req, body, "player");

      if (!playerSession) {
        return send(res, 401, {
          ok: false,
          error: "Login required"
        });
      }

      const rows = await applications
        .find({ userId: playerSession.userId })
        .sort({ createdAt: -1 })
        .toArray();

      return send(res, 200, {
        ok: true,
        applications: rows.map(publicApplication)
      });
    }

    if (req.method !== "POST") {
      return send(res, 405, {
        ok: false,
        error: "Method not allowed"
      });
    }

    const action = body.action;

    if (action === "create") {
      const player = await requirePlayer(req, body);

      const type = String(body.type || "").trim();
      const answers = body.answers && typeof body.answers === "object" ? body.answers : {};

      if (!type) {
        return send(res, 400, {
          ok: false,
          error: "Application type required"
        });
      }

      const now = new Date();

      const appDoc = {
        appId: "APP-" + Math.floor(100000 + Math.random() * 900000),
        userId: player.userId,
        ign: player.displayName || player.username,
        type,
        answers,
        status: "pending",
        response: "",
        respondedBy: "",
        respondedByRank: "",
        createdAt: now,
        updatedAt: now
      };

      const result = await applications.insertOne(appDoc);
      const saved = await applications.findOne({ _id: result.insertedId });

      return send(res, 200, {
        ok: true,
        application: publicApplication(saved)
      });
    }

    if (action === "accept" || action === "reject") {
      const admin = await requireAdmin(req, body);

      const appObjectId = id(body.id);
      if (!appObjectId) {
        return send(res, 400, {
          ok: false,
          error: "Invalid application id"
        });
      }

      const status = action === "accept" ? "accepted" : "rejected";
      const message = String(body.message || "").trim();

      await applications.updateOne(
        { _id: appObjectId },
        {
          $set: {
            status,
            response: message,
            respondedBy: admin.displayName || admin.username,
            respondedByRank: admin.rank || "Admin",
            updatedAt: new Date()
          }
        }
      );

      const saved = await applications.findOne({ _id: appObjectId });

      if (!saved) {
        return send(res, 404, {
          ok: false,
          error: "Application not found"
        });
      }

      return send(res, 200, {
        ok: true,
        application: publicApplication(saved)
      });
    }

    return send(res, 400, {
      ok: false,
      error: "Unknown action"
    });
  } catch (error) {
    return handleError(res, error);
  }
}
