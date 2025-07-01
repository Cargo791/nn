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

dotenv.config();


const app = express();
app.set("view engine", "ejs")
const port = process.env.PORT || 3000
const __filename = fileURLToPath (import.meta.url)
const __dirname = path.dirname(__filename)
//const prices = await getCryptoPrices()

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, './uploads/');
  },
  filename(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });


// Force IPv4
const { Pool } = pg;

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
  family: 4,
});
db.query("SELECT NOW()")
  .then(() => console.log("✅ Connected to database"))
  .catch(err => console.error("❌ Failed to connect to database:", err.stack));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: process.env.SESSION_SECRET || "your-secret",
  resave: false,
  saveUninitialized: true,
}));



app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});


// GET reset password page
app.get("/forgot-password", (req, res) => {
  res.render("forgot-password"); // forgot-password.ejs
});


app.get('/secrets', async (req, res) => {
  const userEmail = req.session.user_email; // make sure you're storing the email in session
  if (!req.session.user_email) return res.redirect("/login");

  if (!userEmail) {
    return res.redirect('/login');
  }

  try {
    const result = await db.query(
      'SELECT deposit_btc, profit_btc, withdrawal_btc FROM user_balances WHERE email = $1',
      [userEmail]
    );

    const data = result.rows[0];

   

    if (!data) {
      return res.send("❌ No balance data found.");
    }

    res.render('secrets', {
      deposit: data.deposit_btc || 0,
      profit: data.profit_btc || 0,
      deposit: user.btc_balance || 0,
      withdrawal: data.withdrawal_btc || 0,
      deposit: parseFloat(data.deposit_btc) || 0,
      profit: parseFloat(data.profit_btc) || 0,
      withdrawal: parseFloat(data.withdrawal_btc) || 0,
    });
  } catch (error) {
    console.error("Database error:", error);
    res.send("❌ Failed to fetch balance.");
  }
});


app.get("/", async (req, res) => {
  const prices = await getCryptoPrices();
  res.render("secrets.ejs", { prices });
});
     
  app.post("/register", async (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;
  const country = req.body.country;
  const phone = req.body.phone;

  console.log("➡️ Register attempt:", { name, email, password, phone, country });

  try {
    console.log("🔍 Checking if user exists...");
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    console.log("✅ Check complete:", checkResult.rows.length);

    if (checkResult.rows.length > 0) {
      return res.send("Email already exists. Try logging in.");
  const deposit = 0  

    console.log("📝 Inserting new user...");
    const result = await db.query(
      "INSERT INTO users (email, password, full_name) VALUES ($1, $2, $3) RETURNING *",
      [email, password, name]
    );
    const user = result.rows[0];

    // Parse balances as numbers or use 0 as default
    const btc_balance = parseFloat(user.btc_balance) || 0;
    const sol_balance = parseFloat(user.sol_balance) || 0;
    const eth_balance = parseFloat(user.eth_balance) || 0;
    const bnb_balance = parseFloat(user.bnb_balance) || 0;
  

      
    console.log("✅ Inserted user:", user);

    res.render("secrets.ejs", {
      name: user.full_name,
      email: user.email,
      balance: user.balance || 0,
      paymentStatus: 'none',
      btc: user.btc_balance || 0,
      deposit: parseFloat(data.deposit_btc) || 0,
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
      prices: {},
      profit:0,
      withdrawal:0,
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
        req.session.user_email = email;
        const prices = await getCryptoPrices();
        console.log("✅ Login success, rendering secrets page");

        
    // Parse balances as numbers or use 0 as default
    const btc_balance = parseFloat(user.btc_balance) || 0;
    const sol_balance = parseFloat(user.sol_balance) || 0;
    const eth_balance = parseFloat(user.eth_balance) || 0;
    const bnb_balance = parseFloat(user.bnb_balance) || 0;

        res.render("secrets.ejs", {
          name: user.full_name,
          email: email,
          deposit: parseFloat(data.deposit_btc) || 0,
          paymentStatus: 'none',
          btc: btc_balance,
          sol: sol_balance,
          eth: eth_balance,
          bnb: bnb_balance,
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
          prices: {}
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

app.post('/upload-receipt', upload.single('receipt'), async (req, res) => {
  if (!req.file) {
    return res.send('❌ No file uploaded.');
  }

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: 'growwvest@gmail.com', // replace with your email
    subject: '🧾 New Payment Receipt Uploaded',
    text: 'A user has submitted a payment receipt.',
    attachments: [
      {
        filename: req.file.filename,
        path: req.file.path
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    res.send('✅ Receipt uploaded and email sent successfully!');
  } catch (err) {
    console.error(err);
    res.send('❌ Failed to send email.');
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


app.post("/start-eth-payment", (req, res) => {
  const { email, amount } = req.body;
  console.log("Form Data:", email, amount);

  res.render("secrets.ejs", {
    name: "Test User",
    email,
    balance: "0",
    paymentStatus: "processing",
    ethAmount: amount,
    ethAddress: "0x497785495154a4D919Cd0aA047Fc23a778bd6337",
  });
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

app.post('/deposit', async (req, res) => {
  const { coin, amount, pkg } = req.body;
  const email = req.session.user_email;

  try {
    await db.query(
      'INSERT INTO deposits (email, coin, amount, pkg, status) VALUES ($1, $2, $3, $4, $5)',
      [email, coin, amount, pkg, 'processing']
    );

    res.redirect('/secrets');
  } catch (err) {
    console.error(err);
    res.send('❌ Deposit failed');
  }
});

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  // Check if user exists
  const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
  if (result.rows.length === 0) {
    return res.send("No account with that email.");
  }

  // 🛠️ Here you would:
  // - Generate a secure reset token
  // - Save it in DB with expiry
  // - Email a reset link to user
  // e.g., /reset-password?token=abcd123

  res.send("Password reset instructions have been sent to your email (simulated).");
});




// Set up Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,  // from .env
    pass: process.env.EMAIL_PASSWORD   // from .env
  }
});
app.post('/submit-transaction', async (req, res) => {
  const { email, coin_type, amount, type, pkg, receipt_url } = req.body;

  try {
    await db.query(
      'INSERT INTO transactions (email, coin_type, amount, type, package, status, receipt_url) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [email, coin_type, amount, type, pkg, 'processing', receipt_url]
    );

    res.send('✅ Transaction submitted successfully.');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Failed to submit transaction.');
  }
});
app.get('/transaction-history', async (req, res) => {
  const userEmail = req.session.email;

  const result = await db.query(
    'SELECT * FROM transactions WHERE email = $1 ORDER BY created_at DESC',
    [userEmail]
  );

  res.render('transaction-history', { transactions: result.rows });
});
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
