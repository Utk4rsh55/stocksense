const pool = require('./db.js');
async function run() {
  try {
    const res = await pool.query("DELETE FROM products WHERE name = 'Test Product' RETURNING *");
    console.log("DELETED:", res.rows);
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    process.exit(0);
  }
}
run();
