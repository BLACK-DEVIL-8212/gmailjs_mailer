const fs = require("fs");
const csv = require("csv-parser");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const readline = require("readline");

// Load OAuth2 credentials
const CREDENTIALS_PATH = "./email@gmail.com.json";
const CREDENTIALS = require(CREDENTIALS_PATH);
const { client_id, client_secret, redirect_uris } = CREDENTIALS.installed || CREDENTIALS.web;

// OAuth2 Client
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

// Ensure refresh_token exists or generate a new one
async function ensureToken() {
  if (CREDENTIALS.refresh_token) {
    oAuth2Client.setCredentials({ refresh_token: CREDENTIALS.refresh_token });
    return;
  }

  // No refresh token found → request authorization
  const SCOPES = ["https://mail.google.com/"];
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("⚠️ No refresh_token found.");
  console.log("👉 Authorize this app by visiting this URL:\n", authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise((resolve) => {
    rl.question("\nPaste the code here: ", (code) => {
      rl.close();
      resolve(code);
    });
  });

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  // Save refresh_token back into email@gmail.com.json
  CREDENTIALS.refresh_token = tokens.refresh_token;
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(CREDENTIALS, null, 2));
  console.log("✅ Refresh token saved to", CREDENTIALS_PATH);
}

// Function to send email
async function sendMail(toEmail) {
  try {
    const accessToken = await oAuth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: "shakshamshakshamsingh@gmail.com", // your Gmail
        clientId: client_id,
        clientSecret: client_secret,
        refreshToken: CREDENTIALS.refresh_token,
        accessToken: accessToken.token,
      },
    });

    const mailOptions = {
      from: '"Support"',
      to: toEmail,
      subject: "Hello from Nexivo Mass Mailer 🚀",
      text: "This is a test email sent via Google OAuth2 + Node.js.",
      html: "<h2>Hello!</h2><p>This is a <b>test mass mail</b> using Node.js.</p>",
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to: ${toEmail}`);
    return result;
  } catch (error) {
    console.error(`❌ Failed for ${toEmail}:`, error.message);
  }
}

// Read users from CSV and send emails
async function sendMassEmails() {
  await ensureToken();

  fs.createReadStream("user.csv")
    .pipe(csv())
    .on("data", (row) => {
      const email = row.email || Object.values(row)[0]; // handles CSV with/without headers
      if (email) {
        sendMail(email);
      }
    })
    .on("end", () => {
      console.log("📨 Finished sending emails!");
    });
}

sendMassEmails();
