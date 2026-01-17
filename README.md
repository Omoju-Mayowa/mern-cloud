# MERN Blog

## Overview ✨
**MERN Blog** is a simple, modular blog platform built with the MERN stack (MongoDB, Express, React, Node). It focuses on clean APIs, modular controllers, and security features such as double password hashing with pepper rotation, rate limiting, and suspicious-login alerts.

---

## Key Features ✅
- **Authentication & security:** SHA-256 pre-hash + Argon2 hashing with rotating secret peppers. Rehashing and monthly rehash rotation supported.
- **Rate limiting & shadow-banning** for suspicious IPs.
- **User profiles:** avatars, about, posts counter, IP tracking.
- **Content:** posts, categories, thumbnails, and basic admin utilities.
- **Extensible codebase:** clear separation of controllers, models, utilities and middleware.

---

## Important files & locations 🔍
- Peppers file: `server/config/peppers.json` (newest pepper is index `0`).
- Peppers utility: `server/utils/peppers.js`
- CLI helper: `server/utils/addPepper.js`
- Login & rehash logic: `server/controllers/userControllers.js`
- Password reset: `server/controllers/passwordResetController.js`

> Note: `peppers.json` contains secret values (peppers). Keep it secure and consider adding it to `.gitignore` if you do not want to commit them to VCS.

---

## How pepper rotation & verification works 🔐
- Peppers are kept newest-first in `peppers.json` (index `0` = current pepper).
- Each user stores a numeric `pepperVersion` that points to an index in the peppers array.
- On login/update the system:
  1. Uses the user's `pepperVersion` as a start index to check the correct pepper first (fast for users who are close to current).
  2. If a match is found at a non-0 index, the password is rehashed using the current pepper (index `0`) and the user's `pepperVersion` is set to `0`.
  3. If the Argon2 parameters changed or the monthly rehash period is reached, the password is rehashed as well.

---

## Authentication (JWT) & Posting API 🔑📝

### JWT flow and usage
- On successful login (`POST /api/users/login`) the server issues a JWT token:
  - Payload: `{ id, name }` (user id and name)
  - Signed with `process.env.JWT_SECRET`
  - Expires in **6 hours** (`expiresIn: '6h'`)
- Client stores the token in `localStorage` as part of `currentUser` (see `client/src/pages/components/context/userContext.jsx`).
- For protected routes, include the header:
  - `Authorization: Bearer <token>`
- The `verifyToken` middleware (`server/middleware/authMiddleware.js`) validates the token and sets `req.user = decoded`.
  - On expiration it returns a 401 with message: `Session Expired. Please log in again`.
  - On invalid token it returns 403 or 401 depending on the error.

### Posting endpoints (server)
- Create Post (protected):
  - POST `/api/posts` (middleware: `verifyToken`)
  - Expects form-data with fields:
    - `title` (string)
    - `category` (string)
    - `description` (string, HTML from Quill)
    - `thumbnail` (file, acceptable types: png/jpg/jpeg/webp)
  - Server behavior (`server/controllers/postControllers.js`):
    - Validates presence and thumbnail size (currently up to **1GB** in code — see `thumbnailSizeBytes`).
    - Writes thumbnail into `server/uploads/` with a unique name `thumbnail-<uuid>.<ext>`.
    - Creates a Post document with `creator: req.user.id` and returns the created post.

- Edit Post (protected):
  - PATCH `/api/posts/:id` (middleware: `verifyToken`)
  - Can accept a new thumbnail; the server deletes the old thumbnail file when replacing.
  - Only the creator can edit their post (authorization check in controller).

- Delete Post (protected):
  - DELETE `/api/posts/:id` (middleware: `verifyToken`)
  - Removes the thumbnail file and the post document; decrements the creator's post count.

### Frontend integration (how Create/Edit/Fetch work)
- Create post page: `client/src/pages/CreatePost.jsx` uses a controlled form with ReactQuill for `description` and a file input for `thumbnail`.
- Example client request (Create post):
  ```js
  const form = new FormData();
  form.append('title', title);
  form.append('category', category);
  form.append('description', description);
  form.append('thumbnail', thumbnailFile);

  fetch('/api/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  })
  ```
- The client resolves thumbnail images using environment variables (see `VITE_ASSETS_URL` or `VITE_API_ASSETS_URL`) in `PostItem.jsx` and `PostDetail.jsx`:
  - If `post.thumbnail` is a full URL it is used directly; otherwise the client prepends `${assetsBase}/uploads/${thumbnail}`.

### Dashboard and protected UI
- Dashboard, Post creation, edit, and delete flows check for `currentUser?.token` and redirect to login if not present (see `client/src/pages/Dashboard.jsx`, `CreatePost.jsx`).
- Token expiry will require users to re-login; best practice is to detect 401 responses and prompt a login flow.

---

## Adding peppers — CLI & npm scripts 🧂
You can add peppers via the provided CLI script or using npm scripts.

### Script behavior
- Lines in import files are **one pepper per line** (trimmed; empty lines ignored). No quotes are needed.
- The peppers are inserted in the **order you provide**; the first provided pepper becomes index `0` (newest-first).
- By default the script **does not dedupe**; duplicates will be written as separate entries.
- When migration runs, **all users' `pepperVersion`** will be incremented by **N** (the number of peppers added) so existing indices still point to the same pepper.
- The migration step is dynamic: the script will attempt to connect to the first reachable MongoDB URI from your environment variables — it checks `MONGO_URI` (cloud) first, then `MONGO_URI_LOCAL` (local) — and will use the first successful connection to run the migration. If no DB is reachable the peppers file is still updated but the migration is skipped (the script exits with a non-zero code to indicate migration did not run).

### Available commands
- From project root:
  - Import from file: `npm run add-pepper -- --file pepper.txt`
  - Add peppers inline: `npm run add-pepper -- "pep1" "pep2"`
  - Skip DB migration (write file only): `npm run add-pepper -- --no-migrate -- "pep1"`

- From server package (inside `server/`):
  - `npm run add-pepper -- "pep1" "pep2"`
  - Import from file: `npm run add-pepper:file -- pepper.txt`
  - Skip migration: `npm run add-pepper:no-migrate -- "pep1"`
  - Show usage/help: `npm run add-pepper:help`

Note: when migration runs the script prints which environment was used to connect (cloud vs local) and the database name; if no DB is reachable the script writes the peppers file but exits with a non-zero status to indicate migration did not run.

- Direct node usage (no npm):
  - `node server/utils/addPepper.js --file path/to/list.txt`
  - `node server/utils/addPepper.js "pep1" "pep2"`

> Important: When passing args through `npm run`, include the extra `--` so npm forwards the args to the script (e.g., `npm run add-pepper -- --file pepper.txt`).

---

## File import format & rules 📄
- File format: plain text, **one pepper per line**.
- Lines are trimmed. Do **not** quote values in the file (quotes will be stored literally).
- Example file (`pepper.txt`):
```
ironFox#92{salt&pepper}
//panic_if(true)==∞
V0id$echo::NULL_Δ47
```
- CLI also accepts multiple inline peppers: `node server/utils/addPepper.js 'pep1' 'pep2'`.

---

## Verifying behavior & results ✔️
- Check peppers file: `cat server/config/peppers.json` (new peppers will appear at front).
- If you ran migration, the script prints the number of modified users. You can verify in MongoDB:
  - `db.users.findOne({ email: "user@example.com" }, { pepperVersion: 1 })`
- If you used `--no-migrate`, only the file is updated (no DB change).

---

## Security considerations ⚠️
- **Keep peppers secret.** Treat `server/config/peppers.json` like any other secret key store — avoid committing it to public repositories.
- The CLI script will still write the peppers file even if DB migration fails — this avoids data loss, but you must run migration when DB is available to keep `pepperVersion` indices consistent.

---

## Development notes & extension ideas 💡
- You can add an admin HTTP endpoint to add peppers from the running server (this allows adding peppers while the server is connected to DB and removes the need to run CLI with DB credentials).
- Consider enabling deduplication or a `--promote` option to promote an existing pepper to index `0` without causing index shifts (promotion semantics may or may not increment user `pepperVersion`).
- Add tests for pepper imports, migration delta behavior, and login rehash flow.

---

## Quick start (local dev) 🚀
1. Copy `.env` into `server/.env` and set `MONGO_URI`, `JWT_SECRET`, email credentials, etc.
2. Install dependencies: `npm install` (root) and `cd client && npm install` (client).
3. Run dev environment: `npm run dev` from root.
4. To add peppers: `npm run add-pepper -- --file pepper.txt`.

---

## License & Author
**Author:** Omoju Oluwamayowa (Nox)

This is a personal project. Contact the author for reuse or collaboration.