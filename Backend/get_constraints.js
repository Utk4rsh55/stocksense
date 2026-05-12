const pool = require('./db.js');
async function run() {
  try {
    const res = await pool.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'sales' AND column_name = 'user_id';
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) { console.error(err); }
  process.exit(0);
}
run();
