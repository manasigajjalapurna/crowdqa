const express = require("express");
const cors = require("cors");
const db = require("./db"); // This now uses the Postgres pool

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// SESSIONS (TA creates sessions, TA dashboard, TA summary)
// --------------------------------------------------------

// Session Creator Page
app.post("/api/sessions", async (req, res) => {
  const {
    course_name,
    recitation_date,
    duration_minutes,
    ta_name
  } = req.body;

  if (!course_name || !recitation_date || !duration_minutes || !ta_name) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Generate 4-digit numeric session code
  const session_code = Math.floor(1000 + Math.random() * 9000).toString();

  // Convert recitation_date (YYYY-MM-DD) into start/end times
  const starts_at = new Date(recitation_date + "T00:00:00");
  const ends_at = new Date(starts_at.getTime() + duration_minutes * 60000);

  // POSTGRES USES $1, $2 etc instead of ?
  const sql = `
    INSERT INTO sessions
    (session_code, course_name, recitation_date, duration_minutes, starts_at, ends_at, ta_name)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING session_id, session_code
  `;

  const values = [
    session_code,
    course_name,
    recitation_date,
    duration_minutes,
    starts_at,
    ends_at,
    ta_name
  ];

  try {
    const result = await db.query(sql, values);
    
    return res.status(201).json({
      success: true,
      session_id: result.rows[0].session_id,
      session_code: result.rows[0].session_code
    });
  } catch (err) {
    console.error("Error creating session:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Start Session (TA Dashboard button)
// --------------------------------------------------------
app.put("/api/sessions/:session_code/start", async (req, res) => {
  const sessionCode = req.params.session_code;

  try {
    // 1. Look up the session
    const lookupSql = `SELECT * FROM sessions WHERE session_code = $1`;
    const lookupResult = await db.query(lookupSql, [sessionCode]);

    if (lookupResult.rows.length === 0) {
      return res.status(404).json({ error: "Session not found." });
    }

    const session = lookupResult.rows[0];

    // 2. Prevent starting twice
    if (session.starts_at !== null) {
      return res.status(400).json({ error: "Session has already started." });
    }

    // 3. Compute new start and end times
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + session.duration_minutes * 60000);

    const updateSql = `
      UPDATE sessions
      SET starts_at = $1, ends_at = $2
      WHERE session_code = $3
    `;

    await db.query(updateSql, [startTime, endTime, sessionCode]);

    // 4. Return updated session details
    return res.json({
      success: true,
      session: {
        ...session,
        starts_at: startTime,
        ends_at: endTime
      }
    });
  } catch (err) {
    console.error("Error updating session:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// TA Summary PAGE
// --------------------------------------------------------
// GET SESSION METADATA
// --------------------------------------------------------
app.get("/api/sessions/:session_id", async (req, res) => {
  const { session_id } = req.params;

  const sql = `
    SELECT session_id, session_code, course_name, recitation_date,
           duration_minutes, ta_name, starts_at, ends_at
    FROM sessions
    WHERE session_id = $1
  `;

  try {
    const result = await db.query(sql, [session_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------------
// GET ACTIVE STUDENT COUNT
// --------------------------------------------------------
app.get("/api/sessions/:session_id/active-students", async (req, res) => {
  const { session_id } = req.params;

  const sql = `
    SELECT COUNT(*) AS active_students
    FROM students
    WHERE session_id = $1
  `;

  try {
    const result = await db.query(sql, [session_id]);
    res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------------
// GET RAW CLICKS + TOTAL
// --------------------------------------------------------
app.get("/api/sessions/:session_id/clicks", async (req, res) => {
  const { session_id } = req.params;

  const sql = `
    SELECT click_id, anon_id, clicked_at
    FROM clicks
    WHERE session_id = $1
    ORDER BY clicked_at ASC
  `;

  try {
    const result = await db.query(sql, [session_id]);
    
    res.json({
      total_clicks: result.rows.length,
      clicks: result.rows
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------------
// GET CLICK BINS (1–5 MIN INTERVALS)
// --------------------------------------------------------
app.get("/api/sessions/:session_id/click-intervals", async (req, res) => {
  const { session_id } = req.params;

  const sql = `
    SELECT bin_start_minute, bin_end_minute, click_count
    FROM minute_bins
    WHERE session_id = $1
    ORDER BY bin_start_minute ASC
  `;

  try {
    const result = await db.query(sql, [session_id]);
    
    res.json({
      interval_minutes: result.rows.length > 0
        ? result.rows[0].bin_end_minute - result.rows[0].bin_start_minute
        : 5,
      bins: result.rows
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------------
// END A SESSION
// --------------------------------------------------------
app.put("/api/sessions/:session_id/end", async (req, res) => {
  const { session_id } = req.params;

  const sql = `
    UPDATE sessions
    SET ends_at = NOW()
    WHERE session_id = $1
  `;

  try {
    await db.query(sql, [session_id]);
    res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------------
// FULL SESSION SUMMARY
// --------------------------------------------------------
app.get("/api/sessions/:session_id/summary", async (req, res) => {
  const { session_id } = req.params;

  try {
    // Run all queries in parallel for better performance
    const [sessionResult, clicksResult, studentsResult, binsResult, notesResult] = await Promise.all([
      db.query(`
        SELECT session_id, course_name, duration_minutes, ta_name
        FROM sessions
        WHERE session_id = $1
      `, [session_id]),
      
      db.query(`
        SELECT COUNT(*) AS total_clicks
        FROM clicks
        WHERE session_id = $1
      `, [session_id]),
      
      db.query(`
        SELECT COUNT(*) AS active_students
        FROM students
        WHERE session_id = $1
      `, [session_id]),
      
      db.query(`
        SELECT bin_start_minute, bin_end_minute, click_count
        FROM minute_bins
        WHERE session_id = $1
        ORDER BY bin_start_minute ASC
      `, [session_id]),
      
      db.query(`
        SELECT anon_id, note, created_at
        FROM notes
        WHERE session_id = $1
        ORDER BY created_at ASC
      `, [session_id])
    ]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({
      session: sessionResult.rows[0],
      total_clicks: clicksResult.rows[0].total_clicks,
      active_students: studentsResult.rows[0].active_students,
      bins: binsResult.rows,
      notes: notesResult.rows
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------------
// STUDENTS JOIN SESSION (Anonymous)
// --------------------------------------------------------
app.post("/api/sessions/:session_code/join", async (req, res) => {
  const { session_code } = req.params;

  try {
    // 1. Look up session by code
    const sessionResult = await db.query(`
      SELECT session_id, course_name, duration_minutes, starts_at, ends_at
      FROM sessions
      WHERE session_code = $1
    `, [session_code]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Invalid session code" });
    }

    const session = sessionResult.rows[0];
    const session_id = session.session_id;

    // 2. Get next anon_id for this session
    const anonResult = await db.query(`
      SELECT COALESCE(MAX(anon_id), 0) + 1 AS next_anon
      FROM students
      WHERE session_id = $1
    `, [session_id]);

    const anon_id = anonResult.rows[0].next_anon;

    // 3. Insert student record
    await db.query(`
      INSERT INTO students (session_id, anon_id)
      VALUES ($1, $2)
    `, [session_id, anon_id]);

    // 4. Return details needed by StudentView
    return res.json({
      success: true,
      session_id,
      anon_id,
      course_name: session.course_name,
      duration_minutes: session.duration_minutes,
      starts_at: session.starts_at,
      ends_at: session.ends_at
    });
  } catch (err) {
    console.error("Error joining session:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// CLICK EVENTS — student hits "I'm Confused"
// --------------------------------------------------------
app.post("/api/sessions/:session_id/click", async (req, res) => {
  const session_id = req.params.session_id;
  const { anon_id } = req.body;

  if (!anon_id) {
    return res.status(400).json({ error: "anon_id is required" });
  }

  try {
    // First verify student exists
    const studentCheck = await db.query(`
      SELECT * FROM students
      WHERE session_id = $1 AND anon_id = $2
    `, [session_id, anon_id]);

    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Student not found for this session" });
    }

    // Insert a click
    await db.query(`
      INSERT INTO clicks (session_id, anon_id)
      VALUES ($1, $2)
    `, [session_id, anon_id]);

    // Count total clicks for that student
    const countResult = await db.query(`
      SELECT COUNT(*) AS total
      FROM clicks
      WHERE session_id = $1 AND anon_id = $2
    `, [session_id, anon_id]);

    res.json({
      success: true,
      student_click_count: parseInt(countResult.rows[0].total)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// OPTIONAL NOTES (free-text notes from students)
// --------------------------------------------------------
app.post("/api/sessions/:session_id/notes", async (req, res) => {
  const session_id = req.params.session_id;
  const { anon_id, note } = req.body;

  if (!anon_id || !note) {
    return res.status(400).json({ error: "anon_id and note are required" });
  }

  try {
    // Verify student exists
    const studentCheck = await db.query(`
      SELECT * FROM students
      WHERE session_id = $1 AND anon_id = $2
    `, [session_id, anon_id]);

    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Insert note
    const result = await db.query(`
      INSERT INTO notes (session_id, anon_id, note)
      VALUES ($1, $2, $3)
      RETURNING note_id
    `, [session_id, anon_id, note]);

    res.status(201).json({
      success: true,
      note_id: result.rows[0].note_id
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------------
// TEST ROUTES (DB connection)
// --------------------------------------------------------
console.log("Registering /api/test-db route…");
app.get("/api/test-db", async (req, res) => {
  try {
    const result = await db.query('SELECT NOW() as now, version() as version');
    res.json({
      message: "Connected to Neon Postgres successfully!",
      timestamp: result.rows[0].now,
      version: result.rows[0].version
    });
  } catch (err) {
    console.error("Database connection error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------------
// SERVER STARTUP
// --------------------------------------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Test DB connection: http://localhost:${PORT}/api/test-db`);
});

// --------------------------------------------------------
// ERROR HANDLERS
// --------------------------------------------------------
process.on("exit", (code) => {
  console.log("Process exited with code:", code);
});

process.on("SIGINT", () => {
  console.log("Caught SIGINT, closing database pool...");
  db.end(() => {
    console.log("Database pool closed");
    process.exit();
  });
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

module.exports = app;
