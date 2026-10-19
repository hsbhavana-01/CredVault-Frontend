# CredVault Backend — ELEVATE SDE Task 3

Backend-only REST API for certificate requests, application tracking, public certificate verification, admin approval/rejection, and certificate revocation. No frontend is included.

## Technology
- Node.js + Express
- SQLite database persisted to `data/credvault.sqlite` using `sql.js`
- Zod request validation
- bcrypt password hashing and JWT admin authentication
- Helmet, CORS, and rate limits

## Requirements
- Node.js 18 or later
- npm

## Setup on Windows PowerShell

```powershell
# Run these commands from the folder containing package.json
Copy-Item .env.example .env
npm install
npm run dev
```

Edit `.env` and set a unique `JWT_SECRET` and a secure `ADMIN_PASSWORD` before using or deploying the API. The development defaults are only for local testing. The initial admin account is created the first time the database starts; changing the env password later does not change an already-created account.

API starts at `http://localhost:4000`. Health check: `GET http://localhost:4000/api/health`.

## Admin credentials for first local run
The `.env.example` defaults are `admin` / `ChangeMe123!`. Change these immediately for any shared or deployed environment. Do not commit `.env`.

## API endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/applications` | Public | Submit application |
| GET | `/api/applications/track/:applicationId` | Public | Track application |
| GET | `/api/certificates/verify/:certificateId` | Public | Verify certificate |
| POST | `/api/admin/login` | Public, rate-limited | Admin login; returns JWT |
| GET | `/api/admin/applications` | Admin Bearer token | List applications |
| PATCH | `/api/admin/applications/:applicationId/approve` | Admin Bearer token | Approve and issue certificate |
| PATCH | `/api/admin/applications/:applicationId/reject` | Admin Bearer token | Reject application; optional `reason` |
| GET | `/api/admin/certificates` | Admin Bearer token | List certificates |
| GET | `/api/admin/certificates/:certificateId/revoke` | Admin Bearer token | Revoke certificate (SRS compatibility) |
| PATCH | `/api/admin/certificates/:certificateId/revoke` | Admin Bearer token | Revoke certificate (recommended state-changing method) |

All admin endpoints except login require `Authorization: Bearer <token>`.

## Example requests

### Submit application
```http
POST /api/applications
Content-Type: application/json
```
```json
{
  "name": "Asha Kumar",
  "phone": "+91 9876543210",
  "gender": "Female",
  "city": "Bengaluru",
  "state": "Karnataka"
}
```

### Admin login
```http
POST /api/admin/login
Content-Type: application/json
```
```json
{ "username": "admin", "password": "ChangeMe123!" }
```

Use the returned `token` in the Authorization header for admin routes.

### Approve an application
```http
PATCH /api/admin/applications/APP-APPLICATIONID/approve
Authorization: Bearer YOUR_TOKEN
```
The response contains a generated `certificateId`.

### Reject an application
```http
PATCH /api/admin/applications/APP-APPLICATIONID/reject
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```
```json
{ "reason": "Please submit a clearer supporting document." }
```

## Database models

- **applications**: `applicationId`, `name`, `phone`, `gender`, `city`, `state`, `status`, `submittedAt`, `rejectionReason`
- **certificates**: `certificateId`, `applicationId`, `issuedOn`, `status`
- **admins**: `username`, `passwordHash`, `createdAt`

Application statuses: `Pending`, `Approved`, `Rejected`. Certificate statuses: `Valid`, `Revoked`.

When approving an application, a unique certificate is created. Re-approving is idempotent and returns the existing certificate. Revoking a certificate changes only the certificate record; the original application remains unchanged.

## Error responses
Validation errors return HTTP 400 with field-level details. Missing records return 404. Invalid login or missing/expired token returns 401. Invalid state transitions return 409.

## Notes
- SQLite file is created automatically on first startup.
- Do not commit secrets or the live database file.
- The SRS lists certificate revocation as GET; this route is provided for compatibility. PATCH is also provided and is preferred for a state-changing operation.
- No screenshots are required for Task 3 according to the SRS.
