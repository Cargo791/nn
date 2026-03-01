import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import multer from "multer";
import nodemailer from "nodemailer";
import axios from "axios";
import bcryptjs from "bcryptjs";

dotenv.config();

// ================= Crypto Prices Cache =================
let priceCache = null;

async function fetchPrices() {
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price",
      {
        params: {
          ids: "bitcoin,ethereum,solana,binancecoin",
          vs_currencies: "usd",
        },
      }
    );
    priceCache = response.data;
    console.log("✅ Crypto prices updated:", priceCache);
  } catch (error) {
    console.error("❌ Failed to fetch prices:", error.message);
  }
}

// Initial fetch and every 2 minutes
fetchPrices();
setInterval(fetchPrices, 2 * 60 * 1000);

function getCryptoPricesCached() {
  return priceCache;
}

// ================= Express App Setup =================
const app = express();
app.set("view engine", "ejs");
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer();
const { Pool } = pg;
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
  family: 4,
});
db.query("SELECT NOW()")
  .then(() => console.log("✅ Connected to database"))
  .catch((err) => console.error("❌ Failed to connect to database:", err.stack));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret",
    resave: false,
    saveUninitialized: true,
  })
);

// ================= Nodemailer Setup =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASS,
  },
});

// ================= Routes =================
app.get("/", (req, res) => res.render("home.ejs"));
app.get("/login", (req, res) => res.render("login.ejs"));
app.get("/register", (req, res) => res.render("register.ejs"));
app.get("/forgot-password", (req, res) => res.render("forgot-password"));

// ================= Dashboard / Secrets =================
app.get("/secrets", async (req, res) => {
  const userEmail = req.session.user_email;
  if (!userEmail) return res.redirect("/login");

  try {
    const userResult = await db.query("SELECT * FROM users WHERE email=$1", [userEmail]);
    const user = userResult.rows[0];
    if (!user) return res.send("❌ User not found.");

    const btc = parseFloat(user.btc_balance) || 0;
    const eth = parseFloat(user.eth_balance) || 0;
    const sol = parseFloat(user.sol_balance) || 0;
    const bnb = parseFloat(user.bnb_balance) || 0;

    // ✅ Fetch transactions by user_id
    const txResult = await db.query(
      "SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC",
      [user.id]
    );

    // ✅ Fetch deposits by user_id
    const depositResult = await db.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM deposits WHERE user_id=$1",
      [user.id]
    );
    const depositTotal = parseFloat(depositResult.rows[0].total) || 0;

    res.render("secrets", {
      name: user.full_name,
      email: user.email,
      balance: user.balance || 0,
      paymentStatus: user.payment_status || "none",
      btc,
      eth,
      sol,
      bnb,
      transactions: txResult.rows,
      deposit: depositTotal,
      profit: parseFloat(user.profit_btc) || 0,
      withdrawal: parseFloat(user.withdrawal_btc) || 0,
      prices: getCryptoPricesCached(),
      message: null,
      btcAmount: null,
      btcAddress: null,
      solAmount: null,
      solAddress: null,
      ethAmount: null,
      ethAddress: null,
      bnbAmount: null,
      bnbAddress: null,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.send("❌ Failed to fetch balance.");
  }
});

// ================= Registration =================
app.post("/register", async (req, res) => {
  const { full_name, email, password } = req.body;
  if (!full_name || !email || !password) return res.send("Please fill all required fields.");

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    if (checkResult.rows.length > 0) return res.send("Email already exists. Try logging in.");

    const hashedPassword = await bcryptjs.hash(password, 10);
    const result = await db.query(
      "INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
      [full_name, email, hashedPassword]
    );
    const user = result.rows[0];

    // Initialize empty transactions and deposits
    await db.query(
      `INSERT INTO transactions (user_id, full_name, coin_type, amount, type, status, receipt_url)
       VALUES ($1, $2, 'N/A', 0, 'N/A', 'N/A', NULL)`,
      [user.id, full_name]
    );

    await db.query(
      `INSERT INTO deposits (user_id, full_name, coin, amount, pkg, status)
       VALUES ($1, $2, 'N/A', 0, 'N/A', 'registered')`,
      [user.id, full_name]
    );

    res.render("secrets.ejs", {
      name: user.full_name,
      email: user.email,
      balance: 0,
      paymentStatus: 'none',
      btc: 0,
      eth: 0,
      sol: 0,
      bnb: 0,
      deposit: 0,
      profit: 0,
      withdrawal: 0,
      transactions: [],
      prices: {},
      message: "Registration successful!"
    });
  } catch (err) {
    console.error("❌ REGISTER ERROR:", err.stack);
    res.status(500).send("Server error: " + err.message);
  }
});

// ================= Login =================
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.send("Enter email and password.");

  try {
    const result = await db.query("SELECT * FROM users WHERE email=$1", [username]);
    if (result.rows.length === 0) return res.send("User not found.");
    const user = result.rows[0];

    const isMatch = await bcryptjs.compare(password, user.password_hash);
    if (!isMatch) return res.send("Incorrect password.");

    req.session.user_email = user.email;

    // Fetch balances
    const btc_balance = parseFloat(user.btc_balance) || 0;
    const sol_balance = parseFloat(user.sol_balance) || 0;
    const eth_balance = parseFloat(user.eth_balance) || 0;
    const bnb_balance = parseFloat(user.bnb_balance) || 0;

    const depositResult = await db.query(
      "SELECT COALESCE(SUM(amount),0) as total FROM deposits WHERE user_id=$1",
      [user.id]
    );
    const depositTotal = parseFloat(depositResult.rows[0].total) || 0;

    const transactionsResult = await db.query(
      "SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC",
      [user.id]
    );
    const transactions = transactionsResult.rows || [];

    const prices = getCryptoPricesCached();

    res.render("secrets.ejs", {
      name: user.full_name,
      email: user.email,
      balance: user.balance || 0,
      paymentStatus: user.payment_status || "none",
      btc: btc_balance,
      sol: sol_balance,
      eth: eth_balance,
      bnb: bnb_balance,
      deposit: depositTotal,
      profit: parseFloat(user.profit_btc) || 0,
      withdrawal: parseFloat(user.withdrawal_btc) || 0,
      transactions,
      prices,
      message: "Login successful!"
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).send("Server error: " + err.message);
  }
});

// ================= Deposits =================
app.post("/deposit", async (req, res) => {
  const { coin, amount, pkg } = req.body;
  const userEmail = req.session.user_email;
  if (!userEmail) return res.redirect("/login");

  try {
    const userResult = await db.query("SELECT id FROM users WHERE email=$1", [userEmail]);
    const userId = userResult.rows[0].id;

    await db.query(
      "INSERT INTO deposits (user_id, coin, amount, pkg, status) VALUES ($1,$2,$3,$4,'processing')",
      [userId, coin, amount, pkg]
    );
    res.redirect("/secrets");
  } catch (err) {
    console.error(err);
    res.send("❌ Deposit failed");
  }
});

// ================= Transactions =================
app.post("/submit-transaction", async (req, res) => {
  const { coin_type, amount, type, pkg, receipt_url } = req.body;
  const userEmail = req.session.user_email;
  if (!userEmail) return res.redirect("/login");

  try {
    const userResult = await db.query("SELECT id FROM users WHERE email=$1", [userEmail]);
    const userId = userResult.rows[0].id;

    await db.query(
      "INSERT INTO transactions (user_id, coin_type, amount, type, package, status, receipt_url) VALUES($1,$2,$3,$4,$5,'processing',$6)",
      [userId, coin_type, amount, type, pkg, receipt_url]
    );
    res.send("✅ Transaction submitted successfully.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Failed to submit transaction.");
  }
});

// ================= Transaction History =================
app.get("/transaction-history", async (req, res) => {
  const userEmail = req.session.user_email;
  if (!userEmail) return res.redirect("/login");

  try {
    const userResult = await db.query("SELECT id FROM users WHERE email=$1", [userEmail]);
    const userId = userResult.rows[0].id;

    const txResult = await db.query(
      "SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC",
      [userId]
    );

    res.render("transaction-history", { transactions: txResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// ================= Start Server =================
app.listen(port, "0.0.0.0", () => console.log(`Server running on port ${port}`));
