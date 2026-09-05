# CloudNova — Backend

REST API for **CloudNova**, a cloud file storage & sharing app. Built with Node.js + Express, PostgreSQL (via Supabase) for metadata, and Supabase Storage for the actual files. Auth is stateless JWT (Bearer token).

🔗 Frontend repo: [Cloud_Storage_Frontend](#) <!-- add the frontend repo link here -->

Live API: `https://cloud-storage-backend-six.vercel.app`

<img width="1887" height="847" alt="image" src="https://github.com/user-attachments/assets/5975c9d6-6e4d-4193-8f57-368fdc11734e" />

## Features

- **Auth** — register/login with bcrypt-hashed passwords, JWT issued on login
- **Folders** — create, list, rename, soft-delete
- **Files** — upload (via Multer, in-memory → Supabase Storage), list, get, rename, move, soft-delete
- **Versions** — upload new versions of a file, list version history, download or restore a specific version
- **Sharing** — share files/folders with other users as Viewer/Editor, update or revoke access, list who has access
- **Public links** — generate a public share link/token for a resource, resolve it (with optional password verification) without login
- **Search** — search across your files
- **Trash** — soft-deleted files/folders live in trash; restore or permanently delete

## Tech Stack

- [Node.js](https://nodejs.org/) + [Express 5](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/) via [Supabase](https://supabase.com/) (`pg` for queries)
- [Supabase Storage](https://supabase.com/docs/guides/storage) for file objects
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) for auth
- [bcrypt](https://www.npmjs.com/package/bcrypt) for password hashing
- [Multer](https://github.com/expressjs/multer) for multipart file uploads
- [Jest](https://jestjs.io/) + [Supertest](https://github.com/ladjs/supertest) for tests
- Deployed on [Vercel](https://vercel.com/)

## Project Structure

```
src/
├── app.js                 # Express app, middleware, route mounting
├── server.js              # entrypoint — starts the server
├── config/
│   ├── db.js               # pg Pool (DATABASE_URL)
│   └── supabase.js         # Supabase client (storage)
├── middleware/
│   └── authMiddleware.js   # verifies Bearer JWT, sets req.user
├── controllers/            # auth, file, folder, share, search, trash, version
└── routes/                 # one router per resource, mounted under /api/*
tests/                      # Jest + Supertest
```

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com/) project (Postgres database + a Storage bucket)

### Setup

```bash
git clone https://github.com/GopikaR07/Cloud_Storage_Backend.git
cd Cloud_Storage_Backend
npm install
```

Create a `.env` file in the root:

```
PORT=5000
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/postgres   # Supabase connection string (session pooler)
JWT_SECRET=your-long-random-secret
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-role-key
SUPABASE_STORAGE_BUCKET=your-bucket-name
CORS_ORIGIN=http://localhost:5173                          # comma-separate multiple origins
```

Run it:

```bash
npm run dev     # nodemon, auto-restart
npm start       # plain node
```

Health check: `GET /health` · DB check: `GET /db-test`

### Tests

```bash
npm test
```

## API Overview

All routes below (except auth register/login, public link resolution) require an `Authorization: Bearer <token>` header.

| Resource | Routes |
|---|---|
| **Auth** | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `GET /api/auth/by-email` |
| **Folders** | `POST /api/folders` · `GET /api/folders` · `PATCH /api/folders/:id` · `DELETE /api/folders/:id` |
| **Files** | `GET /api/files` · `POST /api/files/upload` · `GET /api/files/:id` · `PATCH /api/files/:id` · `PATCH /api/files/:id/move` · `DELETE /api/files/:id` |
| **Versions** | `GET /api/versions/:fileId` · `POST /api/versions/:fileId` · `GET /api/versions/:fileId/:versionId/download` · `PATCH /api/versions/:fileId/:versionId/restore` |
| **Shares** | `POST /api/shares` · `GET /api/shares` · `GET /api/shares/:resourceType/:resourceId` · `PUT /api/shares/:id` · `DELETE /api/shares/:id` |
| **Public links** | `POST /api/shares/link` · `GET /api/shares/link/:resourceType/:resourceId` · `DELETE /api/shares/link/:id` · `GET /api/public/:token` · `POST /api/public/:token/verify` |
| **Search** | `GET /api/search?q=...` |
| **Trash** | `GET /api/trash` · `PATCH /api/trash/files/:id/restore` · `DELETE /api/trash/files/:id` · `PATCH /api/trash/folders/:id/restore` · `DELETE /api/trash/folders/:id` |

## Deployment

Configured for Vercel out of the box (`vercel.json` routes everything to `src/server.js`). Set the same environment variables from `.env` in your Vercel project settings, and set `CORS_ORIGIN` to your deployed frontend URL.

## License

This project is for personal/academic use.
