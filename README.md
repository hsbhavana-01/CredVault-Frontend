# CredVault — Full Stack Certificate Issuing & Verification Platform

**ELEVATE SDE Internship · Task 4**

CredVault connects a React frontend to an Express REST API and SQLite database. Citizens can request certificates, track application status, and verify issued certificates. Authenticated administrators can list applications, approve or reject requests, list certificates, and revoke certificates.

## Project structure

```text
ELEVATE-SDE-Task-4/
├── frontend/                 # React + Vite UI
│   ├── src/main.jsx          # API-connected pages and interactions
│   ├── src/styles.css
│   ├── .env.example
│   └── package.json
├── backend/                  # Express REST API + SQLite
│   ├── src/app.js
│   ├── src/db.js
│   ├── src/middleware.js
│   ├── src/server.js
│   ├── .env.example
│   └── package.json
└── README.md
```

## Requirements

- Node.js 18 or later and npm
- Two terminals, one for the backend and one for the frontend

## Run locally (Windows PowerShell)

### 1. Start the backend

```powershell
cd backend
Copy-Item .env.example .env
npm install
```

Edit `backend/.env` and set a strong unique `JWT_SECRET` and a secure `ADMIN_PASSWORD`. The provided admin defaults are for local development only. Then run:

```powershell
npm run dev
```

The backend listens at `http://localhost:4000`. Verify it at `http://localhost:4000/api/health`.

The SQLite database is created automatically at `backend/data/credvault.sqlite` on first start. It is ignored by Git.

### 2. Start the frontend in a second terminal

From the repository root:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`. The frontend's `VITE_API_BASE_URL` defaults to `http://localhost:4000/api`.

## Admin login

On the first database initialization, the backend creates the admin account from `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `backend/.env`. The example file uses `admin` / `ChangeMe123!` only for local testing. Change both before deployment. If the admin row already exists, changing `.env` will not reset its stored password.

Admin login returns a JWT. The frontend keeps the token in `sessionStorage`, attaches it as `Authorization: Bearer <token>` for admin requests, and redirects protected admin pages to login when no token is present.

## Integrated API routes

| Method | Route | Use |
|---|---|---|
| `POST` | `/api/applications` | Submit request and receive a real Application ID |
| `GET` | `/api/applications/track/:applicationId` | Fetch application status from SQLite |
| `GET` | `/api/certificates/verify/:certificateId` | Verify a certificate from SQLite |
| `POST` | `/api/admin/login` | Authenticate admin and issue JWT |
| `GET` | `/api/admin/applications` | List stored applications (admin token required) |
| `PATCH` | `/api/admin/applications/:applicationId/approve` | Approve application and issue Certificate ID |
| `PATCH` | `/api/admin/applications/:applicationId/reject` | Reject application (optional reason supported) |
| `GET` | `/api/admin/certificates` | List issued certificates (admin token required) |
| `GET` / `PATCH` | `/api/admin/certificates/:certificateId/revoke` | Revoke certificate (admin token required) |

## Expected flow to test

1. Open Request a certificate and submit valid applicant details. Copy the Application ID returned by the API.
2. Open Track application and paste the ID. It should show the database status and submission date.
3. Open Admin login and sign in with the configured backend credentials.
4. In Applications, approve a pending request. The API creates a certificate and returns its Certificate ID in the success message. You can also reject a pending request.
5. Open Certificates and confirm the new certificate appears. Revoke it and confirm the status changes to `Revoked`.
6. Use the Certificate ID on the public Verify page. It should display the live status, including `Revoked` if applicable.
7. Refresh pages and confirm records remain because they are stored in SQLite.

## Screenshots / screen recording

The SRS requires screenshots or a screen-recorded video of the entire website in this README. After running both servers, capture real browser screenshots of:

- Home page
- Request form and successful submission showing an actual Application ID
- Track page with a real application status
- Verify page with a real certificate result
- Admin login
- Admin applications with approve/reject actions
- Admin certificates with revoke action and status

Add the captured images under `docs/screenshots/` and embed them here, for example:

```markdown
![Home page](docs/screenshots/home.png)
```

Do not use mock records in the screenshots; generate the records through the application. A real browser capture is not included by this project-generation step.

## Security and operational notes

- Never commit `.env`, live SQLite database files, or real secrets.
- Configure `CORS_ORIGIN` for the frontend origin used in your environment.
- Use HTTPS and a strong JWT secret for deployment.
- Admin APIs require a valid bearer token. The frontend uses session-scoped token storage and provides a sign-out action.
- Application and certificate lists and lookup results are fetched from the backend; no seeded frontend records are used.
