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
// app.use(cors({ origin: true, credentials: true }));
app.use(cors({
  origin: "https://property-manager-7pdq.vercel.app/",
  credentials: true
}));

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
    FROM properties p
    ORDER BY is_active DESC, due_date ASC
  `);
  res.json(rows);
});

// CREATE PROPERTY

app.post("/properties", authMiddleware, async (req, res) => {
  const data = req.body;

  const { rows } = await pool.query(
    `INSERT INTO properties
     (property_address, property_details, client_name, status, reason_comment, due_date, crew_name, last_email_update)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      data.property_address,
      data.property_details,
      data.client_name,
      data.status,
      data.reason_comment,
      data.due_date || null,
      data.crew_name,
      data.last_email_update
    ]
  );

  res.json(rows[0]);
});

// UPDATE PROPERTY + AUDIT LOG

app.put("/properties/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // GET OLD DATA
  const existing = await pool.query(
    "SELECT * FROM properties WHERE id=$1",
    [id]
  );

  if (!existing.rows.length) {
    return res.status(404).json({ error: "Property not found" });
  }

  const oldData = existing.rows[0];

  // BUILD DYNAMIC QUERY
  const fields = [];
  const values = [];
  let index = 1;

  for (const key in updates) {
    fields.push(`${key}=$${index++}`);
    values.push(updates[key]);
  }

  values.push(id);

  // console.log("Updating property with:", updates);
  // console.log(
  //   `UPDATE properties
  //    SET ${fields.join(", ")}
  //    WHERE id=$${index}
  //    RETURNING *`, values
  // );
  
  const result = await pool.query(
    `UPDATE properties
     SET ${fields.join(", ")}
     WHERE id=$${index}
     RETURNING *`,
    values
  );

  // console.log(oldData, updates, result.rows[0]);
  
  // ✅ AUDIT LOG ONLY CHANGED FIELDS
  for (const key in result.rows[0]) {
    if (key === "updated_at" || key === "created_at") continue; // skip timestamps
    if (oldData[key] != result.rows[0][key]) {
      console.log(oldData[key], result.rows[0][key]);
      
      await pool.query(
        `INSERT INTO property_audit_log
         (property_id, user_id, field_name, old_value, new_value)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          id,
          req.user.userId,
          key,
          oldData[key],
          result.rows[0][key],
        ]
      );
    }
  }

  res.json(result.rows[0]);
});

// ================= URGENT TASKS =================

app.get("/urgent", authMiddleware, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.*, p.property_address, p.property_details
    FROM urgent_tasks u
    JOIN properties p ON u.property_id = p.id
    WHERE is_resolved = false
  `);

  res.json(rows);
});

app.post("/urgent", authMiddleware, async (req, res) => {
  try {
    const {
      property_id,
      email,
      additional_info,
      status1,
      status2,
      due_date,
    } = req.body;

    // ================= VALIDATION =================
    if (!property_id) {
      return res.status(400).json({ error: "property_id is required" });
    }

    // Check property exists
    const propertyCheck = await pool.query(
      "SELECT id FROM properties WHERE id=$1",
      [property_id]
    );

    if (!propertyCheck.rows.length) {
      return res.status(404).json({ error: "Property not found" });
    }

    // ================= INSERT =================
    const result = await pool.query(
      `INSERT INTO urgent_tasks
       (property_id, email, additional_info, status1, status2, due_date, is_resolved)
       VALUES ($1,$2,$3,$4,$5,$6,false)
       RETURNING *`,
      [
        property_id,
        email || null,
        additional_info || null,
        status1 || "Pending",
        status2 || null,
        due_date || null,
      ]
    );

    const newTask = result.rows[0];

    // ================= OPTIONAL AUDIT LOG =================
    await pool.query(
      `INSERT INTO property_audit_log
       (property_id, user_id, field_name, old_value, new_value)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        property_id,
        req.user.userId,
        "urgent_task_created",
        null,
        `Task ID: ${newTask.id}`,
      ]
    );

    // ================= RESPONSE =================
    res.status(201).json(newTask);

  } catch (err) {
    console.error("URGENT TASK ERROR:", err);
    res.status(500).json({ error: "Failed to create urgent task" });
  }
});

// UPDATE URGENT TASK
app.put("/urgent/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  const fields = [];
  const values = [];
  let i = 1;

  for (const key in req.body) {
    fields.push(`${key}=$${i++}`);
    values.push(req.body[key]);
  }

  values.push(id);

  const result = await pool.query(
    `UPDATE urgent_tasks SET ${fields.join(", ")} WHERE id=$${i} RETURNING *`,
    values
  );

  res.json(result.rows[0]);
});
// ADMIN MARK RESOLVED

app.put("/urgent/:id/resolve", authMiddleware, adminOnly, async (req, res) => {
  await pool.query(
    "UPDATE urgent_tasks SET is_resolved=true WHERE id=$1",
    [req.params.id]
  );

  res.json({ success: true });
});

// ================= HISTORY =================

app.get("/history/:propertyId", authMiddleware, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.*, u.name
     FROM property_audit_log l
     LEFT JOIN users u ON l.user_id = u.id
     WHERE property_id=$1
     ORDER BY changed_at DESC`,
    [req.params.propertyId]
  );

  res.json(rows);
});

// ================= START =================

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));

export default app;


