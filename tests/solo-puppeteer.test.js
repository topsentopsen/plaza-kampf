/* v2.0: Puppeteer Solo-Durchlauf (braucht lokalen Server + Chrome).
   Skip wenn PLAZA_SKIP_BROWSER=1 oder kein Chrome. */
var assert = require('assert');
var http = require('http');
var fs = require('fs');
var path = require('path');
var { spawn } = require('child_process');

var CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
var PORT = 8766;
var ROOT = path.join(__dirname, '..');

function haveChrome() {
  try { return fs.existsSync(CHROME); } catch (e) { return false; }
}

if (process.env.PLAZA_SKIP_BROWSER === '1' || !haveChrome()) {
  console.log('skip — solo-puppeteer.test.js (kein Chrome / PLAZA_SKIP_BROWSER)');
  process.exit(0);
}

(async function () {
  var srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(function (r) { setTimeout(r, 600); });
  var puppeteer;
  try {
    puppeteer = require('/tmp/pshot/node_modules/puppeteer-core');
  } catch (e) {
    srv.kill();
    console.log('skip — solo-puppeteer.test.js (puppeteer-core fehlt unter /tmp/pshot)');
    process.exit(0);
  }
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,900']
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:' + PORT + '/?v=2.7', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('#name-input', { timeout: 8000 });
  var ver = await page.$eval('#version', function (el) { return el.textContent; });
  assert.ok(/Plaza-Kampf/.test(ver), 'version label');
  await page.type('#name-input', 'QA-Bot');
  await page.click('[data-act="solo"]');
  await page.waitForSelector('.char-card', { timeout: 5000 });
  await page.evaluate(function () {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.char-card'));
    (cards.find(function (c) { return /Biel/i.test(c.textContent); }) || cards[0]).click();
  });
  // Countdown + kurze Kampfphase
  await new Promise(function (r) { setTimeout(r, 4000); });
  for (var i = 0; i < 15; i++) {
    await page.keyboard.down('ArrowRight');
    await page.keyboard.press('KeyA');
    await new Promise(function (r) { setTimeout(r, 50); });
  }
  await page.keyboard.up('ArrowRight');
  var phase = await page.evaluate(function () {
    var c = document.getElementById('spiel');
    return c && c.width >= 1280 && c.height >= 768;
  });
  assert.ok(phase, 'canvas 1280×768');
  var out = path.join(ROOT, '..', 'plaza-kampf-shots', 'v2.0');
  try { fs.mkdirSync(out, { recursive: true }); } catch (e) {}
  await page.screenshot({ path: path.join(out, 'solo-puppeteer.png') });
  await browser.close();
  srv.kill();
  console.log('ok — solo-puppeteer.test.js');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
