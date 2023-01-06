const path = require("path");
require("dotenv").config();
const pgp = require("pg-promise")();
const Pool = require("pg").Pool;

const credentials = {
  user: process.env.POSTGRESQL_USER,
  host: process.env.POSTGRESQL_HOST,
  database: process.env.POSTGRESQL_DB,
  password: process.env.POSTGRESQL_PASS,
  port: 5432,
  connectionTimeoutMillis: 3000,
  ssl: { rejectUnauthorized : false},
};

var DB = pgp(credentials);
var pool = new Pool(credentials);

module.exports = { DB, pool };
