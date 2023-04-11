const serverless = require('serverless-http');
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const app = express();

app.use(bodyParser.json());
app.use(cors());
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

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.use(cors());

// Fetch complete all products details
app.get('/api/products/', (req, res) => {
  const query = `
    SELECT p.product_id, g.name, g.price, g.unit, p.quantity, t.type_id, c.category_id, t.type_name, c.category_name, p.expiry_date, g.group_id
    FROM products p
    JOIN product_groups g ON p.group_id = g.group_id
    JOIN types t ON g.type_id = t.type_id
    JOIN categories c ON g.category_id = c.category_id
  `;
  db.execute(query, (err, result) => {
    if (err) throw err;
    res.json(result);
  });
});

// Fetch complete product details
app.get('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const query = `
  SELECT p.product_id, g.name, g.price, g.unit, p.quantity, t.type_id, c.category_id, t.type_name, c.category_name, p.expiry_date, g.group_id
    FROM products p
    JOIN product_groups g ON p.group_id = g.group_id
    JOIN types t ON g.type_id = t.type_id
    JOIN categories c ON g.category_id = c.category_id
    WHERE p.product_id = ?;
  `;
  db.execute(query, [id], (err, result) => {
    if (err) throw err;
    res.json(result);
  });
});

// Fetch all categories
app.get('/api/categories', (req, res) => {
  const query = 'SELECT * FROM categories';
  db.execute(query, (err, result) => {
    if (err) throw err;
    res.json(result);
  });
});

// Fetch types by category_id
app.get('/api/types', (req, res) => {
  const categoryId = req.query.category_id;
  let query = 'SELECT * FROM types';

  if (categoryId) {
    query += ' WHERE category_id = ?';
    db.execute(query, [categoryId], (err, result) => {
      if (err) throw err;
      res.json(result);
    });
  } else {
    db.execute(query, (err, result) => {
      if (err) throw err;
      res.json(result);
    });
  }
});

// Insert a new product
app.post('/api/products', (req, res) => {
  const {
    name,
    price,
    unit,
    quantity,
    type_id: typeId,
    category_id: categoryId,
    expiry_date: expiryDate,
    group_id: groupId,
  } = req.body;

  console.log({
    name,
    price,
    unit,
    quantity,
    typeId,
    categoryId,
    expiryDate,
    groupId,
  });

  // Check if a product with the same name, category_id, type_id, price, and unit exists
  const checkProductGroupQuery = `
    SELECT group_id FROM product_groups
    WHERE name = ? AND category_id = ? AND type_id = ? AND price = ? AND unit = ?;
  `;

  const insertProductGroupQuery = `
    INSERT INTO product_groups (name, price, unit, type_id, category_id)
    VALUES (?, ?, ?, ?, ?);
  `;

  const insertProductQuery = `
    INSERT INTO products (group_id, quantity, expiry_date)
    VALUES (?, ?, ?);
  `;

  const getLastInsertId = () => {
    return new Promise((resolve, reject) => {
      db.execute(
        'SELECT LAST_INSERT_ID() as group_id;',
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result[0].group_id);
          }
        }
      );
    });
  };

  db.execute(
    checkProductGroupQuery,
    [name, categoryId, typeId, price, unit],
    (err, result) => {
      if (err) throw err;

      let groupId = null;

      if (result.length > 0) {
        groupId = result[0].group_id;
      }

      if (groupId) {
        // If a group_id is found, insert the new product with the existing group_id
        db.execute(
          insertProductQuery,
          [groupId, quantity, expiryDate],
          (err, result) => {
            if (err) throw err;
            res.json({ success: true });
          }
        );
      } else {
        // If no group_id is found, create a new product group and insert the new product
        db.execute(
          insertProductGroupQuery,
          [name, price, unit, typeId, categoryId],
          (err, result) => {
            if (err) {
              console.error(err);
              res.status(500).json({ error: err.message });
              console.log('Received product data:', req.body);
            } else {
              getLastInsertId()
                .then((groupId) => {
                  db.execute(
                    insertProductQuery,
                    [groupId, quantity, expiryDate],
                    (err, result) => {
                      if (err) {
                        console.error(err);
                        res.status(500).json({ error: err.message });
                        console.log(
                          'Received product data:',
                          req.body
                        );
                      } else {
                        res.json({ success: true });
                      }
                    }
                  );
                })
                .catch((err) => {
                  console.error(err);
                  res.status(500).json({ error: err.message });
                  console.log('Received product data:', req.body);
                });
            }
          }
        );
      }
    }
  );
});

// Update product details
app.put('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const {
    name,
    price,
    unit,
    quantity,
    type_id: typeId,
    category_id: categoryId,
    expiry_date: expiryDate,
    group_id: groupId,
  } = req.body;

  console.log({
    id,
    name,
    price,
    unit,
    quantity,
    typeId,
    categoryId,
    expiryDate,
    groupId,
  });

  const findExistingGroup = `
    SELECT group_id FROM product_groups
    WHERE name = ? AND price = ? AND unit = ? AND type_id = ? AND category_id = ?
    LIMIT 1;
  `;

  const createNewGroup = `
    INSERT INTO product_groups (name, price, unit, type_id, category_id)
    VALUES (?, ?, ?, ?, ?);
  `;

  const updateProduct = `
    UPDATE products
    SET group_id = ?, quantity = ?, expiry_date = ?
    WHERE product_id = ?;
  `;

  db.execute(
    findExistingGroup,
    [name, price, unit, typeId, categoryId],
    (err, result) => {
      if (err) throw err;

      if (result.length > 0) {
        // Existing group found
        const groupId = result[0].group_id;
        db.execute(
          updateProduct,
          [groupId, quantity, expiryDate, id],
          (err, result) => {
            if (err) throw err;
            res.json({ success: true });
          }
        );
      } else {
        // No existing group found, create a new one
        db.execute(
          createNewGroup,
          [name, price, unit, typeId, categoryId],
          (err, result) => {
            if (err) throw err;

            const newGroupId = result.insertId;
            db.execute(
              updateProduct,
              [newGroupId, quantity, expiryDate, id],
              (err, result) => {
                if (err) throw err;
                res.json({ success: true });
              }
            );
          }
        );
      }
    }
  );
});

// Delete a product
app.delete('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const query = `DELETE FROM products WHERE product_id = ?;
  DELETE FROM product_groups WHERE group_id =
  ( SELECT group_id FROM products WHERE product_id = ? );
  `;

  db.execute(query, [id, id], (err, result) => {
    if (err) throw err;
    res.json({ success: true });
  });
});

// Export the Express app as a serverless function
module.exports.handler = serverless(app);
