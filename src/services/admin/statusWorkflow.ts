/**
 * Chandigarh CivicAI — Centralized Complaint Status State Machine
 * 
 * CORE ARCHITECTURAL PRINCIPLES:
 * 1. Deterministic Lifecycle: Enforces ordered municipal progression from intake
 *    to resolution without arbitrary skipping of review stages.
 * 2. Human-in-the-Loop Governance: Transitions are executed strictly by authorized
 *    municipal administrators. Citizens have zero status mutation privileges.
 * 3. Accountability: Material actions (rejection, duplicate marking, resolution)
 *    mandate a justified explanation note recorded in the immutable audit log.
 */

import type { ComplaintStatus } from '../../types/index.ts';

/**
 * Valid municipal transitions map.
 * Defines allowable target statuses from each current state.
 */
export const VALID_STATUS_TRANSITIONS: Record<ComplaintStatus, readonly ComplaintStatus[]> = {
  submitted: ['under_review'],
  under_review: ['assigned', 'rejected', 'duplicate'],
  assigned: ['in_progress', 'under_review'], // Can begin work or return to triage if wing reassignment needed
  in_progress: ['resolved', 'under_review'], // Can resolve work or return to triage if blocked
  resolved: [], // Terminal municipal state (requires formal appeal/reopening workflow)
  rejected: [], // Terminal administrative exception state
  duplicate: [], // Terminal administrative duplicate state
} as const;

/**
 * Transitions that require a mandatory, non-empty explanation note.
 */
export const STATUSES_REQUIRING_REASON: readonly ComplaintStatus[] = [
  'rejected',
  'duplicate',
  'resolved',
] as const;

/**
 * Checks whether a given status transition is structurally valid.
 */
export function isValidStatusTransition(
  from: ComplaintStatus,
  to: ComplaintStatus
): boolean {
  if (from === to) return false;
  const allowed = VALID_STATUS_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

/**
 * Returns the list of valid target statuses from a given current status.
 */
export function getAllowedTransitions(
  currentStatus: ComplaintStatus
): readonly ComplaintStatus[] {
  return VALID_STATUS_TRANSITIONS[currentStatus] ?? [];
}

/**
 * Checks whether transitioning to the target status mandates an explanatory note.
 */
export function requiresTransitionReason(targetStatus: ComplaintStatus): boolean {
  return STATUSES_REQUIRING_REASON.includes(targetStatus);
}

export class StatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatusTransitionError';
  }
}

/**
 * Validates a proposed status transition and mandatory reason.
 * Throws StatusTransitionError if the transition is prohibited or missing a reason.
 */
export function validateStatusTransition(
  from: ComplaintStatus,
  to: ComplaintStatus,
  note?: string | null
): void {
  if (!isValidStatusTransition(from, to)) {
    throw new StatusTransitionError(
      `Invalid status transition from "${from}" to "${to}". Allowed targets from "${from}": [${
        getAllowedTransitions(from).join(', ') || 'none (terminal state)'
      }].`
    );
  }

  if (requiresTransitionReason(to)) {
    const trimmed = note?.trim();
    if (!trimmed || trimmed.length < 5) {
      throw new StatusTransitionError(
        `Transition to "${to}" requires a mandatory explanation note (minimum 5 characters).`
      );
    }
  }
}
