const { Pool } = require("pg");

const db = new Pool({
  user: "appuser",
//   host: "vnc.bornzi.com",
    host: "103.253.72.221",
    // host: "db",
  database: "jarlearn",
  password: "abc123",
  port: 5432
});

db.query("SELECT 1")
  .then(() => console.log("✅ CONNECT OK"))
  .catch(err => console.error("❌ ERROR:", err));