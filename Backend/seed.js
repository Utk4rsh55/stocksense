require("dotenv").config();
const pool = require("./db");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

async function seed() {
  console.log("🌱 Starting StockSense database seeding...\n");

  try {
    // 1. Run schema.sql to create tables
    console.log("📦 Creating tables...");
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
    await pool.query(schema);
    console.log("✅ Tables created successfully.\n");

    // 2. Check if admin user exists
    const existingAdmin = await pool.query("SELECT id FROM users WHERE username = 'admin'");
    if (existingAdmin.rows.length === 0) {
      console.log("👤 Creating admin user...");
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash("admin123", salt);
      await pool.query(
        "INSERT INTO users (username, email, password_hash, full_name, role) VALUES ($1,$2,$3,$4,$5)",
        ["admin", "admin@stocksense.com", hash, "Admin User", "admin"]
      );
      console.log('✅ Admin created: username="admin", password="admin123"\n');
    } else {
      console.log("ℹ️  Admin user already exists.\n");
    }

    // 3. Check if staff user exists
    const existingStaff = await pool.query("SELECT id FROM users WHERE username = 'cashier'");
    if (existingStaff.rows.length === 0) {
      console.log("👤 Creating staff user...");
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash("staff123", salt);
      await pool.query(
        "INSERT INTO users (username, email, password_hash, full_name, role) VALUES ($1,$2,$3,$4,$5)",
        ["cashier", "cashier@stocksense.com", hash, "Jane Staff", "staff"]
      );
      console.log('✅ Staff created: username="cashier", password="staff123"\n');
    } else {
      console.log("ℹ️  Staff user already exists.\n");
    }

    // 4. Seed sample products
    const existingProducts = await pool.query("SELECT COUNT(*) FROM products");
    if (parseInt(existingProducts.rows[0].count) === 0) {
      console.log("📦 Seeding sample products...");
      const products = [
        ["Paracetamol 500mg", "MED-001", "Medicines", 5.99, 2.50, 150, 20, "2026-12-31", "Pain reliever tablets"],
        ["Amoxicillin 250mg", "MED-002", "Medicines", 12.99, 6.00, 80, 15, "2026-09-15", "Antibiotic capsules"],
        ["Vitamin C 1000mg", "MED-003", "Medicines", 8.49, 3.50, 200, 25, "2027-03-20", "Vitamin supplement"],
        ["Band-Aid Strips", "FIR-001", "First Aid", 3.99, 1.50, 300, 30, null, "Adhesive bandage strips"],
        ["Antiseptic Cream", "FIR-002", "First Aid", 6.49, 2.80, 4, 10, "2026-08-10", "Wound care cream"],
        ["Digital Thermometer", "EQP-001", "Equipment", 15.99, 8.00, 45, 10, null, "Digital thermometer"],
        ["N95 Face Masks (50pc)", "PPE-001", "PPE", 24.99, 12.00, 2, 5, null, "Protective face masks"],
        ["Hand Sanitizer 500ml", "PPE-002", "PPE", 7.99, 3.00, 120, 15, "2026-06-30", "Antibacterial sanitizer"],
        ["Cough Syrup 100ml", "MED-004", "Medicines", 9.99, 4.50, 60, 10, "2026-04-15", "Cough relief syrup"],
        ["Blood Pressure Monitor", "EQP-002", "Equipment", 45.99, 25.00, 20, 5, null, "Digital BP monitor"],
        ["Ibuprofen 400mg", "MED-005", "Medicines", 6.99, 3.00, 3, 10, "2027-01-20", "Anti-inflammatory tablets"],
        ["Cotton Rolls 500g", "FIR-003", "First Aid", 4.49, 1.80, 180, 20, null, "Absorbent cotton"],
        ["Eye Drops 10ml", "MED-006", "Medicines", 11.49, 5.50, 70, 10, "2026-07-25", "Lubricating eye drops"],
        ["Surgical Gloves (100pc)", "PPE-003", "PPE", 18.99, 9.00, 50, 10, null, "Latex surgical gloves"],
        ["Multivitamin Tablets", "MED-007", "Medicines", 14.99, 7.00, 0, 15, "2027-06-30", "Daily multivitamins"],
      ];

      for (const p of products) {
        await pool.query(
          `INSERT INTO products (name, sku_code, category, price, cost_price, quantity, min_threshold, expiry_date, description)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          p
        );
      }
      console.log(`✅ ${products.length} sample products seeded.\n`);
    } else {
      console.log("ℹ️  Products already exist, skipping.\n");
    }

    // 5. Seed sample sales (for demo charts)
    const existingSales = await pool.query("SELECT COUNT(*) FROM sales");
    if (parseInt(existingSales.rows[0].count) === 0) {
      console.log("💰 Seeding sample sales...");
      const adminUser = await pool.query("SELECT id FROM users WHERE username = 'admin'");
      const adminId = adminUser.rows[0].id;
      const allProducts = await pool.query("SELECT * FROM products ORDER BY id");

      // Create sales spread over last 3 months
      const saleDates = [];
      const now = new Date();
      for (let i = 90; i >= 0; i -= 2) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        saleDates.push(d);
      }

      for (const saleDate of saleDates) {
        // Pick 1-4 random products per sale
        const numItems = Math.floor(Math.random() * 4) + 1;
        const selectedProducts = [];
        const availableProducts = [...allProducts.rows].filter(p => p.quantity > 0);

        for (let i = 0; i < Math.min(numItems, availableProducts.length); i++) {
          const idx = Math.floor(Math.random() * availableProducts.length);
          const product = availableProducts.splice(idx, 1)[0];
          const qty = Math.floor(Math.random() * 3) + 1;
          selectedProducts.push({ ...product, qty: Math.min(qty, product.quantity) });
        }

        if (selectedProducts.length === 0) continue;

        let subtotal = 0;
        selectedProducts.forEach(p => {
          subtotal += parseFloat(p.price) * p.qty;
        });

        const taxPercent = 10;
        const discountPercent = Math.random() > 0.7 ? 5 : 0;
        const discountAmount = (subtotal * discountPercent) / 100;
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = (afterDiscount * taxPercent) / 100;
        const netAmount = afterDiscount + taxAmount;

        const sale = await pool.query(
          `INSERT INTO sales (user_id, total_amount, tax_percent, tax_amount, discount_percent, discount_amount, net_amount, payment_method, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [adminId, subtotal, taxPercent, taxAmount, discountPercent, discountAmount, netAmount, Math.random() > 0.5 ? "cash" : "card", saleDate]
        );

        for (const p of selectedProducts) {
          await pool.query(
            `INSERT INTO sale_items (sale_id, product_id, quantity_sold, price_at_sale, cost_at_sale, subtotal)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [sale.rows[0].id, p.id, p.qty, parseFloat(p.price), parseFloat(p.cost_price), parseFloat(p.price) * p.qty]
          );
        }
      }
      console.log(`✅ ~${saleDates.length} sample sales seeded.\n`);
    } else {
      console.log("ℹ️  Sales data already exists, skipping.\n");
    }

    console.log("🎉 Database seeding complete!");
    console.log("========================================");
    console.log('Login as Admin:  username="admin"    password="admin123"');
    console.log('Login as Staff:  username="cashier"  password="staff123"');
    console.log("========================================\n");
  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
    console.error(err);
  } finally {
    await pool.end();
  }
}

seed();
