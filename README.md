# bettygo

A Cloudflare Workers API that verifies whether a Discord user is a member of a specific guild. Websites call this API as part of a Discord OAuth2 login flow to gate access based on guild membership.

## How it works

1. Your website calls `GET /auth/login` to get a Discord OAuth2 authorization URL
2. The user is redirected to Discord and logs in
3. Discord redirects the user back to `GET /auth/callback` with an authorization code
4. The worker exchanges the code for an access token, fetches the user's identity, then uses the bot token to check guild membership
5. The response tells your website whether the user is verified (a member of the configured guild) along with their basic Discord profile

## Stack

- **Runtime**: [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- **Framework**: [Hono](https://hono.dev/) — lightweight web framework built for edge runtimes
- **Discord**: [`@discordjs/rest`](https://github.com/discordjs/discord.js/tree/main/packages/rest) + [`discord-api-types`](https://github.com/discordjs/discord-api-types) — typed Discord REST client

## Project structure

```
src/
├── index.ts          # App entry point — mounts CORS middleware and routes
├── types.ts          # Env interface (all environment variable types)
├── routes/
│   └── auth.ts       # GET /auth/login and GET /auth/callback
└── lib/
    ├── discord.ts    # Discord REST helpers (token exchange, user fetch, guild check)
    └── state.ts      # Stateless CSRF state using HMAC-SHA256
```

## API

### `GET /health`

Liveness check.

```json
{ "ok": true }
```

---

### `GET /auth/login`

Returns the Discord OAuth2 authorization URL. Redirect the user to this URL to begin the login flow.

**Response**

```json
{
  "url": "https://discord.com/oauth2/authorize?client_id=...&scope=identify+guilds.members.read&state=..."
}
```

The `state` parameter is a tamper-proof HMAC-SHA256 token (timestamp + signature) that expires after 10 minutes. It is verified on the callback to prevent CSRF attacks without needing any storage.

---

### `GET /auth/callback?code=<code>&state=<state>`

Called automatically by Discord after the user authorizes. Verifies the state, exchanges the code for a token, and checks guild membership.

**Success response**

```json
{
  "verified": true,
  "user": {
    "id": "123456789012345678",
    "username": "zel",
    "avatar": "https://cdn.discordapp.com/avatars/123456789012345678/abc123.png"
  }
}
```

`verified` is `false` when the user authenticated successfully but is not a member of the configured guild.

**Error responses**

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{ "error": "OAuth denied", "detail": "..." }` | User cancelled the Discord login |
| 400 | `{ "error": "Missing code or state" }` | Malformed redirect from Discord |
| 400 | `{ "error": "Invalid or expired state" }` | CSRF check failed or state older than 10 min |
| 502 | `{ "error": "Failed to exchange authorization code" }` | Discord token endpoint error |
| 502 | `{ "error": "Failed to fetch Discord user" }` | Discord `/users/@me` error |
| 502 | `{ "error": "Failed to check guild membership" }` | Discord guild API error |

---

## Environment variables

Set plain vars in `wrangler.jsonc`. Set secrets with `wrangler secret put`.

| Variable | Kind | Description |
|----------|------|-------------|
| `DISCORD_CLIENT_ID` | var | OAuth2 application client ID |
| `DISCORD_CLIENT_SECRET` | secret | OAuth2 application client secret |
| `DISCORD_BOT_TOKEN` | secret | Bot token used to look up guild members |
| `DISCORD_GUILD_ID` | var | ID of the guild to verify membership against |
| `DISCORD_REDIRECT_URI` | var | Full callback URL (must match Discord app settings) |
| `HMAC_SECRET` | secret | Random string used to sign CSRF state tokens |
| `ALLOWED_ORIGIN` | var | Website origin for CORS (e.g. `https://yoursite.com`) |

## Setup

### 1. Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a new application
2. Under **OAuth2**, add your callback URL as a redirect (e.g. `https://bettygo.<your-subdomain>.workers.dev/auth/callback`)
3. Copy the **Client ID** and **Client Secret**
4. Under **Bot**, create a bot and copy the **Bot Token**
5. Invite the bot to your guild using the OAuth2 URL generator with the `bot` scope (no special permissions required — it only reads member data)

### 2. Configure the worker

Fill in the plain vars in `wrangler.jsonc`:

```jsonc
"vars": {
  "DISCORD_CLIENT_ID": "your_client_id",
  "DISCORD_GUILD_ID": "your_guild_id",
  "DISCORD_REDIRECT_URI": "https://bettygo.<subdomain>.workers.dev/auth/callback",
  "ALLOWED_ORIGIN": "https://yoursite.com"
}
```

Then set the secrets:

```bash
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put HMAC_SECRET   # any long random string
```

### 3. Scripts

```bash
npm run dev      # start local dev server at http://localhost:8787
npm run deploy   # deploy to Cloudflare Workers
npm run test     # run tests with Vitest
```

## CORS

The `ALLOWED_ORIGIN` var controls which origin can call the API. All endpoints respond to `GET` and `OPTIONS`. If `ALLOWED_ORIGIN` is empty, the worker defaults to `*` (allow all).

## Security notes

- The CSRF `state` is verified on every callback using HMAC-SHA256 with `HMAC_SECRET` — no KV or database required
- Guild membership is checked using the **bot token** server-side, so users cannot spoof membership by manipulating client-side state
- The bot token and client secret are never exposed to the browser
