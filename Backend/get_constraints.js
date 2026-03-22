const pool = require('./db.js');
async function run() {
  try {
    const res = await pool.query(`
      SELECT conname, conrelid::regclass, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE confrelid = 'products'::regclass;
    `);
    console.log(res.rows);
  } catch (err) { console.error(err); }
  process.exit(0);
}
run();
