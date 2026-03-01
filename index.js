import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";
import multer from "multer";
import nodemailer from "nodemailer";
import axios from "axios";
import bcrypt from "bcrypt";

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
    const userResult = await db.query("SELECT * FROM users WHERE email = $1", [userEmail]);
    const user = userResult.rows[0];
    if (!user) return res.send("❌ User not found.");

    const btc = parseFloat(user.btc_balance) || 0;
    const eth = parseFloat(user.eth_balance) || 0;
    const sol = parseFloat(user.sol_balance) || 0;
    const bnb = parseFloat(user.bnb_balance) || 0;

    const txResult = await db.query(
      "SELECT * FROM transactions WHERE email = $1 ORDER BY created_at DESC",
      [userEmail]
    );

    const depositResult = await db.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM deposits WHERE email=$1",
      [userEmail]
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
  const { name, email, password, country, phone } = req.body;

  try {
    // Check if user exists
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (checkResult.rows.length > 0) return res.send("Email already exists. Try logging in.");

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.query(
      "INSERT INTO users (email, password, full_name) VALUES ($1, $2, $3) RETURNING *",
      [email, hashedPassword, name]
    );
    const user = result.rows[0];

    // Initialize transactions & deposits
    await db.query(
      "INSERT INTO transactions (email, full_name, coin_type, amount, type, package, status, receipt_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [email, name, "N/A", 0, "N/A", "N/A", "N/A", null]
    );
    await db.query(
      "INSERT INTO deposits (email, full_name, coin, amount, pkg, status) VALUES ($1,$2,$3,$4,$5,$6)",
      [email, name, "N/A", 0, "N/A", "registered"]
    );

    res.render("secrets", {
      name: user.full_name,
      email: user.email,
      balance: 0,
      paymentStatus: "none",
      btc: 0,
      sol: 0,
      eth: 0,
      bnb: 0,
      btcAmount: null,
      btcAddress: null,
      solAmount: null,
      solAddress: null,
      ethAmount: null,
      ethAddress: null,
      bnbAmount: null,
      bnbAddress: null,
      prices: getCryptoPricesCached(),
      profit: 0,
      withdrawal: 0,
      transactions: [],
      deposit: 0,
      message: null,
    });
  } catch (err) {
    console.error("❌ REGISTER ERROR:", err.stack);
    res.status(500).send("Server error: " + err.message);
  }
});

// ================= Login =================
app.post("/login", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    if (result.rows.length === 0) return res.send("User not found");

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Incorrect Password");

    req.session.user_email = user.email;

    const btc_balance = parseFloat(user.btc_balance) || 0;
    const sol_balance = parseFloat(user.sol_balance) || 0;
    const eth_balance = parseFloat(user.eth_balance) || 0;
    const bnb_balance = parseFloat(user.bnb_balance) || 0;

    const transactionsResult = await db.query(
      "SELECT * FROM transactions WHERE email=$1 ORDER BY created_at DESC",
      [user.email]
    );
    const transactions = transactionsResult.rows || [];

    const depositResult = await db.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM deposits WHERE email=$1",
      [user.email]
    );
    const depositTotal = parseFloat(depositResult.rows[0].total) || 0;

    res.render("secrets", {
      name: user.full_name,
      email: user.email,
      balance: user.balance || 0,
      paymentStatus: user.payment_status || "none",
      btc: btc_balance,
      deposit: depositTotal,
      sol: sol_balance,
      eth: eth_balance,
      bnb: bnb_balance,
      btcAmount: null,
      btcAddress: null,
      solAmount: null,
      solAddress: null,
      ethAmount: null,
      ethAddress: null,
      bnbAmount: null,
      bnbAddress: null,
      prices: getCryptoPricesCached(),
      profit: parseFloat(user.profit_btc) || 0,
      withdrawal: parseFloat(user.withdrawal_btc) || 0,
      transactions: transactions,
      message: null,
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).send("Server error: " + err.message);
  }
});

// ================= Start BTC/SOL/ETH/BNB Payments =================
async function startPayment(req, res, coin) {
  const { email, amount } = req.body;

  try {
    await db.query("UPDATE users SET payment_status='processing' WHERE email=$1", [email]);
    const userResult = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    const user = userResult.rows[0];

    const addresses = {
      btc: "bc1q87yng5l9kyl7390gm80nreq2qmw3v7f0ryx699",
      sol: "9D8d3DL9sYSHU9VVnateJEeosKg31MZNPNMJxMWkAs13",
      eth: "0x497785495154a4D919Cd0aA047Fc23a778bd6337",
      bnb: "0x497785495154a4D919Cd0aA047Fc23a778bd6337",
    };

    const data = {
      name: user.full_name,
      email: user.email,
      balance: user.balance,
      paymentStatus: "processing",
      btcAmount: null,
      btcAddress: null,
      solAmount: null,
      solAddress: null,
      ethAmount: null,
      ethAddress: null,
      bnbAmount: null,
      bnbAddress: null,
      message: null,
    };

    data[coin + "Amount"] = amount;
    data[coin + "Address"] = addresses[coin];

    res.render("secrets", data);
  } catch (err) {
    console.error(err);
    res.send(`Error starting ${coin.toUpperCase()} payment.`);
  }
}

app.post("/start-btc-payment", (req, res) => startPayment(req, res, "btc"));
app.post("/start-sol-payment", (req, res) => startPayment(req, res, "sol"));
app.post("/start-eth-payment", (req, res) => startPayment(req, res, "eth"));
app.post("/start-bnb-payment", (req, res) => startPayment(req, res, "bnb"));

// ================= Deposits =================
app.post("/deposit", async (req, res) => {
  const { coin, amount, pkg } = req.body;
  const email = req.session.user_email;
  try {
    await db.query(
      "INSERT INTO deposits (email, coin, amount, pkg, status) VALUES ($1,$2,$3,$4,'processing')",
      [email, coin, amount, pkg]
    );
    res.redirect("/secrets");
  } catch (err) {
    console.error(err);
    res.send("❌ Deposit failed");
  }
});

// ================= Withdraw =================
app.get("/withdraw", (req, res) => {
  if (!req.session.user_email) return res.redirect("/login");
  res.render("withdraw", { message: null });
});

app.post("/withdraw", async (req, res) => {
  const { coin_type, address } = req.body;
  const email = req.session.user_email;

  try {
    const result = await db.query(
      "SELECT COUNT(*) FROM transactions WHERE email=$1 AND type='deposit'",
      [email]
    );
    const txCount = parseInt(result.rows[0].count);
    if (txCount < 2)
      return res.render("withdraw", { message: "You need at least 2 deposits to withdraw." });

    await db.query(
      "INSERT INTO transactions (email,type,coin_type,address,amount) VALUES($1,'withdrawal',$2,$3,0)",
      [email, coin_type, address]
    );

    res.render("withdraw", { message: "Withdrawal request submitted successfully!" });
  } catch (err) {
    console.error(err);
    res.render("withdraw", { message: "Something went wrong. Please try again." });
  }
});

// ================= Approve Payment =================
app.post("/approve-payment", async (req, res) => {
  const { email, amount } = req.body;
  try {
    await db.query(
      "UPDATE users SET balance=balance+$1, payment_status='confirmed' WHERE email=$2",
      [amount, email]
    );

    const updatedUser = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    res.render("secrets", {
      name: updatedUser.rows[0].full_name,
      email: updatedUser.rows[0].email,
      balance: updatedUser.rows[0].balance,
      paymentStatus: "confirmed",
      btc: updatedUser.rows[0].btc_balance,
      sol: updatedUser.rows[0].sol_balance,
      eth: updatedUser.rows[0].eth_balance,
      bnb: updatedUser.rows[0].bnb_balance,
      transactions: [],
      deposit: 0,
      profit: 0,
      withdrawal: 0,
      btcAmount: null,
      btcAddress: null,
      solAmount: null,
      solAddress: null,
      ethAmount: null,
      ethAddress: null,
      bnbAmount: null,
      bnbAddress: null,
      prices: getCryptoPricesCached(),
      message: null,
    });
  } catch (err) {
    console.error(err);
    res.send("Error approving payment.");
  }
});

// ================= Transactions =================
app.post("/submit-transaction", async (req, res) => {
  const { email, coin_type, amount, type, pkg, receipt_url } = req.body;
  try {
    await db.query(
      "INSERT INTO transactions (email, coin_type, amount, type, package, status, receipt_url) VALUES($1,$2,$3,$4,$5,'processing',$6)",
      [email, coin_type, amount, type, pkg, receipt_url]
    );
    res.send("✅ Transaction submitted successfully.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Failed to submit transaction.");
  }
});

app.get("/transaction-history", async (req, res) => {
  const userEmail = req.session.user_email;
  if (!userEmail) return res.redirect("/login");

  try {
    const result = await db.query(
      "SELECT * FROM transactions WHERE email=$1 ORDER BY created_at DESC",
      [userEmail]
    );
    res.render("transaction-history", { transactions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// ================= Upload Receipt =================
app.post("/upload-receipt", upload.single("receipt"), async (req, res) => {
  if (!req.file) return res.send("❌ No file uploaded.");
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: "growwvest@gmail.com",
    subject: "🧾 New Payment Receipt Uploaded",
    text: "A user has submitted a payment receipt.",
    attachments: [
      {
        filename: req.file.originalname,
        content: req.file.buffer.toString("base64"),
        encoding: "base64",
      },
    ],
  };
  try {
    await transporter.sendMail(mailOptions);
    res.send("✅ Receipt uploaded and email sent successfully!");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Failed to send email: " + err.message);
  }
});

// ================= Forgot Password =================
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);
  if (result.rows.length === 0) return res.send("No account with that email.");
  res.send("Password reset instructions have been sent to your email (simulated).");
});

// ================= Logout =================
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.log(err);
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

// ================= Change Password =================
app.post("/change-password", async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const userEmail = req.session.user_email;
  if (!userEmail) return res.redirect("/login");
  if (newPassword !== confirmPassword)
    return res.render("secrets", { errorMessage: "Passwords do not match.", successMessage: null });

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password=$1 WHERE email=$2", [hashedPassword, userEmail]);
    res.render("secrets", { successMessage: "Password updated successfully.", errorMessage: null });
  } catch (err) {
    console.error(err);
    res.render("secrets", { errorMessage: "Error updating password.", successMessage: null });
  }
});

// ================= Start Server =================
app.listen(port, "0.0.0.0", () => console.log(`Server running on port ${port}`));
