import express from "express";
import { isSupabaseConfigured, getSupabase } from "./_supabase";

const app = express();
app.use(express.json());

app.get("/api/db-status", async (req, res) => {
  let currentError: any = null;
  let healthy = false;

  if (isSupabaseConfigured) {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("race_records")
        .select("id")
        .limit(1);
      if (error) {
        currentError = error;
        healthy = false;
      } else {
        healthy = true;
      }
    } catch (err: any) {
      currentError = { message: err?.message || String(err) };
      healthy = false;
    }
  }

  res.json({
    supabaseEnabled: isSupabaseConfigured,
    supabaseUrl: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 22)}...` : "",
    healthy,
    error: currentError,
    sqlScript: `-- Supabase SQL Editor 에서 아래의 쿼리를 실행해 테이블을 생성해주세요:

-- 1. players 테이블 생성
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) 비활성화하여 기록 통신 에러 방지
ALTER TABLE players DISABLE ROW LEVEL SECURITY;

-- 2. race_records 테이블 생성
CREATE TABLE IF NOT EXISTS race_records (
  id TEXT PRIMARY KEY,
  player_id TEXT,
  "playerId" TEXT,
  nickname TEXT NOT NULL,
  track_id TEXT,
  "trackId" TEXT,
  finish_time_ms BIGINT,
  "finishTimeMs" BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 비활성화하여 기록 통신 에러 방지
ALTER TABLE race_records DISABLE ROW LEVEL SECURITY;

-- 익명/유저 권한 올바르게 설정
GRANT ALL ON TABLE players TO anon;
GRANT ALL ON TABLE players TO authenticated;
GRANT ALL ON TABLE players TO service_role;

GRANT ALL ON TABLE race_records TO anon;
GRANT ALL ON TABLE race_records TO authenticated;
GRANT ALL ON TABLE race_records TO service_role;`
  });
});

export default app;
