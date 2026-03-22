const { Pool } = require("pg");

async function createDB() {
  const pool = new Pool({
    user: "postgres",
    host: "localhost",
    password: "Knightmare158",
    port: 5432,
    database: "postgres"
  });

  try {
    await pool.query("CREATE DATABASE stocksense");
    console.log("Database 'stocksense' created successfully!");
  } catch (err) {
    if (err.code === "42P04") {
      console.log("Database 'stocksense' already exists — OK!");
    } else {
      console.error("Error:", err.message);
    }
  } finally {
    await pool.end();
  }
}

createDB();
