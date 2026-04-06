import express from "express";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;
const app = express();

app.use(express.json());
app.use(cookieParser());
const allowedOrigins = [
  "https://property-manager-7pdq.vercel.app",
  "http://localhost:5173",
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools (curl/Postman) and approved frontend origins.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

const JWT_SECRET = process.env.JWT_SECRET;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },

  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

app.get("/test-db", async (req, res) => {
  try {
    const r = await pool.query("SELECT NOW()");
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB failed" });
  }
});

// ================= AUTH =================
const cookieOptions = {
  httpOnly: true,
  secure: true,          // REQUIRED for cross-site (HTTPS)
  sameSite: "none",      // REQUIRED for cross-site
  path: "/"
};

function createToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

// ================= LOGIN =================

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(email, password);
  

  const { rows } = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!rows.length) return res.status(400).json({ error: "Invalid credentials" });

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) return res.status(400).json({ error: "Invalid credentials" });

  const token = createToken(user);

  res.cookie("token", token, cookieOptions);

  res.json({ message: "Logged in" });
});

// ================= LOGOUT =================
app.post("/logout", (req, res) => {
  res.clearCookie("token", cookieOptions);
  res.json({ message: "Logged out successfully" });
});

// ================= GET CURRENT USER =================

app.get("/me", authMiddleware, (req, res) => {
  res.json(req.user);
});

// ================= PROPERTIES =================

app.get("/properties", authMiddleware, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT p.*
    FROM property_info p
    ORDER BY is_active DESC, updated_at DESC
  `);
  res.json(rows);
});

const PROPERTY_UPDATABLE_FIELDS = [
  "property_address",
  "property_details",
  "client_name",
];

// CREATE PROPERTY

app.post("/properties", authMiddleware, async (req, res) => {
  const data = req.body;

  const { rows } = await pool.query(
    `INSERT INTO property_info
     (property_address, property_details, client_name)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [
      data.property_address,
      data.property_details,
      data.client_name,
    ]
  );

  res.json(rows[0]);
});

// UPDATE PROPERTY

app.put("/properties/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // BUILD DYNAMIC QUERY
  const fields = [];
  const values = [];
  let index = 1;

  for (const key in updates) {
    if (!PROPERTY_UPDATABLE_FIELDS.includes(key)) continue;
    fields.push(`${key}=$${index++}`);
    values.push(updates[key]);
  }

  if (!fields.length) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  values.push(id);

  const result = await pool.query(
    `UPDATE property_info
     SET ${fields.join(", ")}
     WHERE id=$${index}
     RETURNING *`,
    values
  );

  res.json(result.rows[0]);
});

app.delete("/properties/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id FROM property_info WHERE id=$1",
      [id]
    );

    if (!existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Property not found" });
    }

    await client.query("DELETE FROM property_info WHERE id=$1", [id]);

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE PROPERTY ERROR:", err);
    res.status(500).json({ error: "Failed to delete property" });
  } finally {
    client.release();
  }
});

// ================= URGENT TASKS =================

app.get("/urgent", authMiddleware, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.*, p.property_address, p.property_details
    FROM urgent_tasks u
    JOIN property_info p ON u.property_id = p.id
    ORDER BY u.due_date ASC NULLS LAST, u.created_at DESC
  `);

  res.json(rows);
});

app.post("/urgent", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      property_id,
      crew_name,
      status,
      reason_comment,
      due_date,
      last_email_update,
    } = req.body;

    // ================= VALIDATION =================
    if (!property_id) {
      return res.status(400).json({ error: "property_id is required" });
    }

    await client.query("BEGIN");

    // Check property exists
    const propertyCheck = await client.query(
      "SELECT id FROM property_info WHERE id=$1",
      [property_id]
    );

    if (!propertyCheck.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Property not found" });
    }

    // ================= INSERT =================
    const result = await client.query(
      `INSERT INTO urgent_tasks
       (property_id, crew_name, status, reason_comment, due_date, last_email_update)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        property_id,
        crew_name || null,
        status || null,
        reason_comment || null,
        due_date || null,
        last_email_update || null,
      ]
    );

    await client.query(
      `UPDATE property_info
       SET is_active = COALESCE(is_active, 0) + 1
       WHERE id=$1`,
      [property_id]
    );

    await client.query("COMMIT");

    // ================= RESPONSE =================
    res.status(201).json(result.rows[0]);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("URGENT TASK ERROR:", err);
    res.status(500).json({ error: "Failed to create urgent task" });
  } finally {
    client.release();
  }
});

// UPDATE URGENT TASK
app.put("/urgent/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const allowedFields = [
    "crew_name",
    "status",
    "reason_comment",
    "due_date",
    "last_email_update",
  ];

  const fields = [];
  const values = [];
  let i = 1;

  for (const key in req.body) {
    if (!allowedFields.includes(key)) continue;
    fields.push(`${key}=$${i++}`);
    values.push(req.body[key]);
  }

  if (!fields.length) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  values.push(id);

  const result = await pool.query(
    `UPDATE urgent_tasks SET ${fields.join(", ")} WHERE id=$${i} RETURNING *`,
    values
  );

  res.json(result.rows[0]);
});

app.delete("/urgent/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const taskResult = await client.query(
      "SELECT property_id FROM urgent_tasks WHERE id=$1",
      [id]
    );

    if (!taskResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Urgent task not found" });
    }

    const { property_id: propertyId } = taskResult.rows[0];

    await client.query(
      "DELETE FROM urgent_tasks WHERE id=$1",
      [id]
    );

    await client.query(
      `UPDATE property_info
       SET is_active = GREATEST(COALESCE(is_active, 0) - 1, 0)
       WHERE id=$1`,
      [propertyId]
    );

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE URGENT TASK ERROR:", err);
    res.status(500).json({ error: "Failed to delete urgent task" });
  } finally {
    client.release();
  }
});
// ADMIN MARK RESOLVED

app.put("/urgent/:id/resolve", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const taskResult = await client.query(
      "SELECT * FROM urgent_tasks WHERE id=$1",
      [id]
    );

    if (!taskResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Task not found" });
    }

    const task = taskResult.rows[0];

    await client.query(
      `INSERT INTO history_snapshot (
        urgent_task_id,
        property_id,
        crew_name,
        status,
        reason_comment,
        due_date,
        last_email_update,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        task.id,
        task.property_id,
        task.crew_name,
        task.status,
        task.reason_comment,
        task.due_date,
        task.last_email_update,
        task.created_at,
        task.updated_at,
      ]
    );

    await client.query("DELETE FROM urgent_tasks WHERE id=$1", [id]);

    await client.query(
      `UPDATE property_info
       SET is_active = GREATEST(COALESCE(is_active, 0) - 1, 0)
       WHERE id=$1`,
      [task.property_id]
    );

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("RESOLVE URGENT TASK ERROR:", err);
    res.status(500).json({ error: "Failed to resolve task" });
  } finally {
    client.release();
  }
});

// ================= HISTORY =================

app.get("/history", authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT *
     FROM history_snapshot
     ORDER BY changed_at DESC`
  );

  res.json(rows);
});

app.get("/history/:propertyId", authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT *
     FROM history_snapshot
     WHERE property_id=$1
     ORDER BY changed_at DESC`,
    [req.params.propertyId]
  );

  res.json(rows);
});

// ================= START =================

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));

export default app;


