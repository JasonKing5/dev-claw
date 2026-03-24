import { randomUUID } from "node:crypto";
import type { ApprovalRequest, ApprovalRules } from "../types.js";

/** Pending approval requests, keyed by approval ID */
const pending = new Map<string, ApprovalRequest>();

/** Timeout for approval requests (5 minutes) */
const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

type SendCardFn = (chatId: string, approvalId: string, toolName: string, toolInput: Record<string, unknown>) => Promise<void>;

/**
 * Check if a tool requires human approval based on configured rules.
 */
export function isHighRisk(toolName: string, rules: ApprovalRules): boolean {
  const matches = rules.patterns.some((pattern) => globMatch(pattern, toolName));

  if (rules.mode === "blacklist") {
    // Blacklist: matched patterns need approval
    return matches;
  }
  // Whitelist: only matched patterns are auto-approved, everything else needs approval
  return !matches;
}

/**
 * Request approval from the user via IM card. Returns a Promise that resolves
 * when the user clicks approve/reject, or rejects on timeout.
 */
export function requestApproval(
  userId: string,
  chatId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  sendCard: SendCardFn,
): Promise<boolean> {
  const id = randomUUID().slice(0, 8);

  return new Promise<boolean>((resolve) => {
    const request: ApprovalRequest = { id, userId, chatId, toolName, toolInput, resolve };
    pending.set(id, request);

    // Timeout: auto-reject after 5 minutes
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve(false);
      }
    }, APPROVAL_TIMEOUT_MS);

    // Wrap resolve to clear timeout
    request.resolve = (approved: boolean) => {
      clearTimeout(timer);
      pending.delete(id);
      resolve(approved);
    };

    sendCard(chatId, id, toolName, toolInput).catch((err) => {
      console.error(`[Approval] Failed to send card for ${id}:`, err);
      clearTimeout(timer);
      pending.delete(id);
      resolve(false);
    });
  });
}

/**
 * Resolve a pending approval request (called from gateway callback handlers).
 */
export function resolveApproval(approvalId: string, approved: boolean): boolean {
  const request = pending.get(approvalId);
  if (!request) return false;
  request.resolve(approved);
  return true;
}

/** Simple glob matching: * matches any sequence of characters */
function globMatch(pattern: string, text: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
    "i",
  );
  return regex.test(text);
}
