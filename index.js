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
import bcrypt from "bcryptjs";

dotenv.config();

// ================= App Setup =================
const app = express();
app.set("view engine", "ejs");

const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer();

// ================= DB =================
const { Pool } = pg;

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
  family: 4,
});

db.query("SELECT NOW()")
  .then(() => console.log("✅ DB connected"))
  .catch(err => console.error("❌ DB error:", err.stack));

// ================= Middleware =================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
  })
);

// ================= Crypto Prices (SAFE) =================
let priceCache = {
  bitcoin: { usd: 0 },
  ethereum: { usd: 0 },
  solana: { usd: 0 },
  binancecoin: { usd: 0 },
};

async function fetchPrices() {
  try {
    const res = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price",
      {
        params: {
          ids: "bitcoin,ethereum,solana,binancecoin",
          vs_currencies: "usd",
        },
      }
    );
    priceCache = res.data;
  } catch (err) {
    console.log("Price fetch failed (using cache)");
  }
}

fetchPrices();
setInterval(fetchPrices, 120000);

const getPrices = () => priceCache || {};

// ================= Nodemailer =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASS,
  },
});

// ================= ROUTES =================
app.get("/", (req, res) => res.render("home.ejs"));
app.get("/login", (req, res) => res.render("login.ejs"));
app.get("/register", (req, res) => res.render("register.ejs"));

// ================= DASHBOARD =================
app.get("/secrets", async (req, res) => {
  const email = req.session.user_email;

  if (!email) return res.redirect("/login");

  try {
    const userResult = await db.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    const user = userResult.rows[0];
    if (!user) return res.redirect("/login");

    const txResult = await db.query(
      "SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC",
      [user.id]
    );

    const depositResult = await db.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM deposits WHERE user_id=$1",
      [user.id]
    );

    res.render("secrets", {
      name: user.full_name,
      email: user.email,
      balance: user.balance || 0,
      paymentStatus: user.payment_status || "none",

      btc: user.btc_balance || 0,
      eth: user.eth_balance || 0,
      sol: user.sol_balance || 0,
      bnb: user.bnb_balance || 0,

      deposit: parseFloat(depositResult.rows[0].total) || 0,
      profit: user.profit_btc || 0,
      withdrawal: user.withdrawal_btc || 0,

      transactions: txResult.rows || [],
      prices: getPrices(),

      btcAmount: null,
      btcAddress: null,
      solAmount: null,
      solAddress: null,
      ethAmount: null,
      ethAddress: null,
      bnbAmount: null,
      bnbAddress: null,

      message: null,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Dashboard error");
  }
});

// ================= REGISTER =================
app.post("/register", async (req, res) => {
  const { full_name, email, password } = req.body;

  try {
    const exists = await db.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (exists.rows.length > 0)
      return res.send("Email already exists");

    const hash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1,$2,$3) RETURNING *`,
      [full_name, email, hash]
    );

    const user = result.rows[0];
    req.session.user_email = user.email;

    res.redirect("/secrets");
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).send("Register failed");
  }
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query(
      "SELECT * FROM users WHERE email=$1",
      [username]
    );

    const user = result.rows[0];
    if (!user) return res.send("User not found");

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.send("Wrong password");

    req.session.user_email = user.email;

    res.redirect("/secrets");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Login failed");
  }
});

// ================= DEPOSIT =================
app.post("/deposit", async (req, res) => {
  const email = req.session.user_email;
  const { coin, amount, pkg } = req.body;

  if (!email) return res.redirect("/login");

  try {
    const user = await db.query(
      "SELECT id FROM users WHERE email=$1",
      [email]
    );

    await db.query(
      `INSERT INTO deposits (user_id, coin, amount, pkg, status)
       VALUES ($1,$2,$3,$4,'processing')`,
      [user.rows[0].id, coin, amount, pkg]
    );

    res.redirect("/secrets");
  } catch (err) {
    console.error(err);
    res.send("Deposit error");
  }
});

// ================= START SERVER =================
app.listen(port, () =>
  console.log(`Server running on port ${port}`)
);
