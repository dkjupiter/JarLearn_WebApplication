const { Pool } = require("pg");

const db = new Pool({
  user: "postgres",
  host: "vnc.bornzi.com",
  database: "jarlearn",
  password: "Btisadmin",
  port: 5432
});

module.exports = db;
