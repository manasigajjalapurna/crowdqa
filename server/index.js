const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// SESSIONS (TA creates sessions, TA dashboard, TA summary)
// --------------------------------------------------------

// Session Creator Page
app.post("/api/sessions", (req, res) => {
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
    // Assumption: session starts immediately at the beginning of recitation_date,
    // but if you want a time input we can adjust this later.
    const starts_at = new Date(recitation_date + "T00:00:00");
    const ends_at = new Date(starts_at.getTime() + duration_minutes * 60000);

    const sql = `
      INSERT INTO sessions
      (session_code, course_name, recitation_date, duration_minutes, starts_at, ends_at, ta_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
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

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error("Error creating session:", err.message);
        return res.status(500).json({ error: err.message });
      }

      return res.status(201).json({
        success: true,
        session_id: result.insertId,
        session_code
      });
    });
  });

// Start Session (TA Dashboard button)
// --------------------------------------------------------
app.put("/api/sessions/:session_code/start", (req, res) => {
  const sessionCode = req.params.session_code;

  // 1. Look up the session
  const lookupSql = `SELECT * FROM sessions WHERE session_code = ?`;

  db.query(lookupSql, [sessionCode], (err, results) => {
    if (err) {
      console.error("Error fetching session:", err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Session not found." });
    }

    const session = results[0];

    // 2. Prevent starting twice
    if (session.starts_at !== null) {
      return res.status(400).json({ error: "Session has already started." });
    }

    // 3. Compute new start and end times
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + session.duration_minutes * 60000);

    const updateSql = `
      UPDATE sessions
      SET starts_at = ?, ends_at = ?
      WHERE session_code = ?
    `;

    db.query(updateSql, [startTime, endTime, sessionCode], (err2) => {
      if (err2) {
        console.error("Error updating session start time:", err2.message);
        return res.status(500).json({ error: err2.message });
      }

      // 4. Return updated session details
      return res.json({
        success: true,
        session: {
          ...session,
          starts_at: startTime,
          ends_at: endTime
        }
      });
    });
  });
});

// TA Summary PAGE
// --------------------------------------------------------
// GET SESSION METADATA
// --------------------------------------------------------
app.get("/api/sessions/:session_id", (req, res) => {
  const { session_id } = req.params;

  const sql = `
    SELECT session_id, session_code, course_name, recitation_date,
           duration_minutes, ta_name, start_time, end_time
    FROM sessions
    WHERE session_id = ?
  `;

  db.query(sql, [session_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: "Session not found" });

    res.json(results[0]);
  });
});

// --------------------------------------------------------
// GET ACTIVE STUDENT COUNT
// --------------------------------------------------------
app.get("/api/sessions/:session_id/active-students", (req, res) => {
  const { session_id } = req.params;

  const sql = `
    SELECT COUNT(*) AS active_students
    FROM students
    WHERE session_id = ?
  `;

  db.query(sql, [session_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results[0]);
  });
});

// --------------------------------------------------------
// GET RAW CLICKS + TOTAL
// --------------------------------------------------------
app.get("/api/sessions/:session_id/clicks", (req, res) => {
  const { session_id } = req.params;

  const sql = `
    SELECT click_id, anon_id, clicked_at
    FROM clicks
    WHERE session_id = ?
    ORDER BY clicked_at ASC
  `;

  db.query(sql, [session_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({
      total_clicks: results.length,
      clicks: results
    });
  });
});

// --------------------------------------------------------
// GET CLICK BINS (1–5 MIN INTERVALS)
// --------------------------------------------------------
app.get("/api/sessions/:session_id/click-intervals", (req, res) => {
  const { session_id } = req.params;

  const sql = `
    SELECT bin_start_minute, bin_end_minute, click_count
    FROM minute_bins
    WHERE session_id = ?
    ORDER BY bin_start_minute ASC
  `;

  db.query(sql, [session_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({
      interval_minutes: results.length > 0
        ? results[0].bin_end_minute - results[0].bin_start_minute
        : 5,
      bins: results
    });
  });
});

// --------------------------------------------------------
// END A SESSION
// --------------------------------------------------------
app.put("/api/sessions/:session_id/end", (req, res) => {
  const { session_id } = req.params;

  const sql = `
    UPDATE sessions
    SET end_time = NOW()
    WHERE session_id = ?
  `;

  db.query(sql, [session_id], (err) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json({ success: true });
  });
});

// --------------------------------------------------------
// FULL SESSION SUMMARY
// --------------------------------------------------------
app.get("/api/sessions/:session_id/summary", (req, res) => {
  const { session_id } = req.params;

  const sessionSQL = `
    SELECT session_id, course_name, duration_minutes, ta_name
    FROM sessions
    WHERE session_id = ?
  `;

  const totalClicksSQL = `
    SELECT COUNT(*) AS total_clicks
    FROM clicks
    WHERE session_id = ?
  `;

  const activeStudentsSQL = `
    SELECT COUNT(*) AS active_students
    FROM students
    WHERE session_id = ?
  `;

  const binsSQL = `
    SELECT bin_start_minute, bin_end_minute, click_count
    FROM minute_bins
    WHERE session_id = ?
    ORDER BY bin_start_minute ASC
  `;

  const notesSQL = `
    SELECT anon_id, note, created_at
    FROM notes
    WHERE session_id = ?
    ORDER BY created_at ASC
  `;

  // Run nested queries cleanly
  db.query(sessionSQL, [session_id], (err, sessionRows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (sessionRows.length === 0) return res.status(404).json({ error: "Session not found" });

    db.query(totalClicksSQL, [session_id], (err, totalClicksRows) => {
      if (err) return res.status(500).json({ error: err.message });

      db.query(activeStudentsSQL, [session_id], (err, studentsRows) => {
        if (err) return res.status(500).json({ error: err.message });

        db.query(binsSQL, [session_id], (err, binsRows) => {
          if (err) return res.status(500).json({ error: err.message });

          db.query(notesSQL, [session_id], (err, notesRows) => {
            if (err) return res.status(500).json({ error: err.message });

            // Final combined response
            res.json({
              session: sessionRows[0],
              total_clicks: totalClicksRows[0].total_clicks,
              active_students: studentsRows[0].active_students,
              bins: binsRows,
              notes: notesRows
            });
          });
        });
      });
    });
  });
});



// --------------------------------------------------------
// STUDENTS JOIN SESSION (Anonymous)
// --------------------------------------------------------

app.post("/api/sessions/:session_code/join", (req, res) => {
  const { session_code } = req.params;

  // 1. Look up session by code
  const sessionSql = `
    SELECT session_id, course_name, duration_minutes, start_time, end_time
    FROM sessions
    WHERE session_code = ?
  `;

  db.query(sessionSql, [session_code], (err, sessionRows) => {
    if (err) {
      console.error("Error fetching session:", err.message);
      return res.status(500).json({ error: err.message });
    }
    if (sessionRows.length === 0) {
      return res.status(404).json({ error: "Invalid session code" });
    }

    const session = sessionRows[0];
    const session_id = session.session_id;

    // 2. Compute next anon_id for this session
    const anonSql = `
      SELECT COALESCE(MAX(anon_id), 0) + 1 AS nextAnon
      FROM students
      WHERE session_id = ?
    `;

    db.query(anonSql, [session_id], (err2, anonRows) => {
      if (err2) {
        console.error("Error generating anon_id:", err2.message);
        return res.status(500).json({ error: err2.message });
      }

      const anon_id = anonRows[0].nextAnon;

      // 3. Insert student record
      const insertSql = `
        INSERT INTO students (session_id, anon_id)
        VALUES (?, ?)
      `;

      db.query(insertSql, [session_id, anon_id], (err3) => {
        if (err3) {
          console.error("Error inserting student:", err3.message);
          return res.status(500).json({ error: err3.message });
        }

        // 4. Return details needed by StudentView
        return res.json({
          success: true,
          session_id,
          anon_id,
          course_name: session.course_name,
          duration_minutes: session.duration_minutes,
          start_time: session.start_time,
          end_time: session.end_time
        });
      });
    });
  });
});


// CLICK EVENTS — student hits "I'm Confused"
app.post("/api/sessions/:session_id/click", (req, res) => {
  const session_id = req.params.session_id;
  const { anon_id } = req.body;

  if (!anon_id) {
    return res.status(400).json({ error: "anon_id is required" });
  }

  // First verify student exists
  const checkStudent = `
    SELECT * FROM students
    WHERE session_id = ? AND anon_id = ?
  `;

  db.query(checkStudent, [session_id, anon_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0)
      return res.status(404).json({ error: "Student not found for this session" });

    // Insert a click
    const insertClick = `
      INSERT INTO clicks (session_id, anon_id)
      VALUES (?, ?)
    `;

    db.query(insertClick, [session_id, anon_id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });

      // Count updated number for that student (optional)
      const countSql = `
        SELECT COUNT(*) AS total
        FROM clicks
        WHERE session_id = ? AND anon_id = ?
      `;

      db.query(countSql, [session_id, anon_id], (err3, results) => {
        if (err3) return res.status(500).json({ error: err3.message });

        res.json({
          success: true,
          student_click_count: results[0].total
        });
      });
    });
  });
});


// OPTIONAL NOTES (free-text notes from students)
// --------------------------------------------------------
// TODO: POST /api/sessions/:session_id/notes
// TODO: GET /api/sessions/:session_id/notes

app.post("/api/sessions/:session_id/notes", (req, res) => {
  const session_id = req.params.session_id;
  const { anon_id, note } = req.body;

  if (!anon_id || !note) {
    return res.status(400).json({ error: "anon_id and note are required" });
  }

  // Verify student exists
  const verifySql = `
    SELECT * FROM students
    WHERE session_id = ? AND anon_id = ?
  `;

  db.query(verifySql, [session_id, anon_id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0)
      return res.status(404).json({ error: "Student not found" });

    // Insert note
    const insertSql = `
      INSERT INTO notes (session_id, anon_id, note)
      VALUES (?, ?, ?)
    `;

    db.query(insertSql, [session_id, anon_id, note], (err2, result) => {
      if (err2) return res.status(500).json({ error: err2.message });

      res.status(201).json({
        success: true,
        note_id: result.insertId
      });
    });
  });
});


// --------------------------------------------------------
// TEST ROUTES (DB connection)
// --------------------------------------------------------

console.log("Registering /api/test-db route…");
app.get("/api/test-db", (req, res) => {
  db.getConnection((err, connection) => {
    if (err) {
      console.error("MySQL connection error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    connection.release();
    res.json({ message: "Connected to MySQL successfully!" });
  });
});

// --------------------------------------------------------
// SERVER STARTUP
// --------------------------------------------------------

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// --------------------------------------------------------
// ERROR HANDLERS (optional, matching your old style)
// --------------------------------------------------------

process.on("exit", (code) => {
  console.log("Process exited with code:", code);
});

process.on("SIGINT", () => {
  console.log("Caught SIGINT");
  process.exit();
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

module.exports = app;