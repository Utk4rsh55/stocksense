const { execSync } = require('child_process');
const pool = require('./db.js');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    const user = await pool.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
    if(!user.rows.length) return console.log("No admin");
    const u = user.rows[0];
    const token = jwt.sign({ id: u.id, username: u.username, role: u.role }, process.env.JWT_SECRET || 'supersecret_stocksense_key_123');
    
    const p = await pool.query("SELECT id FROM products WHERE name = 'Test Dummy For Delete'");
    if(!p.rows.length) return console.log("Product not found");
    const id = p.rows[0].id;
    
    const cmd = `curl -s -X DELETE -H "Authorization: Bearer ${token}" http://localhost:5000/products/${id}`;
    const out = execSync(cmd).toString();
    console.log("RESULT:", out);
  } catch(e) { console.error(e.message); }
  process.exit(0);
})();
