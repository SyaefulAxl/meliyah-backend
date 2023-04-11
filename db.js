const mysql = require('mysql2');
require('dotenv').config();

// Replace with your MySQL database credentials
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true, // Add this line
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to the MySQL database.');
});

module.exports = db;
