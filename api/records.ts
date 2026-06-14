import express from "express";
import { getSupabase } from "./_supabase";

const app = express();
app.use(express.json());

// Get rankings (Top 10 deduplicated with single best per player)
app.get(["/api/records/:trackId", "/:trackId"], async (req, res) => {
  const { trackId } = req.params;
  if (!trackId) {
    res.status(400).json({ success: false, error: "trackId parameter is required" });
    return;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("race_records")
      .select("*")
      .or(`trackId.eq.${trackId},track_id.eq.${trackId}`)
      .limit(200);

    if (error) {
      console.error("Supabase record fetch query failed:", error);
      res.status(500).json({ success: false, error: "Database connection failed" });
      return;
    }

    // Deduplicate: group by playerId and keep only the fastest compile time
    const uniqueBests: Record<string, any> = {};

    data?.forEach((item: any) => {
      const pId = item.playerId ?? item.player_id ?? "unknown";
      const fTime = Number(item.finishTimeMs ?? item.finish_time_ms ?? 9999999);
      const current = {
        id: item.id,
        playerId: pId,
        nickname: item.nickname || "Anonymous Racer",
        trackId: item.trackId ?? item.track_id,
        finishTimeMs: fTime,
        createdAt: item.createdAt ?? item.created_at,
      };

      if (!uniqueBests[pId] || fTime < uniqueBests[pId].finishTimeMs) {
        uniqueBests[pId] = current;
      }
    });

    // Sort by finishTimeMs (ascending), then by oldest createdAt
    const sortedLeaderboard = Object.values(uniqueBests)
      .sort((a: any, b: any) => {
        if (a.finishTimeMs !== b.finishTimeMs) {
          return a.finishTimeMs - b.finishTimeMs;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })
      .slice(0, 10); // Return TOP 10 limit

    res.json(sortedLeaderboard);
  } catch (err: any) {
    console.error("Leaderboard retrieval failure:", err);
    res.status(500).json({ success: false, error: "Database connection failed" });
  }
});

// Save a new record
app.post(["/api/records", "/"], async (req, res) => {
  const { playerId, trackId, finishTimeMs, nickname: reqNickname } = req.body;
  if (!playerId || !trackId || typeof finishTimeMs !== "number") {
    res.status(400).json({ success: false, error: "Invalid parameters." });
    return;
  }

  const nickname = reqNickname ? String(reqNickname).trim().substring(0, 16) : "Anonymous Racer";
  const recordId = "rec-" + Math.random().toString(36).substr(2, 9);
  const createdAt = new Date().toISOString();

  try {
    const supabase = getSupabase();

    // Ensure player profile is Upserted
    try {
      await supabase
        .from("players")
        .upsert({
          id: playerId,
          nickname: nickname,
          created_at: createdAt,
          createdAt: createdAt
        }, { onConflict: "id" });
    } catch (err) {
      console.warn("Soft conflict with players table:", err);
    }

    // Save race record details
    const { error } = await supabase
      .from("race_records")
      .insert({
        id: recordId,
        player_id: playerId,
        playerId: playerId,
        nickname: nickname,
        track_id: trackId,
        trackId: trackId,
        finish_time_ms: finishTimeMs,
        finishTimeMs: finishTimeMs,
        created_at: createdAt,
        createdAt: createdAt
      });

    if (error) {
      console.error("Supabase record submission query failed:", error);
      res.status(500).json({ success: false, error: "Database connection failed" });
      return;
    }

    res.json({
      success: true,
      record: {
        id: recordId,
        playerId,
        nickname,
        trackId,
        finishTimeMs,
        createdAt
      }
    });
  } catch (err: any) {
    console.error("Race record submission error:", err);
    res.status(500).json({ success: false, error: "Database connection failed" });
  }
});

export default app;
