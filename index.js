const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const knex = require("knex");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const app = express();
app.use(cookieParser());

const corsOptions =
  process.env.RECEIVE_SENSOR_DATA == 1
    ? {
        origin: [
          process.env.FRONT_END_DOMAIN,
          "10.42.0.1",
          "10.40.36.118",
          "172.17.0.1",
          "192.168.208.1",
        ],
        credentials: true,
      }
    : {
        origin: [process.env.FRONT_END_DOMAIN],
        credentials: true,
      };

console.log("Cors Options");
console.log(corsOptions);

app.use(cors(corsOptions));
app.use(bodyParser.json());

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: corsOptions,
});

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

const isUserAuthorized = (req, res, next) => {
  try {
    const cookie = String(req.cookies["jwt"]);
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
    console.log(error);
    res.json({
      status: 0,
      msg: "Unauthorized ERROR",
    });
  }
};

const db_table_employees = "employees";
const db_table_devices = "devices";
// const db_table_devices_current_info = "devices_current_info";
const db_table_feedbacks = "feedbacks";

//
//
//
//

io.on("connection", (socket) => {
  // console.log("ID connected: " + socket.id);

  setInterval(async () => {
    let registered_devices = await db(db_table_devices)
      .select("*")
      .where({
        is_registered: true,
      })
      .orderBy("unique_id");
    // let unregistered_devices = await db(db_table_devices_current_info)
    //   .select("*")
    //   .where({
    //     is_registered: false,
    //   });
    socket.emit("request_data", registered_devices);
  }, 10000);
});
//
//
//
//
// to be deleted later
app.get("/mock_get-devices", async (req, res) => {
  let devices = await db(db_table_devices).select("*").orderBy("unique_id");

  res.json({
    devices,
  });
});

app.post("/mock_update-values", async (req, res) => {
  const {
    id,
    unique_id,
    bin_height,
    level,
    battery,
    reception,
    lat,
    lng,
    is_registered,
  } = req.body;

  db(db_table_devices)
    .returning("*")
    .update({
      unique_id,
      bin_height,
      level,
      battery,
      reception,
      lat,
      lng,
      is_registered,
    })
    .where({
      id,
    })
    .then((data) => {
      if (!data.length) {
        res.json({
          status: 0,
          msg: "Error occured",
        });
      } else {
        res.json({
          status: 1,
          msg: "Updated the database",
        });
      }
    })
    .catch((e) => {
      res.json({
        status: 0,
        msg: "Error while updating current info",
      });
    });
});

app.post("/mock_add-device", async (req, res) => {
  const {
    unique_id,
    bin_height,
    level,
    battery,
    reception,
    lat,
    lng,
    is_registered,
  } = req.body;

  db(db_table_devices)
    .returning("*")
    .insert({
      unique_id,
      bin_height,
      level,
      battery,
      reception,
      lat,
      lng,
      is_registered,
      timestamp: new Date(),
    })
    .then((data) => {
      if (!data.length) {
        res.json({
          status: 0,
          msg: "Error occured",
        });
      } else {
        res.json({
          status: 1,
          msg: "Added to the database",
        });
      }
    })
    .catch((e) => {
      res.json({
        status: 0,
        msg: "Error while adding a device",
      });
    });
});

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

  let front_end_domain = process.env.FRONT_END_DOMAIN.toString();
  let modified_front_end_domain = front_end_domain.replace(/https:\/\//g, ".");

  console.log(modified_front_end_domain);

  res.cookie("jwt", token, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    secure: true,
    sameSite: "None",
  });

  res.cookie("user_id", foundUser.id, {
    maxAge: 24 * 60 * 60 * 1000,
    secure: true,
    sameSite: "None",
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
  let employees = await db.select("*").from(db_table_employees);
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

app.post("/add-feedback", isUserAuthorized, async (req, res) => {
  const { uniqueID, title, description } = req.body;
  let userFound = await db(db_table_employees).select("*").where({
    id: req.cookies["user_id"],
  });

  db(db_table_feedbacks)
    .returning("*")
    .insert({
      device_id: uniqueID,
      reported_by_id: userFound[0].id,
      reported_by_name: userFound[0].fname + " " + userFound[0].lname,
      title,
      description,
      assigned_to: null,
      completed: false,
    })
    .then(async (data) => {
      if (!data.length) {
        res.json({
          status: 0,
          msg: "Unable to add feedback",
        });
      } else {
        let feedbacks = await db(db_table_feedbacks).select("*");
        res.json({
          status: 1,
          msg: "Feedback added successfully",
          feedbacks,
        });
      }
    })
    .catch((e) => {
      res.json({
        status: 0,
        msg: "Unable to add feedback_ERROR",
      });
    });
});

app.post("/get-feedbacks", isUserAuthorized, async (req, res) => {
  let feedbacks = await db(db_table_feedbacks).select("*");
  res.json({
    status: 1,
    feedbacks,
  });
});

app.post("/get-devices", isUserAuthorized, async (req, res) => {
  let devices = await db(db_table_devices)
    .select("*")
    .where({ is_registered: true })
    .orderBy("unique_id");

  res.json({
    status: 1,
    devices,
  });
});

app.post("/get-unknown-devices", isUserAuthorized, async (req, res) => {
  let unknown_devices = await db(db_table_devices)
    .select("*")
    .where({ is_registered: false });

  res.json({
    status: 1,
    unknown_devices,
  });
});

app.post("/hardware-update-bin", async (req, res) => {
  const { deviceID, battery, level, reception } = req.body;

  let foundDevicesByID = await db(db_table_devices)
    .select("*")
    .where({ unique_id: deviceID });

  if (!foundDevicesByID.length) {
    db(db_table_devices)
      .returning("*")
      .insert({
        unique_id: deviceID,
        battery,
        level,
        reception,
        is_registered: false,
      })
      .then((data) => {
        res.json({
          status: 1,
          msg: "Inserted into the database",
        });
      })
      .catch((e) => {
        res.json({
          status: 0,
          msg: "Error while adding the unknown device",
        });
      });
  } else {
    db(db_table_devices)
      .returning("*")
      .update({
        battery,
        level,
        reception,
        timestamp: new Date(),
      })
      .where({
        unique_id: deviceID,
      })
      .then((data) => {
        res.json({
          status: 1,
          msg: "Updated the database",
        });
      })
      .catch((e) => {
        res.json({
          status: 0,
          msg: "Error while updating current info",
        });
      });
  }
});

app.post(
  "/employee-register-unknown-bin",
  isUserAuthorized,
  async (req, res) => {
    const { id, lat, lng, bin_height } = req.body;

    db(db_table_devices)
      .returning("*")
      .update({
        is_registered: true,
        lat,
        lng,
        bin_height,
      })
      .where({
        id,
      })
      .then((data) => {
        if (!data.length) {
          res.json({
            status: 0,
            msg: "Was unable to register the device",
          });
        } else {
          res.json({
            status: 1,
            msg: "Device registered Successfully",
          });
        }
      });
  }
);

const PORT_number = process.env.PORT || 3000;
server.listen(PORT_number, () => {
  console.log(`listening to port ${PORT_number}`);
});
