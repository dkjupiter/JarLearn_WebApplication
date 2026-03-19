const db = require("../db");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");

const passwordRegex = /^[A-Za-z0-9!@#$%^&*,.?]+$/;

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

module.exports = (socket) => {

  console.log("Auth socket ready:", socket.id);

  /* =========================
     REGISTER
  ========================= */

  socket.on("register", async ({ name, email, password }) => {

    try {

      if (!name || !email || !password) {
        return socket.emit("register_result", {
          success: false,
          message: "Please fill in all fields"
        });
      }

      if (password.length < 8) {
        return socket.emit("register_result", {
          success: false,
          message: "Password must be at least 8 characters"
        });
      }

      if (!passwordRegex.test(password)) {
        return socket.emit("register_result", {
          success: false,
          message: "Password contains invalid characters"
        });
      }

      const check = await db.query(
        `SELECT * FROM "Teachers" WHERE "Teacher_Email"=$1`,
        [email]
      );

      if (check.rows.length > 0) {
        return socket.emit("register_result", {
          success: false,
          message: "Email already exists"
        });
      }

      const hash = await bcrypt.hash(password, 10);

      await db.query(
        `INSERT INTO "Teachers"
        ("Teacher_Name","Teacher_Email","Teacher_Password")
        VALUES($1,$2,$3)`,
        [name, email, hash]
      );

      socket.emit("register_result", { success: true });

    } catch (err) {

      console.error("Register error:", err);

      socket.emit("register_result", {
        success: false,
        message: "Register failed"
      });

    }

  });


  /* =========================
     LOGIN
  ========================= */

  socket.on("login", async ({ email, password }) => {

    try {

      const result = await db.query(
        `SELECT * FROM "Teachers"
         WHERE "Teacher_Email"=$1`,
        [email]
      );

      if (result.rows.length === 0) {
        return socket.emit("login_result", {
          success: false,
          message: "Incorrect email or password"
        });
      }

      const user = result.rows[0];

      let match = false;

      if (user.Teacher_Password.startsWith("$2")) {
        // bcrypt
        match = await bcrypt.compare(password, user.Teacher_Password);
      } else {
        // plain text
        match = password === user.Teacher_Password;
      }

      if (!match) {
        return socket.emit("login_result", {
          success: false,
          message: "Incorrect email or password"
        });
      }

      socket.emit("login_result", {
        success: true,
        user: {
          id: user.Teacher_ID,
          name: user.Teacher_Name,
          email: user.Teacher_Email
        }
      });

    } catch (err) {

      console.error("Login error:", err);

      socket.emit("login_result", {
        success: false,
        message: "Login failed"
      });

    }

  });


  /* =========================
     CHECK EMAIL
  ========================= */

  socket.on("check_email", async ({ email }) => {

    try {

      const result = await db.query(
        `SELECT * FROM "Teachers"
         WHERE "Teacher_Email"=$1`,
        [email]
      );

      socket.emit("check_email_result", {
        success: result.rows.length > 0
      });

    } catch (err) {

      socket.emit("check_email_result", {
        success: false
      });

    }

  });


  /* =========================
     FORGOT PASSWORD
  ========================= */

  socket.on("forgot_password", async ({ email }) => {

    try {

      const result = await db.query(
        `SELECT * FROM "Teachers"
         WHERE "Teacher_Email"=$1`,
        [email]
      );

      if (result.rows.length === 0) {
        return socket.emit("forgot_result", {
          success: false,
          message: "Email not found"
        });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expire = Date.now() + 1000 * 60 * 15;

      await db.query(
        `UPDATE "Teachers"
         SET "Reset_Token"=$1,
             "Reset_Token_Expire"=$2
         WHERE "Teacher_Email"=$3`,
        [token, expire, email]
      );

      const resetLink =
        `http://localhost:3000/reset-password/${token}`;

      await transporter.sendMail({
        to: email,
        subject: "Reset Password",
        html: `
          <h3>Password Reset</h3>
          <p>Click this link to reset your password</p>
          <a href="${resetLink}">${resetLink}</a>
        `
      });

      socket.emit("forgot_result", { success: true });

    } catch (err) {

      console.error("Forgot password error:", err);

      socket.emit("forgot_result", {
        success: false,
        message: "Failed to send reset email"
      });

    }

  });


  /* =========================
     RESET PASSWORD
  ========================= */

  socket.on("reset_password", async ({ token, newPassword }) => {

    try {

      const result = await db.query(
        `SELECT * FROM "Teachers"
         WHERE "Reset_Token"=$1`,
        [token]
      );

      if (result.rows.length === 0) {
        return socket.emit("reset_result", {
          success: false,
          message: "Invalid token"
        });
      }

      const user = result.rows[0];

      if (Date.now() > user.Reset_Token_Expire) {
        return socket.emit("reset_result", {
          success: false,
          message: "Token expired"
        });
      }

      const hash = await bcrypt.hash(newPassword, 10);

      await db.query(
        `UPDATE "Teachers"
         SET "Teacher_Password"=$1,
             "Reset_Token"=NULL,
             "Reset_Token_Expire"=NULL
         WHERE "Teacher_ID"=$2`,
        [hash, user.Teacher_ID]
      );

      socket.emit("reset_result", { success: true });

    } catch (err) {

      console.error("Reset password error:", err);

      socket.emit("reset_result", {
        success: false,
        message: "Reset failed"
      });

    }

  });

};