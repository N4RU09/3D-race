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
    
    // Dynamically retrieve records based on columns present in the active table schema
    let data: any[] | null = null;
    let queryError: any = null;

    // 1. Try snake_case query (standard)
    try {
      const res = await supabase
        .from("race_records")
        .select("*")
        .eq("track_id", trackId)
        .limit(200);
      if (!res.error) {
        data = res.data;
      } else {
        queryError = res.error;
      }
    } catch (e) {
      queryError = e;
    }

    // 2. Fallback to camelCase query
    if (!data) {
      try {
        const res = await supabase
          .from("race_records")
          .select("*")
          .eq("trackId", trackId)
          .limit(200);
        if (!res.error) {
          data = res.data;
        } else {
          queryError = res.error;
        }
      } catch (e) {
        queryError = e;
      }
    }

    // 3. Fallback to lowercase query
    if (!data) {
      try {
        const res = await supabase
          .from("race_records")
          .select("*")
          .eq("trackid", trackId)
          .limit(200);
        if (!res.error) {
          data = res.data;
        } else {
          queryError = res.error;
        }
      } catch (e) {
        queryError = e;
      }
    }

    // 4. Try ultimate fallback using .or if possible
    if (!data) {
      try {
        const res = await supabase
          .from("race_records")
          .select("*")
          .or(`trackId.eq.${trackId},track_id.eq.${trackId}`)
          .limit(200);
        if (!res.error) {
          data = res.data;
        } else {
          queryError = res.error;
        }
      } catch (e) {
        queryError = e;
      }
    }

    if (!data) {
      console.error("Supabase record fetch query failed:", queryError);
      res.status(500).json({ success: false, error: queryError?.message || "Database connection failed" });
      return;
    }

    // Fetch the latest nickname for each player from the players table as requested
    const playerIds = Array.from(new Set(data.map((item: any) => item.playerId ?? item.player_id ?? item.playerid).filter(Boolean)));
    const playerNicknames: Record<string, string> = {};

    if (playerIds.length > 0) {
      try {
        const { data: playersData, error: playersError } = await supabase
          .from("players")
          .select("id, nickname")
          .in("id", playerIds);
        
        if (!playersError && playersData) {
          playersData.forEach((p: any) => {
            playerNicknames[p.id] = p.nickname;
          });
        } else if (playersError) {
          console.warn("Could not fetch players profiles for fresh nickname mapping:", playersError.message);
        }
      } catch (err: any) {
        console.warn("Soft profile nickname query fail:", err?.message || err);
      }
    }

    // Deduplicate: group by playerId and keep only the fastest compile time
    const uniqueBests: Record<string, any> = {};

    data?.forEach((item: any) => {
      const pId = item.playerId ?? item.player_id ?? item.playerid ?? "unknown";
      const fTime = Number(item.finishTimeMs ?? item.finish_time_ms ?? item.finishtimems ?? 9999999);
      // Fallback to record-saved nickname if players table lookup is missing
      const freshNickname = playerNicknames[pId] || item.nickname || "Anonymous Racer";

      const current = {
        id: item.id,
        playerId: pId,
        nickname: freshNickname,
        trackId: item.trackId ?? item.track_id ?? item.trackid,
        finishTimeMs: fTime,
        createdAt: item.createdAt ?? item.created_at ?? item.createdat,
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
    res.status(500).json({ success: false, error: err?.message || "Database connection failed" });
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

    // Ensure player profile is Upserted safely supporting both layout schemas
    try {
      const playerPayloads = [
        { id: playerId, nickname: nickname, created_at: createdAt },
        { id: playerId, nickname: nickname, createdAt: createdAt },
        { id: playerId, nickname: nickname, created_at: createdAt, createdAt: createdAt }
      ];

      for (const pPayload of playerPayloads) {
        const { error: pErr } = await supabase
          .from("players")
          .upsert(pPayload, { onConflict: "id" });
        if (!pErr) break;
        console.warn("Attempted player upsert payload failed:", pErr.message);
      }
    } catch (err) {
      console.warn("Soft conflict with players table:", err);
    }

    // Save race record details via sequential try catch fallbacks for extreme schema compatibility
    let insertSuccess = false;
    let insertError: any = null;

    const payloads = [
      // 1. Pure snake_case (Postgres/Supabase recommended standard)
      {
        id: recordId,
        player_id: playerId,
        nickname: nickname,
        track_id: trackId,
        finish_time_ms: finishTimeMs,
        created_at: createdAt
      },
      // 2. Pure camelCase
      {
        id: recordId,
        playerId: playerId,
        nickname: nickname,
        trackId: trackId,
        finishTimeMs: finishTimeMs,
        createdAt: createdAt
      },
      // 3. Pure lowercase
      {
        id: recordId,
        playerid: playerId,
        nickname: nickname,
        trackid: trackId,
        finishtimems: finishTimeMs,
        createdat: createdAt
      },
      // 4. Mixed (original insert)
      {
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
      }
    ];

    for (const payload of payloads) {
      const { error: rErr } = await supabase
        .from("race_records")
        .insert(payload);
      
      if (!rErr) {
        insertSuccess = true;
        break;
      } else {
        insertError = rErr;
        console.warn("Record insert alternative failed, trying next layout. Error:", rErr.message);
      }
    }

    if (!insertSuccess) {
      console.error("Supabase record submission query failed:", insertError);
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
