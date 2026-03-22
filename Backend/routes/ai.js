const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");

// ============================================================
// LEVEL 1: Built-in Statistical AI (No external API needed)
// ============================================================

// GET /ai/demand-forecast/:productId — Predict next 7 days demand
router.get("/demand-forecast/:productId", authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;

    // Get product info
    const product = await pool.query("SELECT * FROM products WHERE id = $1", [productId]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: "Product not found." });
    }

    // Get daily sales for last 30 days
    const salesData = await pool.query(
      `SELECT DATE(s.created_at) as sale_date, COALESCE(SUM(si.quantity_sold), 0) as daily_sold
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE si.product_id = $1
         AND s.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(s.created_at)
       ORDER BY sale_date ASC`,
      [productId]
    );

    // Fill in days with zero sales
    const dailySales = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const found = salesData.rows.find(r => r.sale_date.toISOString().split("T")[0] === dateStr);
      dailySales.push({
        date: dateStr,
        sold: found ? parseInt(found.daily_sold) : 0
      });
    }

    // Simple Moving Average (SMA) - 7-day window
    const window = 7;
    const values = dailySales.map(d => d.sold);
    const recentValues = values.slice(-window);
    const sma = recentValues.reduce((a, b) => a + b, 0) / window;

    // Weighted Moving Average (WMA) - recent days weighted more
    let wmaSum = 0;
    let weightSum = 0;
    for (let i = 0; i < recentValues.length; i++) {
      const weight = i + 1;
      wmaSum += recentValues[i] * weight;
      weightSum += weight;
    }
    const wma = wmaSum / weightSum;

    // Simple Linear Trend
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Forecast next 7 days
    const forecast = [];
    for (let i = 1; i <= 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      const trendValue = Math.max(0, Math.round((slope * (n + i) + intercept) * 10) / 10);
      const avgForecast = Math.max(0, Math.round(((sma + wma + trendValue) / 3) * 10) / 10);

      forecast.push({
        date: date.toISOString().split("T")[0],
        predicted_demand: avgForecast
      });
    }

    const totalPredicted = forecast.reduce((sum, f) => sum + f.predicted_demand, 0);
    const currentStock = parseInt(product.rows[0].quantity);

    res.json({
      product: product.rows[0].name,
      product_id: parseInt(productId),
      current_stock: currentStock,
      avg_daily_demand: Math.round(sma * 10) / 10,
      historical: dailySales,
      forecast,
      total_predicted_7days: Math.round(totalPredicted * 10) / 10,
      stock_will_last_days: sma > 0 ? Math.round(currentStock / sma) : null,
      reorder_needed: totalPredicted > currentStock
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /ai/reorder-suggestions — Products that need reordering based on demand
router.get("/reorder-suggestions", authenticateToken, async (req, res) => {
  try {
    // Get avg daily demand for each product over last 14 days
    const result = await pool.query(
      `SELECT
         p.id, p.name, p.quantity as current_stock, p.min_threshold, p.category,
         COALESCE(AVG(daily.daily_sold), 0) as avg_daily_demand
       FROM products p
       LEFT JOIN (
         SELECT si.product_id, DATE(s.created_at) as sale_date, SUM(si.quantity_sold) as daily_sold
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE s.created_at >= NOW() - INTERVAL '14 days'
         GROUP BY si.product_id, DATE(s.created_at)
       ) daily ON p.id = daily.product_id
       GROUP BY p.id, p.name, p.quantity, p.min_threshold, p.category
       HAVING p.quantity <= p.min_threshold OR p.quantity < COALESCE(AVG(daily.daily_sold), 0) * 7
       ORDER BY p.quantity ASC`
    );

    const suggestions = result.rows.map(r => {
      const avgDemand = parseFloat(r.avg_daily_demand);
      const currentStock = parseInt(r.current_stock);
      const daysOfStockLeft = avgDemand > 0 ? Math.round(currentStock / avgDemand) : null;
      const suggestedReorder = Math.max(0, Math.ceil(avgDemand * 14) - currentStock); // 14 days' worth

      return {
        product_id: r.id,
        name: r.name,
        category: r.category,
        current_stock: currentStock,
        min_threshold: parseInt(r.min_threshold),
        avg_daily_demand: Math.round(avgDemand * 10) / 10,
        days_of_stock_left: daysOfStockLeft,
        suggested_reorder_qty: suggestedReorder,
        urgency: currentStock === 0 ? "CRITICAL" : currentStock <= parseInt(r.min_threshold) ? "HIGH" : "MEDIUM"
      };
    });

    res.json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /ai/anomalies — Detect unusual sales patterns (Z-score)
router.get("/anomalies", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    // Get daily sales totals for last 30 days
    const result = await pool.query(
      `SELECT DATE(created_at) as sale_date, SUM(net_amount) as daily_total, COUNT(*) as transaction_count
       FROM sales
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY sale_date ASC`
    );

    const dailyTotals = result.rows.map(r => parseFloat(r.daily_total));

    if (dailyTotals.length < 3) {
      return res.json({ message: "Not enough data for anomaly detection. Need at least 3 days of sales.", anomalies: [] });
    }

    // Calculate mean and standard deviation
    const mean = dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length;
    const variance = dailyTotals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyTotals.length;
    const stdDev = Math.sqrt(variance);

    // Find anomalies (Z-score > 2 or < -2)
    const anomalies = result.rows
      .map((r, i) => {
        const value = dailyTotals[i];
        const zScore = stdDev > 0 ? (value - mean) / stdDev : 0;
        return {
          date: r.sale_date,
          daily_total: value,
          transaction_count: parseInt(r.transaction_count),
          z_score: Math.round(zScore * 100) / 100,
          type: zScore > 2 ? "SPIKE" : zScore < -2 ? "DROP" : "NORMAL"
        };
      })
      .filter(a => a.type !== "NORMAL");

    res.json({
      stats: {
        mean_daily_sales: Math.round(mean * 100) / 100,
        std_deviation: Math.round(stdDev * 100) / 100,
        analysis_period: `${result.rows.length} days`
      },
      anomalies
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// ============================================================
// LEVEL 2: Google Gemini AI (Optional — needs API key)
// ============================================================

// Helper: retry Gemini calls with exponential backoff
async function callGeminiWithRetry(model, prompt, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result;
    } catch (err) {
      const is429 = err.status === 429 || (err.message && err.message.includes("429"));
      if (is429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`Gemini rate limited. Retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
}

// POST /ai/ask — Natural language inventory query
router.post("/ask", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "Please provide a question." });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: "Gemini API key not configured. Add GEMINI_API_KEY to your .env file.",
        hint: "Get a free API key from https://aistudio.google.com"
      });
    }

    const qLower = question.toLowerCase();
    
    // Fallback/heuristic layer for common queries to avoid Gemini quota limits
    if (qLower.includes("out of stock") || qLower.includes("zero stock")) {
      const result = await pool.query("SELECT * FROM products WHERE quantity = 0 ORDER BY name ASC LIMIT 20");
      return res.json({ question, sql_query: "SELECT * FROM products WHERE quantity = 0", data: result.rows, answer: "Here are the products currently out of stock. (Answered instantly via local rules)", row_count: result.rows.length });
    }
    if (qLower.includes("best selling") || qLower.includes("most sold") || qLower.includes("top selling")) {
      const q = "SELECT p.name, sum(si.quantity_sold) as total_sold FROM sale_items si JOIN products p ON p.id = si.product_id GROUP BY p.name ORDER BY total_sold DESC LIMIT 5";
      const result = await pool.query(q);
      return res.json({ question, sql_query: q, data: result.rows, answer: "Here are your top 5 best-selling products by quantity. (Answered instantly via local rules)", row_count: result.rows.length });
    }
    if (qLower.includes("low stock")) {
      const result = await pool.query("SELECT * FROM products WHERE quantity <= min_threshold AND quantity > 0 LIMIT 20");
      return res.json({ question, sql_query: "SELECT * FROM products WHERE quantity <= min_threshold", data: result.rows, answer: "These products have low stock and may need reordering soon. (Answered instantly via local rules)", row_count: result.rows.length });
    }
    if (qLower.includes("total sales") || qLower.includes("total revenue")) {
      const result = await pool.query("SELECT SUM(net_amount) as total_revenue FROM sales");
      return res.json({ question, sql_query: "SELECT SUM(net_amount) FROM sales", data: result.rows, answer: "Here is your total overall revenue. (Answered instantly via local rules)", row_count: 1 });
    }
    if (qLower.includes("recent sales") || qLower.includes("latest sales")) {
      const result = await pool.query("SELECT * FROM sales ORDER BY created_at DESC LIMIT 5");
      return res.json({ question, sql_query: "SELECT * FROM sales ORDER BY created_at DESC LIMIT 5", data: result.rows, answer: "Here are the 5 most recent sales transactions. (Answered instantly via local rules)", row_count: result.rows.length });
    }

    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Get database schema context
    const tables = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    const schemaContext = tables.rows.reduce((acc, row) => {
      if (!acc[row.table_name]) acc[row.table_name] = [];
      acc[row.table_name].push(`${row.column_name} (${row.data_type})`);
      return acc;
    }, {});

    const schemaStr = Object.entries(schemaContext)
      .map(([table, cols]) => `${table}: ${cols.join(", ")}`)
      .join("\n");

    const prompt = `You are a database assistant for an inventory management system called StockSense.
Given the following PostgreSQL database schema:
${schemaStr}

The user asked: "${question}"

Generate a single PostgreSQL query to answer this question. Return ONLY the SQL query, nothing else. No markdown, no explanation, just the raw SQL.
Important: Only generate SELECT queries. Never generate INSERT, UPDATE, DELETE, DROP, or ALTER queries.`;

    const result = await callGeminiWithRetry(model, prompt);
    const sqlQuery = result.response.text().trim().replace(/```sql\n?/g, "").replace(/```/g, "").trim();

    // Safety check — only allow SELECT
    if (!sqlQuery.toUpperCase().startsWith("SELECT")) {
      return res.status(400).json({ error: "AI generated an unsafe query. Only SELECT queries are allowed." });
    }

    // Execute the query
    const queryResult = await pool.query(sqlQuery);

    // Get AI to format the answer
    const answerPrompt = `The user asked: "${question}"
The SQL query returned this data: ${JSON.stringify(queryResult.rows.slice(0, 20))}
Provide a brief, friendly answer in 2-3 sentences summarizing the data. Use numbers and product names where relevant.`;

    let finalAnswer = "";
    try {
      // Use maxRetries = 1 for the summary so we fail fast and fallback
      const answerResult = await callGeminiWithRetry(model, answerPrompt, 1);
      finalAnswer = answerResult.response.text().trim();
    } catch (summaryErr) {
      console.warn("AI summary skipped due to rate limit/error:", summaryErr.message);
      finalAnswer = "Here are the results from your database. (AI summary was skipped due to API rate limits).";
    }

    res.json({
      question,
      sql_query: sqlQuery,
      data: queryResult.rows.slice(0, 50),
      answer: finalAnswer,
      row_count: queryResult.rows.length
    });
  } catch (err) {
    console.error(err);

    // Friendlier error for rate limits
    const is429 = err.status === 429 || (err.message && err.message.includes("429"));
    if (is429) {
      return res.status(429).json({
        error: "AI rate limit reached. The free Gemini tier has a limited number of requests per minute. Please wait about 30-60 seconds and try again."
      });
    }

    res.status(500).json({ error: "AI query failed: " + err.message });
  }
});

module.exports = router;