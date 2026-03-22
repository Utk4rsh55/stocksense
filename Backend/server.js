require("dotenv").config();
const express = require("express");
const cors = require("cors");

const pool = require("./db");
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const salesRoutes = require("./routes/sales");
const dashboardRoutes = require("./routes/dashboard");
const aiRoutes = require("./routes/ai");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/sales", salesRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/ai", aiRoutes);

// Health check
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "connected", time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 StockSense API running on http://localhost:${PORT}`);
});