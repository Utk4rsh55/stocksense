const pool = require('./db');
async function verify() {
  try {
    console.log('--- Verification Start ---');
    
    // 1. Create a test user
    const userRes = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id",
      ['test_user_del', 'dummy_hash', 'staff']
    );
    const userId = userRes.rows[0].id;
    console.log(`Created test user with ID: ${userId}`);

    // 2. Create a sale for this user
    const saleRes = await pool.query(
      "INSERT INTO sales (user_id, total_amount) VALUES ($1, 100) RETURNING id",
      [userId]
    );
    const saleId = saleRes.rows[0].id;
    console.log(`Created sale with ID: ${saleId} for test user`);

    // 3. Attempt to delete the user
    console.log(`Attempting to delete user ${userId}...`);
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    console.log('User deleted successfully!');

    // 4. Verify the sale still exists and user_id is NULL
    const finalSaleRes = await pool.query("SELECT user_id FROM sales WHERE id = $1", [saleId]);
    if (finalSaleRes.rows.length > 0 && finalSaleRes.rows[0].user_id === null) {
      console.log('Verification PASSED: Sale exists and user_id is NULL.');
    } else {
      console.error('Verification FAILED: Sale missing or user_id not NULL.');
    }

    // Cleanup: delete the test sale
    await pool.query("DELETE FROM sales WHERE id = $1", [saleId]);
    console.log('Cleanup: Deleted test sale.');

    console.log('--- Verification End ---');
  } catch (err) {
    console.error('Verification Error:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}
verify();
