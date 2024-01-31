// const _FRONT_END_DOMAIN = ""
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
const corsOptions = {
  origin: process.env.FRONT_END_DOMAIN,
  credentials: true,
};
// app.use(cors(corsOptions));
app.use(cors());
app.use(bodyParser.json());

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

console.log("Front End Domain from ENV");
console.log(process.env.FRONT_END_DOMAIN);

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
const db_table_devices_current_info = "devices_current_info";
const db_table_feedbacks = "feedbacks";

//
//

app.get("/", (req, res) => {
  res.json({
    msg: "Hi buddy",
  });
});
//
//

io.on("connection", (socket) => {
  // console.log("ID connected: " + socket.id);

  setInterval(async () => {
    let devices = await db(db_table_devices).select("*");
    let devices_currentInfo = await db(db_table_devices_current_info).select(
      "*"
    );
    let mergedDevices = mergeDeviceArrays(devices, devices_currentInfo);
    socket.emit("request_data", mergedDevices);
  }, 4000);
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

  console.log("Token generated in Login");
  console.log(token);

  let front_end_domain = process.env.FRONT_END_DOMAIN.toString();
  let modified_front_end_domain = front_end_domain.replace(/https:\/\//g, ".");

  console.log("Modified Front end domain");
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

app.post("/register-new-device", isUserAuthorized, async (req, res) => {
  const { uniqueID, lat, lng } = req.body;

  var myDate = new Date();
  var pstDate = myDate.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
  });

  db(db_table_devices)
    .returning("*")
    .insert({
      unique_id: uniqueID,
      lat,
      lng,
    })
    .then((data) => {
      if (!data.length) {
        res.json({
          status: 0,
          msg: "Unable to register new device",
        });
      } else {
        db(db_table_devices_current_info)
          .returning("*")
          .insert({
            unique_id: uniqueID,
            battery: 100,
            level: 0,
            last_updated: pstDate,
          })
          .then(async (data) => {
            if (!data.length) {
              res.json({
                status: 0,
                msg: "Unable to register new device",
              });
            } else {
              let devices = await db(db_table_devices).select("*");
              let devices_currentInfo = await db(
                db_table_devices_current_info
              ).select("*");
              let mergedDevices = mergeDeviceArrays(
                devices,
                devices_currentInfo
              );

              res.json({
                status: 1,
                msg: "The device has been registered successfully",
                allDevices: mergedDevices,
              });
            }
          });
      }
    })
    .catch((e) => {
      res.json({
        status: 0,
        msg: "Unable to register new device",
      });
    });
});

app.post("/get-devices", isUserAuthorized, async (req, res) => {
  let devices = await db(db_table_devices).select("*");
  let devices_currentInfo = await db(db_table_devices_current_info).select("*");
  let mergedDevices = mergeDeviceArrays(devices, devices_currentInfo);
  res.json({
    status: 1,
    devices: mergedDevices,
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

app.post("/bin-update", async (req, res) => {
  const { deviceID, measuredLevel, measuredBattery } = req.body;

  database(db_table_devices_current_info)
    .returning("*")
    .update({
      battery: measuredBattery,
      level: measuredLevel,
    })
    .where({
      unique_id: deviceID,
    })
    .then((data) => {
      res.json({
        msg: "all devices returned",
        devices: data,
      });
    });
});

//
//
//
//

// to be deleted later
app.get("/temporary-change-device-values", (req, res) => {
  let deviceIDs = ["48", "79", "119", "134", "264"];

  let constructedDevices = deviceIDs.map((deviceID) => {
    return {
      unique_id: deviceID,
      battery: Math.floor(Math.random() * 101),
      level: Math.floor(Math.random() * 101),
    };
  });

  let emptyArray = [];

  constructedDevices.map((device) => {
    db(db_table_devices_current_info)
      .returning("*")
      .update({
        battery: device.battery,
        level: device.level,
      })
      .where({
        unique_id: device.unique_id,
      })
      .then((data) => {
        emptyArray = data;
      });
  });

  res.json(emptyArray);
});

const PORT_number = process.env.PORT || 3000;
server.listen(PORT_number, () => {
  console.log(`listening to port ${PORT_number}`);
});

// helper functions
const mergeDeviceArrays = (array1, array2) => {
  const mergedArray = array1.map((obj1) => {
    const obj2 = array2.find((obj2) => obj2.unique_id === obj1.unique_id);
    return { ...obj1, ...obj2 };
  });
  return mergedArray;
};
