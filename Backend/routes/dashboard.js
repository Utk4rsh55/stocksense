const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");

// GET /dashboard/summary — Key metrics
router.get("/summary", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const totalProducts = await pool.query("SELECT COUNT(*) as count FROM products");
    const lowStock = await pool.query("SELECT COUNT(*) as count FROM products WHERE quantity <= min_threshold");
    const totalRevenue = await pool.query("SELECT COALESCE(SUM(net_amount), 0) as total FROM sales");
    const totalCost = await pool.query(
      "SELECT COALESCE(SUM(si.cost_at_sale * si.quantity_sold), 0) as total FROM sale_items si"
    );
    const todaySales = await pool.query(
      "SELECT COUNT(*) as count, COALESCE(SUM(net_amount), 0) as total FROM sales WHERE DATE(created_at) = CURRENT_DATE"
    );
    const expiringSoon = await pool.query(
      "SELECT COUNT(*) as count FROM products WHERE expiry_date IS NOT NULL AND expiry_date <= NOW() + INTERVAL '30 days'"
    );

    const revenue = parseFloat(totalRevenue.rows[0].total);
    const cost = parseFloat(totalCost.rows[0].total);

    res.json({
      total_products: parseInt(totalProducts.rows[0].count),
      low_stock_count: parseInt(lowStock.rows[0].count),
      total_revenue: revenue,
      total_cost: cost,
      total_profit: revenue - cost,
      today_sales_count: parseInt(todaySales.rows[0].count),
      today_sales_total: parseFloat(todaySales.rows[0].total),
      expiring_soon: parseInt(expiringSoon.rows[0].count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /dashboard/top-products — Top 5 selling products
router.get("/top-products", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.name, p.id, SUM(si.quantity_sold) as total_sold, SUM(si.subtotal) as total_revenue
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       GROUP BY p.id, p.name
       ORDER BY total_sold DESC
       LIMIT 5`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /dashboard/revenue — Monthly revenue for last 12 months
router.get("/revenue", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
         COALESCE(SUM(net_amount), 0) as revenue,
         COUNT(*) as sales_count
       FROM sales
       WHERE created_at >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /dashboard/profit — Monthly profit breakdown
router.get("/profit", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', s.created_at), 'YYYY-MM') as month,
         COALESCE(SUM(s.net_amount), 0) as revenue,
         COALESCE(SUM(si.cost_at_sale * si.quantity_sold), 0) as cost
       FROM sales s
       JOIN sale_items si ON s.id = si.sale_id
       WHERE s.created_at >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', s.created_at)
       ORDER BY month ASC`
    );

    const data = result.rows.map(r => ({
      month: r.month,
      revenue: parseFloat(r.revenue),
      cost: parseFloat(r.cost),
      profit: parseFloat(r.revenue) - parseFloat(r.cost)
    }));

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /dashboard/category-breakdown — Sales by category
router.get("/category-breakdown", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.category, SUM(si.subtotal) as revenue, SUM(si.quantity_sold) as units_sold
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       GROUP BY p.category
       ORDER BY revenue DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
