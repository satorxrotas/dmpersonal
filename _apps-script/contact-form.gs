/**
 * DAVID MAXWELL — website contact form  →  Google Sheet + Gmail
 *
 * Every submission from the site's contact form:
 *   1. is logged as a new row in the "Submissions" tab of this Sheet
 *   2. gets an automatic "thank you" email, sent from this Google account to the visitor
 *      (this starts the Gmail thread with them; when they reply it lands in this inbox)
 *   3. sends a notification to this account with their message (hit Reply to answer them)
 *
 * SETUP (once, signed in to David's Google account):
 *   1. Create a Google Sheet → Extensions → Apps Script → paste this whole file over the sample code → Save
 *   2. Edit the CONFIG block below if you want different wording
 *   3. Run ▸ setup  (first time: Review permissions → choose the account → Allow)
 *   4. Deploy → New deployment → type "Web app"
 *        Execute as: Me      Who has access: Anyone      → Deploy
 *   5. Copy the Web app URL (ends in /exec) and paste it into FORM_ENDPOINT in the site's index.html
 *
 * After any later edit here: Deploy → Manage deployments → ✎ → Version "New version" → Deploy
 * (the URL stays the same).
 */

const CONFIG = {
  SHEET_NAME: 'Submissions',
  FROM_NAME: 'David Maxwell',                       // shown as the sender of the auto-reply
  REPLY_SUBJECT: 'Thanks for reaching out',
  REPLY_BODY: [                                     // {first} = the visitor's first name
    'Hi {first},',
    '',
    'Thank you for contacting me. I’ve received your message and will get back to you as soon as possible.',
    '',
    'David Maxwell',
  ].join('\n'),
  NOTIFY_OWNER: true,                               // also email this account a copy of each message
  PER_EMAIL_COOLDOWN_MIN: 10,                       // ignore repeat submissions from the same address
  DAILY_EMAIL_CAP: 40,                              // max auto-replies per day (protects the Gmail quota)
};

/* ---------- web app ---------- */

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = (e && e.parameter) || {};
    if (p.website) return done_();                                   // honeypot: only bots fill it
    if (Number(p.t || 0) < 2500) return done_();                     // sent < 2.5 s after opening the form: bot

    const name = clean_(p.name, 120), email = clean_(p.email, 254).toLowerCase(), message = clean_(p.message, 5000);
    if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return done_(false);

    const cache = CacheService.getScriptCache();
    if (cache.get('mail:' + email)) return done_();                  // same address again within the cooldown
    cache.put('mail:' + email, '1', CONFIG.PER_EMAIL_COOLDOWN_MIN * 60);

    const sheet = sheet_();
    const capped = overDailyCap_();
    let status = 'replied';
    if (capped) status = 'logged only (daily email cap reached)';

    if (!capped) {
      // 1) the thank-you: fixed wording + first name only, so the form can't be used to send other text
      MailApp.sendEmail({
        to: email,
        subject: CONFIG.REPLY_SUBJECT,
        body: CONFIG.REPLY_BODY.replace('{first}', firstName_(name)),
        name: CONFIG.FROM_NAME,
      });
      // 2) the notification to this account, with their message; Reply goes to them
      if (CONFIG.NOTIFY_OWNER) {
        MailApp.sendEmail({
          to: Session.getEffectiveUser().getEmail(),
          subject: 'New website message — ' + name,
          body: message + '\n\n— ' + name + ' <' + email + '>\n\n(Logged in your "' + CONFIG.SHEET_NAME + '" sheet. Hit Reply to answer them directly.)',
          replyTo: email,
          name: 'Website contact form',
        });
      }
    }
    sheet.appendRow([new Date(), safe_(name), safe_(email), safe_(message), status]);
    return done_();
  } catch (err) {
    console.error(err);
    return done_(false);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput('Contact form endpoint is running.');
}

/* ---------- one-time setup (Run ▸ setup) ---------- */

function setup() {
  sheet_();
  Logger.log('Ready. Sheet tab "%s" exists; now Deploy → New deployment → Web app.', CONFIG.SHEET_NAME);
}

/* ---------- helpers ---------- */

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_NAME);
    sh.appendRow(['Received', 'Name', 'Email', 'Message', 'Status']);
    sh.setFrozenRows(1);
    sh.getRange('A1:E1').setFontWeight('bold');
    sh.setColumnWidth(4, 480);
    sh.getRange('D:D').setWrap(true);
  }
  return sh;
}

function overDailyCap_() {
  const props = PropertiesService.getScriptProperties();
  const key = 'sent:' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const n = Number(props.getProperty(key) || 0);
  if (n >= CONFIG.DAILY_EMAIL_CAP) return true;
  props.setProperty(key, String(n + 1));
  return false;
}

function clean_(v, max) {
  return String(v || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

// stop spreadsheet formula injection: values starting with = + - @ are stored as text
function safe_(v) {
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function firstName_(name) {
  const f = (name.split(/\s+/)[0] || '').replace(/[^\p{L}'\-]/gu, '').slice(0, 30);
  return f || 'there';
}

function done_(ok) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok !== false }))
    .setMimeType(ContentService.MimeType.JSON);
}
