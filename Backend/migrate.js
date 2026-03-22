const pool = require('./db.js');
async function migrate() {
  try {
    await pool.query('ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS product_name_snapshot VARCHAR(150);');
    await pool.query('UPDATE sale_items si SET product_name_snapshot = p.name FROM products p WHERE si.product_id = p.id AND si.product_name_snapshot IS NULL;');
    await pool.query('ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;');
    await pool.query('ALTER TABLE sale_items ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;');
    console.log("Migration success");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
migrate();
