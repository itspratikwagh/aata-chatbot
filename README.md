# AATA Salesforce Assistant

A **read-only, natural-language AI assistant for Salesforce**. Ask questions in
plain English from your iPhone (installable as a PWA) and get conversational
answers backed by **live data** from your Salesforce org.

It uses an **agentic tool-use loop**: instead of stuffing your entire schema into
the prompt, Claude is given tools and decides what to fetch — discovering objects,
learning the schema, then running read-only SOQL — until it can answer.

```
iPhone PWA (React + Vite + MUI)
        │  POST /api/chat  { message, history }
        ▼
Express backend ──► Claude (Anthropic SDK), tool-use loop
        │                       │ list_objects / describe_object
        │                       │ soql_query (SELECT-only) / sosl_search
        ▼                       ▼
   jsforce ──────────────► Salesforce org (OAuth refresh token, auto-refresh)
```

- **Backend** — `backend/` · Node.js + Express + `@anthropic-ai/sdk` + `jsforce`. Deploy on **Railway**.
- **Frontend** — `frontend/` · React + Vite + Material-UI, PWA. Deploy on **Vercel**.

---

## How the agent works

The backend runs a capped loop (default 6 iterations). Claude is given four tools
and calls them as needed; the server executes each, appends the result, and calls
Claude again until it returns a plain-text answer.

| Tool | What it does |
|------|--------------|
| `list_objects` | Lists queryable SObjects (label + API name) via `describeGlobal()`. Supports a `nameContains` filter. |
| `describe_object(objectName)` | Returns fields (name, label, type, picklist values, references) + child relationships via `conn.describe()`. |
| `soql_query(query)` | Runs a **read-only** SOQL `SELECT` via `conn.query()`. Rejects anything that isn't a plain SELECT; auto-applies a row cap. |
| `sosl_search(search)` | Fuzzy full-text `FIND` search across objects. |

**Read-only is enforced server-side** (`backend/src/tools.js`): a query must start
with `SELECT`, must be a single statement, and must contain no DML keywords
(`INSERT/UPDATE/DELETE/UPSERT/UNDELETE/MERGE/…`). Results are capped (`MAX_QUERY_ROWS`,
default 200). Prompt caching is applied to the system prompt and tool definitions
to keep loop cost down.

---

## Prerequisites

- Node.js 18+ and npm
- An Anthropic API key — <https://console.anthropic.com>
- Salesforce admin access to create a Connected App

---

## 1. Create the Salesforce Connected App

In Salesforce: **Setup → App Manager → New Connected App** (or *New Connected App*
under External Client Apps on newer orgs).

1. **Enable OAuth Settings.**
2. **Callback URL:** `http://localhost:3030/oauth/callback`
   (this matches the one-time auth helper; add your prod URL too if you ever run
   the flow elsewhere).
3. **OAuth Scopes:** add
   - *Manage user data via APIs* (`api`)
   - *Perform requests at any time* (`refresh_token, offline_access`)
4. Save. Under **Manage Consumer Details**, copy the **Consumer Key** and
   **Consumer Secret** → these are `SF_CLIENT_ID` and `SF_CLIENT_SECRET`.
5. (Recommended) The assistant is read-only by design, but for defense in depth
   run it as an **integration user with a read-only profile / permission set** so
   the OAuth grant itself can't write.

> Connected App changes can take a few minutes to propagate. If auth fails
> immediately after creating it, wait ~5–10 minutes and retry.

---

## 2. One-time auth — get your refresh token

The refresh token is obtained **once** via the OAuth web flow, then stored as an
env var. It never expires unless revoked, and `jsforce` uses it to mint
short-lived access tokens automatically.

```bash
cd backend
cp .env.example .env          # fill in ANTHROPIC_API_KEY, SF_CLIENT_ID, SF_CLIENT_SECRET, SF_LOGIN_URL
npm install
npm run sf:auth
```

This prints an authorization URL. Open it, log in, approve, and the helper prints:

```
SF_INSTANCE_URL=https://your-domain.my.salesforce.com
SF_REFRESH_TOKEN=5Aep861...
```

Paste both into `backend/.env` (and later into Railway). Use
`SF_LOGIN_URL=https://test.salesforce.com` for a sandbox.

---

## 3. Local development

**Backend** (terminal 1):

```bash
cd backend
npm run dev        # http://localhost:8080  (GET /api/health to check)
```

**Frontend** (terminal 2):

```bash
cd frontend
cp .env.example .env        # VITE_API_BASE_URL=http://localhost:8080
npm install
npm run dev                 # http://localhost:5173
```

Open <http://localhost:5173> and start asking questions.

---

## 4. Deployment

### Backend → Railway

1. New project → **Deploy from GitHub repo**, set **Root Directory** to `backend`.
2. Railway runs `npm install` then `npm start` automatically.
3. Add environment variables (from your `.env`):
   `ANTHROPIC_API_KEY`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SF_REFRESH_TOKEN`,
   `SF_INSTANCE_URL`, `SF_LOGIN_URL`, and
   `ALLOWED_ORIGINS=https://your-frontend.vercel.app`.
   (`PORT` is provided by Railway — don't hard-code it.)
4. Note the public URL, e.g. `https://your-backend.up.railway.app`.

### Frontend → Vercel

1. New project → import the repo, set **Root Directory** to `frontend`.
2. Framework preset: **Vite** (build `npm run build`, output `dist`).
3. Environment variable: `VITE_API_BASE_URL=https://your-backend.up.railway.app`.
4. Deploy. `vercel.json` already rewrites client routes to `index.html`.
5. Go back to Railway and set `ALLOWED_ORIGINS` to the Vercel URL, then redeploy.

### Add to Home Screen (iPhone)

Open the Vercel URL in **Safari** → Share → **Add to Home Screen**. The app
launches full-screen (standalone) with its own icon, thanks to the web manifest
and `apple-mobile-web-app-*` meta tags.

---

## Example questions

- "Which open opportunities close this month?"
- "List accounts with no activity in the last 90 days."
- "How many new leads came in this week, broken down by source?"
- "Show my top 5 open opportunities by amount."
- "Which cases are still open and unassigned?"

---

## Environment variables

### `backend/.env`

| Var | Required | Notes |
|-----|----------|-------|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key. |
| `ANTHROPIC_MODEL` | | Default `claude-sonnet-4-6` (fast, strong tool use). Set `claude-opus-4-7` for the most capable model. |
| `ANTHROPIC_MAX_TOKENS` | | Default 2048. |
| `SF_CLIENT_ID` | ✅ | Connected App Consumer Key. |
| `SF_CLIENT_SECRET` | ✅ | Connected App Consumer Secret. |
| `SF_REFRESH_TOKEN` | ✅ | From `npm run sf:auth`. |
| `SF_INSTANCE_URL` | ✅ | From `npm run sf:auth`, e.g. `https://x.my.salesforce.com`. |
| `SF_LOGIN_URL` | | `https://login.salesforce.com` (prod) or `https://test.salesforce.com` (sandbox). |
| `PORT` | | Default 8080; set by Railway in prod. |
| `ALLOWED_ORIGINS` | | Comma-separated CORS allow-list, or `*`. |
| `MAX_AGENT_ITERATIONS` | | Default 6. |
| `MAX_QUERY_ROWS` | | Default 200. |

### `frontend/.env`

| Var | Notes |
|-----|-------|
| `VITE_API_BASE_URL` | Backend base URL (no trailing slash). |

**Never commit `.env` files** — only the `.env.example` templates are tracked.
