const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');

let db;
let dbFile;

function persist() {
  const dir = path.dirname(dbFile);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbFile, Buffer.from(db.export()));
}

function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

function one(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    return stmt.step() ? stmt.getAsObject() : null;
  } finally {
    stmt.free();
  }
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = [];
  try {
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();
  dbFile = path.resolve(process.env.DB_FILE || './data/credvault.sqlite');
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  db = fs.existsSync(dbFile)
    ? new SQL.Database(new Uint8Array(fs.readFileSync(dbFile)))
    : new SQL.Database();

  db.run(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS applications (
      applicationId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      gender TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending'
        CHECK(status IN ('Pending','Approved','Rejected')),
      submittedAt TEXT NOT NULL,
      rejectionReason TEXT
    );
    CREATE TABLE IF NOT EXISTS certificates (
      certificateId TEXT PRIMARY KEY,
      applicationId TEXT NOT NULL UNIQUE,
      issuedOn TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Valid'
        CHECK(status IN ('Valid','Revoked')),
      FOREIGN KEY(applicationId) REFERENCES applications(applicationId)
    );
    CREATE TABLE IF NOT EXISTS admins (
      username TEXT PRIMARY KEY,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
  `);
  persist();

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const existing = one('SELECT username FROM admins WHERE username = ?', [username]);
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    run('INSERT INTO admins (username, passwordHash, createdAt) VALUES (?, ?, ?)',
      [username, passwordHash, new Date().toISOString()]);
  }
}

module.exports = { initDatabase, run, one, all };
