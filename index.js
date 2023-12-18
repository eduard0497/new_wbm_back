const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const knex = require("knex");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
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
app.use(cookieParser());
app.use(
  cors({
    credentials: true,
    origin: ["http://localhost:3001"],
  })
);
app.use(bodyParser.json());

const isUserAuthorized = (req, res, next) => {
  try {
    const cookie = req.cookies["jwt"];
    const claims = jwt.verify(cookie, process.env.JWT_SECRET_KEY);
    if (!claims) {
      res.json({
        status: 0,
        msg: "Unauthorized",
      });
    } else {
      next();
    }
  } catch (error) {
    res.json({
      status: 0,
      msg: "Unauthorized",
    });
  }
};

const db_table_employees = "employees";

//
//
//
//

app.post("/register_admin", async (req, res) => {
  const { fname, lname, email, password, start_date } = req.body;
  let hashedPassword = await bcrypt.hash(password, 10);

  db(db_table_employees)
    .returning("*")
    .insert({
      fname,
      lname,
      email,
      password: hashedPassword,
      role: "admin",
      start_date,
    })
    .then((data) => {
      if (!data.length) {
        res.json({
          status: 0,
          msg: "Unable to Add Admin",
        });
      } else {
        res.json({
          status: 1,
          msg: "Admin Added Successfully",
        });
      }
    })
    .catch((e) => {
      res.json({
        status: 0,
        msg: "Unable to Add Admin",
      });
    });
});

app.post("/register_employee", async (req, res) => {
  const { fname, lname, email, password, start_date } = req.body;
  let hashedPassword = await bcrypt.hash(password, 10);

  db(db_table_employees)
    .returning("*")
    .insert({
      fname,
      lname,
      email,
      password: hashedPassword,
      role: "employee",
      start_date,
    })
    .then((data) => {
      if (!data.length) {
        res.json({
          status: 0,
          msg: "Unable to Add Employee",
        });
      } else {
        res.json({
          status: 1,
          msg: "Employee Added Successfully",
        });
      }
    })
    .catch((e) => {
      res.json({
        status: 0,
        msg: "Unable to Add Employee",
      });
    });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  let foundRows = await db(db_table_employees).select("*").where({
    email,
  });

  if (foundRows.length == 0) {
    res.json({
      status: 0,
      msg: "No Email Found",
    });
    return;
  } else if (foundRows.length > 1) {
    res.json({
      status: 0,
      msg: "Multiple found",
    });
    return;
  }

  let foundUser = foundRows[0];
  let passwordMatches = await bcrypt.compare(password, foundUser.password);
  if (!passwordMatches) {
    res.json({
      status: 0,
      msg: "Wrong Password",
    });
    return;
  }

  const token = await jwt.sign(
    { id: foundUser.id },
    process.env.JWT_SECRET_KEY
  );

  res.cookie("jwt", token, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.cookie("user_id", foundUser.id, {
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.send({
    status: 1,
    role: foundUser.role,
  });
});

app.post("/logout", (req, res) => {
  res.cookie("jwt", {
    maxAge: 0,
  });

  res.cookie("user_id", {
    maxAge: 0,
  });

  res.json({
    status: 1,
    msg: "Logged Out Successfully",
  });
});

app.post("/get-employees", isUserAuthorized, async (req, res) => {
  let employees = await db.select("*").from("employees");
  res.json(employees);
});

app.post("/verify-user-upon-entering", isUserAuthorized, async (req, res) => {
  let userFound = await db(db_table_employees).select("*").where({
    id: req.cookies["user_id"],
  });
  if (!userFound.length) {
    res.json({
      status: 0,
      msg: "Unable to find the user...",
    });
  }
  let data = userFound[0];
  const { password, ...userInfo } = data;
  res.json({
    status: 1,
    userInfo,
  });
});

//
//
//
//

const PORT_number = process.env.PORT || 3000;
app.listen(PORT_number, () => {
  console.log(`listening to port ${PORT_number}`);
});
