const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");

// GET /products — Get all products (with optional search & category filter)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = "SELECT * FROM products";
    const params = [];
    const conditions = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR sku_code ILIKE $${params.length})`);
    }
    if (category && category !== "All") {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /products/categories — Get distinct categories
router.get("/categories", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT DISTINCT category FROM products ORDER BY category");
    res.json(result.rows.map(r => r.category));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /products/low — Get low stock products
router.get("/low", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM products WHERE quantity <= min_threshold ORDER BY quantity ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /products/expiring — Get products expiring within N days
router.get("/expiring", authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await pool.query(
      `SELECT * FROM products
       WHERE expiry_date IS NOT NULL
         AND expiry_date <= NOW() + INTERVAL '1 day' * $1
       ORDER BY expiry_date ASC`,
      [days]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /products/:id — Get single product
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// POST /products — Add a new product
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, sku_code, category, price, cost_price, quantity, min_threshold, expiry_date, description } = req.body;

    const result = await pool.query(
      `INSERT INTO products (name, sku_code, category, price, cost_price, quantity, min_threshold, expiry_date, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, sku_code || null, category || "General", price, cost_price || 0, quantity || 0, min_threshold || 5, expiry_date || null, description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "SKU code already exists." });
    }
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// PUT /products/:id — Update a product
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { name, sku_code, category, price, cost_price, quantity, min_threshold, expiry_date, description } = req.body;

    const result = await pool.query(
      `UPDATE products SET
        name = COALESCE($1, name),
        sku_code = COALESCE($2, sku_code),
        category = COALESCE($3, category),
        price = COALESCE($4, price),
        cost_price = COALESCE($5, cost_price),
        quantity = COALESCE($6, quantity),
        min_threshold = COALESCE($7, min_threshold),
        expiry_date = $8,
        description = $9,
        updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [name, sku_code, category, price, cost_price, quantity, min_threshold, expiry_date || null, description || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// DELETE /products/:id — Delete a product (admin only)
router.delete("/:id", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM products WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found." });
    }
    res.json({ message: "Product deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;