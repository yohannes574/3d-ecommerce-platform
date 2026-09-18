const Notification = require('../models/Notification');

/*
 * Notification service — in-app feed plus real SMTP email when configured.
 *
 * EMAIL_HOST/EMAIL_USER/EMAIL_PASS in .env switch the mailer from a console
 * log to Nodemailer. Errors never break the main flow: a failed email is
 * logged and dropped (the in-app notification is the source of truth).
 */
let transporter = null;
try {
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
    });
  }
} catch (err) {
  console.warn('[mailer] Nodemailer unavailable — falling back to console log:', err.message);
}

async function sendEmail({ to, subject, text }) {
  if (!to) return;
  if (!transporter) {
    console.log(`📧 [mailer:stub] to=${to} subject="${subject}" — ${text}`);
    return;
  }
  /* Fire-and-forget: the in-app notification is the source of truth, so slow
     or failing SMTP must never block an API response (order placement, login…). */
  transporter
    .sendMail({
      from: process.env.EMAIL_FROM || `Voltix <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    })
    .catch((err) => console.warn(`📧 [mailer] send failed to=${to}: ${err.message}`));
}

/** One-shot connectivity check used at boot (logs, never throws). */
async function verifyMailer() {
  if (!transporter) return;
  try {
    await transporter.verify();
    console.log('📧 [mailer] SMTP ready — verification emails will be delivered');
  } catch (err) {
    console.warn(`📧 [mailer] SMTP check failed (emails will log instead): ${err.message}`);
  }
}

/**
 * notify({ userId, email?, type, title, body, link })
 * Creates the in-app row; if an email address is supplied, also "sends" one.
 */
async function notify({ userId, email, type = 'account', title, body = '', link = '' }) {
  if (!userId) return;
  try {
    await Notification.create({ user: userId, type, title, body, link });
    await sendEmail({ to: email, subject: `[Voltix] ${title}`, text: body || title });
  } catch (err) {
    // notifications must never break the main flow
    console.warn('[notify] failed:', err.message);
  }
}

module.exports = { notify, sendEmail, verifyMailer };
