const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { run, one, all } = require('./db');
const { requireAdmin } = require('./middleware');

const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : '*'
}));
app.use(express.json({ limit: '20kb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false });

const requestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[+]?[\d\s()-]{7,20}$/),
  gender: z.string().trim().min(1).max(30),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80)
}).strict();

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200)
}).strict();

function makeId(prefix) {
  return `${prefix}-${require('node:crypto').randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}
function badRequest(res, error) {
  return res.status(400).json({
    success: false,
    message: 'Validation failed.',
    errors: error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message }))
  });
}
function getApplication(applicationId) {
  return one('SELECT * FROM applications WHERE applicationId = ?', [applicationId]);
}
function getCertificate(certificateId) {
  return one(
    `SELECT c.certificateId, c.applicationId, c.issuedOn, c.status,
            a.name, a.phone
       FROM certificates c JOIN applications a ON a.applicationId = c.applicationId
      WHERE c.certificateId = ?`,
    [certificateId]
  );
}

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'CredVault API is running.' }));

// Public: submit a certificate application.
app.post('/api/applications', publicLimiter, (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const applicationId = makeId('APP');
  const submittedAt = new Date().toISOString();
  const { name, phone, gender, city, state } = parsed.data;
  run(
    `INSERT INTO applications (applicationId, name, phone, gender, city, state, status, submittedAt)
     VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`,
    [applicationId, name, phone, gender, city, state, submittedAt]
  );
  return res.status(201).json({
    success: true, message: 'Certificate request submitted successfully.',
    applicationId, status: 'Pending'
  });
});

// Public: track an application by its ID.
app.get('/api/applications/track/:applicationId', publicLimiter, (req, res) => {
  const application = getApplication(req.params.applicationId);
  if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
  return res.json({
    applicationId: application.applicationId,
    name: application.name,
    status: application.status,
    submittedAt: application.submittedAt,
    ...(application.status === 'Rejected' && application.rejectionReason
      ? { rejectionReason: application.rejectionReason } : {})
  });
});

// Public: verify a certificate. Never expose private applicant details beyond SRS fields.
app.get('/api/certificates/verify/:certificateId', publicLimiter, (req, res) => {
  const certificate = getCertificate(req.params.certificateId);
  if (!certificate) return res.status(404).json({ success: false, message: 'Certificate not found.' });
  return res.json({
    certificateId: certificate.certificateId,
    name: certificate.name,
    phone: certificate.phone,
    issuedOn: certificate.issuedOn,
    status: certificate.status
  });
});

// Admin login: returns a short-lived JWT.
app.post('/api/admin/login', authLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const admin = one('SELECT username, passwordHash FROM admins WHERE username = ?', [parsed.data.username]);
    const valid = admin && await bcrypt.compare(parsed.data.password, admin.passwordHash);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    const token = jwt.sign(
      { role: 'admin' },
      process.env.JWT_SECRET || 'development-only-change-me',
      { subject: admin.username, expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
    return res.json({ success: true, message: 'Login successful.', token, tokenType: 'Bearer' });
  } catch (err) { next(err); }
});

app.get('/api/admin/applications', requireAdmin, (_req, res) => {
  res.json({ success: true, applications: all('SELECT * FROM applications ORDER BY submittedAt DESC') });
});

app.patch('/api/admin/applications/:applicationId/approve', requireAdmin, (req, res) => {
  const application = getApplication(req.params.applicationId);
  if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
  if (application.status === 'Rejected') {
    return res.status(409).json({ success: false, message: 'A rejected application cannot be approved.' });
  }
  const existing = one('SELECT certificateId FROM certificates WHERE applicationId = ?', [application.applicationId]);
  if (existing) {
    return res.json({ success: true, message: 'Application is already approved.', applicationId: application.applicationId, status: 'Approved', certificateId: existing.certificateId });
  }
  const certificateId = makeId('CERT');
  const issuedOn = new Date().toISOString();
  run('UPDATE applications SET status = ? WHERE applicationId = ?', ['Approved', application.applicationId]);
  run('INSERT INTO certificates (certificateId, applicationId, issuedOn, status) VALUES (?, ?, ?, ?)',
    [certificateId, application.applicationId, issuedOn, 'Valid']);
  res.json({ success: true, message: 'Application approved and certificate issued.', applicationId: application.applicationId, status: 'Approved', certificateId });
});

app.patch('/api/admin/applications/:applicationId/reject', requireAdmin, (req, res) => {
  const schema = z.object({ reason: z.string().trim().max(500).optional() }).strict();
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return badRequest(res, parsed.error);
  const application = getApplication(req.params.applicationId);
  if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
  if (application.status === 'Approved') return res.status(409).json({ success: false, message: 'An approved application cannot be rejected.' });
  run('UPDATE applications SET status = ?, rejectionReason = ? WHERE applicationId = ?',
    ['Rejected', parsed.data.reason || null, application.applicationId]);
  res.json({ success: true, message: 'Application rejected.', applicationId: application.applicationId, status: 'Rejected' });
});

app.get('/api/admin/certificates', requireAdmin, (_req, res) => {
  res.json({ success: true, certificates: all(
    `SELECT c.certificateId, c.applicationId, c.issuedOn, c.status, a.name, a.phone
       FROM certificates c JOIN applications a ON a.applicationId = c.applicationId
      ORDER BY c.issuedOn DESC`
  ) });
});

// SRS specifies GET. PATCH is also offered as the safer method for state changes.
function revokeCertificate(req, res) {
  const certificate = one('SELECT certificateId, status FROM certificates WHERE certificateId = ?', [req.params.certificateId]);
  if (!certificate) return res.status(404).json({ success: false, message: 'Certificate not found.' });
  if (certificate.status === 'Revoked') return res.json({ success: true, message: 'Certificate is already revoked.', certificateId: certificate.certificateId, status: 'Revoked' });
  run('UPDATE certificates SET status = ? WHERE certificateId = ?', ['Revoked', certificate.certificateId]);
  // The linked application record is intentionally not modified.
  return res.json({ success: true, message: 'Certificate revoked.', certificateId: certificate.certificateId, status: 'Revoked' });
}
app.get('/api/admin/certificates/:certificateId/revoke', requireAdmin, revokeCertificate);
app.patch('/api/admin/certificates/:certificateId/revoke', requireAdmin, revokeCertificate);

app.use((_req, res) => res.status(404).json({ success: false, message: 'Endpoint not found.' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

module.exports = app;
