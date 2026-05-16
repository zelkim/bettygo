import type {
  RESTGetAPICurrentUserResult,
  RESTGetAPIGuildMemberResult,
  RESTPostOAuth2AccessTokenResult,
} from "discord-api-types/v10";

const DISCORD_API = "https://discord.com/api/v10";

export type DiscordUser = RESTGetAPICurrentUserResult;
export type GuildMember = RESTGetAPIGuildMemberResult;
export type TokenResponse = RESTPostOAuth2AccessTokenResult;

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`token_exchange_failed: ${res.status}`);
  return res.json() as Promise<TokenResponse>;
}

export async function getUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`user_fetch_failed: ${res.status}`);
  return res.json() as Promise<DiscordUser>;
}

export async function isGuildMember(
  userId: string,
  guildId: string,
  botToken: string,
): Promise<boolean> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`guild_check_failed: ${res.status}`);
  return true;
}

export function buildAvatarUrl(user: DiscordUser): string | null {
  if (!user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
}
