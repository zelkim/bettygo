import { REST, DiscordAPIError } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import type {
  RESTGetAPICurrentUserResult,
  RESTGetAPIGuildMemberResult,
  RESTPostOAuth2AccessTokenResult,
} from "discord-api-types/v10";

export type DiscordUser = RESTGetAPICurrentUserResult;
export type GuildMember = RESTGetAPIGuildMemberResult;
export type TokenResponse = RESTPostOAuth2AccessTokenResult;

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const rest = new REST({ version: "10" });

  return rest.post(Routes.oauth2TokenExchange(), {
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    passThroughBody: true,
    auth: false,
  }) as Promise<TokenResponse>;
}

export async function getUser(accessToken: string): Promise<DiscordUser> {
  const rest = new REST({ version: "10", authPrefix: "Bearer" }).setToken(accessToken);
  return rest.get(Routes.user("@me")) as Promise<DiscordUser>;
}

export async function isGuildMember(
  userId: string,
  guildId: string,
  botToken: string,
): Promise<boolean> {
  const rest = new REST({ version: "10" }).setToken(botToken);

  try {
    await rest.get(Routes.guildMember(guildId, userId)) as GuildMember;
    return true;
  } catch (err: unknown) {
    if (err instanceof DiscordAPIError && err.status === 404) return false;
    throw err;
  }
}

export function buildAvatarUrl(user: DiscordUser): string | null {
  if (!user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
}
