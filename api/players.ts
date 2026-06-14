import express from "express";
import { getSupabase } from "./_supabase";

const app = express();
app.use(express.json());

app.post("/api/players", async (req, res) => {
  const { id, nickname } = req.body;
  if (!id || !nickname) {
    res.status(400).json({ error: "Missing id or nickname." });
    return;
  }

  const currentNickname = nickname.trim().substring(0, 16) || "Racer";
  const createdAt = new Date().toISOString();

  try {
    const supabase = getSupabase();
    // Safe sequential upsert for players to support any schema (snake_case, camelCase, mixed)
    let playerSuccess = false;
    let playerError: any = null;
    const playerPayloads = [
      {
        id,
        nickname: currentNickname,
        created_at: createdAt
      },
      {
        id,
        nickname: currentNickname,
        createdAt: createdAt
      },
      {
        id,
        nickname: currentNickname,
        created_at: createdAt,
        createdAt: createdAt
      }
    ];

    for (const pPayload of playerPayloads) {
      const { error: pErr } = await supabase
        .from("players")
        .upsert(pPayload, { onConflict: "id" });
      
      if (!pErr) {
        playerSuccess = true;
        break;
      } else {
        playerError = pErr;
        console.warn("Player upsert alternative failed:", pErr.message);
      }
    }

    if (!playerSuccess) {
      console.error("Supabase upsert players error:", playerError);
      res.status(500).json({ success: false, error: "Database connection failed" });
      return;
    }

    res.json({
      id,
      nickname: currentNickname,
      createdAt
    });
  } catch (err: any) {
    console.error("Supabase registration exception:", err);
    res.status(500).json({ success: false, error: "Database connection failed" });
  }
});

export default app;
