const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const knex = require("knex");
require("dotenv").config();

const db = knex({
  client: "pg",
  connection: {
    host: process.env.DB_ENDPOINT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  },
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

// app.get("/", async (req, res) => {
//   console.log(process.env.ADMIN_ADD_EMPLOYEES_KEY);
//   let x = await db("admins").select("*");
//   res.json(x);
// });

app.get("/get-employees", async (req, res) => {
  let employees = await db.select('*').from("employees")
  res.json(employees)
  // res.json(x);
});

const PORT_number = process.env.PORT || 3000;
app.listen(PORT_number, () => {
  console.log(`listening to port ${PORT_number}`);
});
