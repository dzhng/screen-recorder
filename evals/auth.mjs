import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

function parseCredentials(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Credential data is not valid JSON");
  }
}
function values(object) {
  return Object.values(object).flatMap((value) =>
    typeof value === "string" && value.length >= 16
      ? [value]
      : value && typeof value === "object"
        ? values(value)
        : [],
  );
}
export function redact(value, secrets) {
  let text = JSON.stringify(value);
  for (const secret of secrets) text = text.replaceAll(secret, "[REDACTED]");
  return JSON.parse(text);
}
export async function credentials(agent) {
  if (agent === "codex") {
    if (process.env.OPENAI_API_KEY)
      return {
        files: {
          "home/.codex/auth.json": JSON.stringify({
            auth_mode: "apikey",
            OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          }),
        },
        env: {},
        secrets: [process.env.OPENAI_API_KEY],
      };
    let text;
    try {
      text = await readFile(
        join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
        "utf8",
      );
    } catch {
      throw new Error(
        "Codex credentials unavailable; sign in with codex login or supply OPENAI_API_KEY",
      );
    }
    return {
      files: { "home/.codex/auth.json": text },
      env: {},
      secrets: values(parseCredentials(text)),
    };
  }
  for (const key of ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"])
    if (process.env[key]) return { env: { [key]: process.env[key] }, secrets: [process.env[key]] };
  let text;
  try {
    text = await readFile(join(homedir(), ".claude/.credentials.json"), "utf8");
  } catch {
    if (process.platform !== "darwin")
      throw new Error(
        "Claude credentials unavailable; supply ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN",
      );
    try {
      text = execFileSync(
        "security",
        ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch {
      throw new Error(
        "Claude credentials unavailable in Keychain; sign in with claude auth login or supply a token",
      );
    }
  }
  const token = parseCredentials(text).claudeAiOauth?.accessToken;
  if (!token) throw new Error("Claude OAuth access token unavailable; no credentials were changed");
  return { env: { CLAUDE_CODE_OAUTH_TOKEN: token }, secrets: [token] };
}
