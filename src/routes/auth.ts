import { Hono } from "hono";
import { generateState, verifyState } from "../lib/state";
import {
  buildAvatarUrl,
  exchangeCode,
  getUser,
  isGuildMember,
} from "../lib/discord";
import type { Env } from "../types";

const auth = new Hono<{ Bindings: Env }>();

// GET /auth/login — returns the Discord OAuth2 authorization URL
auth.get("/login", async (c) => {
  const state = await generateState(c.env.HMAC_SECRET);
  const params = new URLSearchParams({
    client_id: c.env.DISCORD_CLIENT_ID,
    redirect_uri: c.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds.members.read",
    state,
  });

  return c.json({ url: `https://discord.com/oauth2/authorize?${params}` });
});

// GET /auth/callback — handles OAuth2 redirect from Discord
auth.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.json({ error: "OAuth denied", detail: error }, 400);
  }

  if (!code || !state) {
    return c.json({ error: "Missing code or state" }, 400);
  }

  const stateValid = await verifyState(state, c.env.HMAC_SECRET);
  if (!stateValid) {
    return c.json({ error: "Invalid or expired state" }, 400);
  }

  let accessToken: string;
  try {
    const token = await exchangeCode(
      code,
      c.env.DISCORD_CLIENT_ID,
      c.env.DISCORD_CLIENT_SECRET,
      c.env.DISCORD_REDIRECT_URI,
    );
    accessToken = token.access_token;
  } catch (err) {
    return c.json({ error: "Failed to exchange authorization code" }, 502);
  }

  let user: Awaited<ReturnType<typeof getUser>>;
  try {
    user = await getUser(accessToken);
  } catch {
    return c.json({ error: "Failed to fetch Discord user" }, 502);
  }

  let verified: boolean;
  try {
    verified = await isGuildMember(
      user.id,
      c.env.DISCORD_GUILD_ID,
      c.env.DISCORD_BOT_TOKEN,
    );
  } catch {
    return c.json({ error: "Failed to check guild membership" }, 502);
  }

  return c.json({
    verified,
    user: {
      id: user.id,
      username: user.username,
      avatar: buildAvatarUrl(user),
    },
  });
});

export default auth;
