// Headless browser check: loads pages, captures console errors & page crashes.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'fs';

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
];
const exe = CHROME_PATHS.find(existsSync);
if (!exe) { console.error('Chrome not found'); process.exit(1); }

const BASE = process.argv[2] || 'http://localhost:5173';
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new' });
const page = await browser.newPage();

const problems = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`[console.error] ${msg.text()}`);
});
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));
page.on('requestfailed', (req) =>
  problems.push(`[requestfailed] ${req.url()} -> ${req.failure()?.errorText}`)
);

for (const route of ['/', '/products', '/cart']) {
  problems.length = 0;
  await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise((r) => setTimeout(r, 2500));
  const text = await page.evaluate(() => document.body.innerText.trim().slice(0, 200));
  console.log(`\n=== ${route} ===`);
  console.log(`visible text (${text.length} chars): ${text.replace(/\n/g, ' | ').slice(0, 160)}`);
  console.log(problems.length ? `❌ ${problems.length} problem(s):` : '✅ no console/page errors');
  problems.slice(0, 6).forEach((p) => console.log('   ' + p.slice(0, 300)));
}

/* ---------- Scenario: stale/garbage token (pre-reseed session) ---------- */
console.log('\n=== /cart with STALE token in localStorage ===');
problems.length = 0;
await page.evaluate(() => localStorage.setItem('voltix_token', 'garbage.stale.token'));
await page.goto(BASE + '/cart', { waitUntil: 'networkidle2', timeout: 20000 });
await new Promise((r) => setTimeout(r, 2500));
const staleText = await page.evaluate(() => document.body.innerText.trim().slice(0, 120));
console.log(`renders: ${staleText.replace(/\n/g, ' | ').slice(0, 110)}`);
console.log(problems.length ? `❌ ${problems.length} problem(s)` : '✅ graceful (no blank page)');

/* ---------- Scenario: real customer login -> cart with items ---------- */
console.log('\n=== /cart as LOGGED-IN CUSTOMER ===');
problems.length = 0;
const login = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'customer@voltix.com', password: 'cust123' }),
}).then((r) => r.json());
await page.evaluate((t) => localStorage.setItem('voltix_token', t), login.token);
await page.goto(BASE + '/cart', { waitUntil: 'networkidle2', timeout: 20000 });
await new Promise((r) => setTimeout(r, 2500));
const cartText = await page.evaluate(() => document.body.innerText.trim().slice(0, 300));
console.log(`renders: ${cartText.replace(/\n/g, ' | ').slice(0, 220)}`);
console.log(problems.length ? `❌ ${problems.length} problem(s)` : '✅ no console/page errors');
problems.slice(0, 6).forEach((p) => console.log('   ' + p.slice(0, 300)));

await browser.close();
