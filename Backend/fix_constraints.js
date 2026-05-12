const pool = require('./db');
async function fixConstraints() {
  try {
    // Check if the constraint exists before trying to drop it
    const checkRes = await pool.query(`
      SELECT conname FROM pg_constraint 
      WHERE conname = 'sales_user_id_fkey'
    `);
    
    if (checkRes.rows.length > 0) {
      console.log('Dropping existing constraint sales_user_id_fkey...');
      await pool.query('ALTER TABLE sales DROP CONSTRAINT sales_user_id_fkey');
    } else {
      console.log('Constraint sales_user_id_fkey not found, skipping drop.');
    }

    console.log('Adding new constraint with ON DELETE SET NULL...');
    await pool.query('ALTER TABLE sales ADD CONSTRAINT sales_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
    
    console.log('Successfully updated constraints!');
  } catch (err) {
    console.error('Error updating constraints:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}
fixConstraints();
