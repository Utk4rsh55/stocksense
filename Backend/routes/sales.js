const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");
const PDFDocument = require("pdfkit");

// POST /sales — Create a new sale
router.post("/", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { items, tax_percent = 0, discount_percent = 0, payment_method = "cash" } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "No items in sale." });
    }

    // Calculate subtotal
    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      // Get current product info
      const product = await client.query("SELECT * FROM products WHERE id = $1", [item.product_id]);
      if (product.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Product ID ${item.product_id} not found.` });
      }

      const p = product.rows[0];
      if (p.quantity < item.quantity) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Insufficient stock for "${p.name}". Available: ${p.quantity}` });
      }

      const itemSubtotal = parseFloat(p.price) * item.quantity;
      subtotal += itemSubtotal;

      processedItems.push({
        product_id: p.id,
        quantity: item.quantity,
        price_at_sale: parseFloat(p.price),
        cost_at_sale: parseFloat(p.cost_price),
        subtotal: itemSubtotal,
        name: p.name
      });
    }

    // Calculate tax and discount
    const discount_amount = (subtotal * discount_percent) / 100;
    const after_discount = subtotal - discount_amount;
    const tax_amount = (after_discount * tax_percent) / 100;
    const net_amount = after_discount + tax_amount;

    // Insert sale
    const sale = await client.query(
      `INSERT INTO sales (user_id, total_amount, tax_percent, tax_amount, discount_percent, discount_amount, net_amount, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, subtotal, tax_percent, tax_amount, discount_percent, discount_amount, net_amount, payment_method]
    );

    const saleId = sale.rows[0].id;

    // Insert sale items and update stock
    for (const item of processedItems) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity_sold, price_at_sale, cost_at_sale, subtotal, product_name_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [saleId, item.product_id, item.quantity, item.price_at_sale, item.cost_at_sale, item.subtotal, item.name]
      );

      await client.query(
        "UPDATE products SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2",
        [item.quantity, item.product_id]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      ...sale.rows[0],
      items: processedItems
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error." });
  } finally {
    client.release();
  }
});

// GET /sales — List all sales (admin only)
router.get("/", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.username as cashier
       FROM sales s
       LEFT JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /sales/:id — Get sale with items
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const sale = await pool.query(
      `SELECT s.*, u.username as cashier
       FROM sales s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (sale.rows.length === 0) {
      return res.status(404).json({ error: "Sale not found." });
    }

    const items = await pool.query(
      `SELECT si.*, COALESCE(p.name, si.product_name_snapshot, 'Deleted Product') as product_name, p.sku_code
       FROM sale_items si
       LEFT JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = $1`,
      [req.params.id]
    );

    res.json({
      ...sale.rows[0],
      items: items.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /sales/:id/invoice — Generate PDF invoice
router.get("/:id/invoice", authenticateToken, async (req, res) => {
  try {
    // Get sale data
    const sale = await pool.query("SELECT s.*, u.username as cashier FROM sales s LEFT JOIN users u ON s.user_id = u.id WHERE s.id = $1", [req.params.id]);
    if (sale.rows.length === 0) {
      return res.status(404).json({ error: "Sale not found." });
    }

    const items = await pool.query(
      `SELECT si.*, COALESCE(p.name, si.product_name_snapshot, 'Deleted Product') as product_name, p.sku_code
       FROM sale_items si LEFT JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = $1`,
      [req.params.id]
    );

    const s = sale.rows[0];

    // Create PDF
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=invoice-${s.id}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(22).font("Helvetica-Bold").text("StockSense", { align: "center" });
    doc.fontSize(10).font("Helvetica").text("Inventory & Sales Platform", { align: "center" });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Invoice info
    doc.fontSize(14).font("Helvetica-Bold").text(`Invoice #${s.id}`);
    doc.fontSize(10).font("Helvetica")
      .text(`Date: ${new Date(s.created_at).toLocaleDateString()}`)
      .text(`Cashier: ${s.cashier || "N/A"}`)
      .text(`Payment: ${s.payment_method}`);
    doc.moveDown();

    // Table header
    const tableTop = doc.y;
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Item", 50, tableTop, { width: 200 });
    doc.text("SKU", 250, tableTop, { width: 80 });
    doc.text("Qty", 330, tableTop, { width: 50, align: "right" });
    doc.text("Price", 380, tableTop, { width: 70, align: "right" });
    doc.text("Total", 460, tableTop, { width: 80, align: "right" });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

    // Table rows
    doc.font("Helvetica").fontSize(10);
    let y = doc.y + 5;
    for (const item of items.rows) {
      doc.text(item.product_name, 50, y, { width: 200 });
      doc.text(item.sku_code || "-", 250, y, { width: 80 });
      doc.text(String(item.quantity_sold), 330, y, { width: 50, align: "right" });
      doc.text(`$${parseFloat(item.price_at_sale).toFixed(2)}`, 380, y, { width: 70, align: "right" });
      doc.text(`$${parseFloat(item.subtotal).toFixed(2)}`, 460, y, { width: 80, align: "right" });
      y += 20;
    }

    // Totals
    doc.moveTo(50, y + 5).lineTo(545, y + 5).stroke();
    y += 15;
    doc.font("Helvetica").fontSize(10);
    doc.text(`Subtotal:`, 380, y, { width: 70, align: "right" });
    doc.text(`$${parseFloat(s.total_amount).toFixed(2)}`, 460, y, { width: 80, align: "right" });
    y += 15;

    if (parseFloat(s.discount_amount) > 0) {
      doc.text(`Discount (${s.discount_percent}%):`, 350, y, { width: 100, align: "right" });
      doc.text(`-$${parseFloat(s.discount_amount).toFixed(2)}`, 460, y, { width: 80, align: "right" });
      y += 15;
    }

    if (parseFloat(s.tax_amount) > 0) {
      doc.text(`Tax (${s.tax_percent}%):`, 380, y, { width: 70, align: "right" });
      doc.text(`$${parseFloat(s.tax_amount).toFixed(2)}`, 460, y, { width: 80, align: "right" });
      y += 15;
    }

    doc.font("Helvetica-Bold").fontSize(12);
    doc.text(`Net Total:`, 380, y + 5, { width: 70, align: "right" });
    doc.text(`$${parseFloat(s.net_amount).toFixed(2)}`, 460, y + 5, { width: 80, align: "right" });

    // Footer
    doc.fontSize(8).font("Helvetica")
      .text("Thank you for your business!", 50, 750, { align: "center" });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;