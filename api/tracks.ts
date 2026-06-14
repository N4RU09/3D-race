import express from "express";

const app = express();
app.use(express.json());

const TRACK_DATA = [
  { id: "track-1", name: "Track 1: Beginner Speedway", difficulty: 1, description: "Broad high-speed turns designed for entry-level drivers." },
  { id: "track-2", name: "Track 2: Lakeside Curve", difficulty: 2, description: "Vast, flowing curves bordering a beautiful scenic backdrop." },
  { id: "track-3", name: "Track 3: Canyon Hairpins", difficulty: 3, description: "Tight mountainous bends requiring precise throttle adjustments." },
  { id: "track-4", name: "Track 4: Elevation Shift", difficulty: 4, description: "Frequent rises and drops that momentarily lift tires off the asphalt." },
  { id: "track-5", name: "Track 5: Alpine Maze", difficulty: 5, description: "A highly-complex multi-sequence combination calling for mastery." },
  { id: "track-6", name: "Track 6: Antigravity Grid", difficulty: 6, description: "The ultimate test with extremely narrow boundaries, extreme curves, and sharp angles." }
];

app.get("/api/tracks", (req, res) => {
  res.json(TRACK_DATA);
});

export default app;
