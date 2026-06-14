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
    const { error } = await supabase
      .from("players")
      .upsert({
        id,
        nickname: currentNickname,
        created_at: createdAt,
        createdAt: createdAt
      }, { onConflict: "id" });

    if (error) {
      console.error("Supabase upsert players error:", error);
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
