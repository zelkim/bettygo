import { Hono } from "hono";
import { isGuildMember, DiscordAPIError } from "../lib/discord";
import type { Env } from "../types";

const users = new Hono<{ Bindings: Env }>();

// GET /users/:userId/discord
// Protected — requires X-Api-Key header (enforced at app level).
// :userId must be the Discord user snowflake ID.
// Returns { verified: boolean } based on live guild membership check.
users.get("/:userId/discord", async (c) => {
  const { userId } = c.req.param();
  let verified: boolean;
  try {
    verified = await isGuildMember(userId, c.env.DISCORD_GUILD_ID, c.env.DISCORD_BOT_TOKEN);
  } catch (err) {
    if (err instanceof DiscordAPIError) {
      if (err.status === 400) return c.json({ error: "invalid_discord_id" }, 400);
      if (err.status === 401 || err.status === 403) return c.json({ error: "bot_auth_failed" }, 500);
    }
    return c.json({ error: "guild_check_failed" }, 502);
  }
  return c.json({ verified });
});

export default users;
