const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticateToken, requireRole } = require("../middleware/auth");

// POST /auth/register — Create a new user (admin only, or first user)
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, full_name, role } = req.body;

    // Check if any users exist (first user becomes admin automatically)
    const userCount = await pool.query("SELECT COUNT(*) FROM users");
    const isFirstUser = parseInt(userCount.rows[0].count) === 0;
    const userRole = isFirstUser ? "admin" : (role || "staff");

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, full_name, role, created_at`,
      [username, email || null, password_hash, full_name || username, userRole]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Username or email already exists." });
    }
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// POST /auth/login — Authenticate and return JWT
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /auth/me — Get current user profile
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, email, full_name, role, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /auth/users — List all users (admin only)
router.get("/users", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, email, full_name, role, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// DELETE /auth/users/:id — Delete a user (admin only)
router.delete("/users/:id", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account." });
    }
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    res.json({ message: "User deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
