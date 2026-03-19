const { Pool } = require("pg");

const db = new Pool({
  user: "postgres",
  host: "db",
  database: "jarlearn",
  password: "Btisadmin",
  port: 5432
});

module.exports = db;
