**Documentation for the database and server**

Tech Stack:

```
Database -> postgreSQL
Web Server -> Node.js with Express library
```

# Database

1. Create and name a postgreSQL database using pgAdmin
2. Note followings since they will be needed for later:
   - host or endpoint
   - port
   - user
   - password
   - database name
3. Run a query to create necessary tables:
<pre>

```sql
CREATE TABLE employees(
    id serial,
    fname VARCHAR(100) NOT NULL,
    lname VARCHAR(100) NOT NULL,
    email VARCHAR(200) NOT NULL,
    username VARCHAR(100) PRIMARY KEY,
    password TEXT NOT NULL,
    timestamp timestamptz DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE devices (
    id SERIAL,
    unique_id INT PRIMARY KEY,
    is_registered BOOLEAN NOT NULL,
    lat VARCHAR(100),
    lng VARCHAR(100),
    battery SMALLINT,
    level SMALLINT,
    reception SMALLINT,
    bin_height SMALLINT,
    timestamp timestamptz DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE feedbacks (
    id SERIAL,
    device_id VARCHAR(100),
    reported_by_id SMALLINT,
    reported_by_name VARCHAR(100),
    title TEXT,
    description TEXT,
    assigned_to SMALLINT,
    completed BOOLEAN,
    timestamp timestamptz NOT NULL default NOW()
);

ALTER TABLE employees ADD CONSTRAINT employees_id_unique UNIQUE (id);

CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    employeeID INT REFERENCES employees(id),
    deviceIDs INTEGER[] NOT NULL,
    emptyBin BOOL NOT NULL,
    changeBattery BOOL NOT NULL,
    status VARCHAR(30) NOT NULL,
    started DATE,
    finished DATE,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE routes
ALTER COLUMN started TYPE TIMESTAMP,
ALTER COLUMN finished TYPE TIMESTAMP;

ALTER TABLE routes
ALTER COLUMN timestamp TYPE TIMESTAMP;

CREATE TABLE historical (
    id SERIAL,
    unique_id INT NOT NULL,
	level_in_percents SMALLINT,
    saved_time timestamptz DEFAULT CURRENT_TIMESTAMP
);

```

</pre>

4. Verify no errors occured during the query execution

# Node.js + Express.js Server Setup

_[Node](https://nodejs.org/en/download) has to be installed on the machine!!!_
To make sure it is installed, run both commands one after another:

```
node -v
npm -v
```

Both need to show their installed versions to make sure they are working properly

1. Clone GitHub [repo](https://github.com/eduard0497/new_wbm_back.git)
2. Open terminal (or GitBash) in the folder directory
3. Run command:

```
npm i
```

4. Create a file called _.env_ in root directory of the folder
5. Add following environmental variables to that file:

```
DB_ENDPOINT={database host address or endpoint here}
DB_USER={database user}
DB_PASSWORD={database password}
DB_PORT={database port}
DB_NAME={database name}
JWT_SECRET_KEY={json web token secret key (may be a random string)}
FRONT_END_DOMAIN={best option is http://localhost:3001}
RECEIVE_SENSOR_DATA=1 (may be either 1 or 0)
```

6. Verify the server starts as necessary by running the following command:

```
npm start
```

Which should print _Listening to port 3000_

_If reached here, the setup for both database and server is done_
