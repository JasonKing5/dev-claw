import type { AppConfig } from "../types.js";

export function isAllowed(config: AppConfig, userId: string): boolean {
  // If no whitelist configured, allow nobody
  if (config.allowedUsers.size === 0) return false;
  return config.allowedUsers.has(userId);
}
