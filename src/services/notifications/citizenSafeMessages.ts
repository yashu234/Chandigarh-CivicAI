import type { ComplaintStatus } from '../../types/index.ts';

export interface CitizenStatusMeta {
  label: string;
  explanation: string;
  publicSummary: string;
  badgeVariant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

/**
 * Deterministic mapping of internal workflow states to citizen-facing explanations.
 * This ensures that administrative internal reasoning, UUIDs, or notes NEVER leak to residents.
 */
export const CITIZEN_SAFE_STATUS_MAPPINGS: Record<ComplaintStatus, CitizenStatusMeta> = {
  submitted: {
    label: 'Complaint Received',
    explanation: 'Your grievance has been safely recorded by the municipal intake desk and assigned a tracking reference.',
    publicSummary: 'Registered and pending municipal evaluation.',
    badgeVariant: 'info',
  },
  under_review: {
    label: 'Under Municipal Review',
    explanation: 'The municipal inspection team is reviewing your grievance and assessing field remediation requirements.',
    publicSummary: 'Municipal desk evaluation in progress.',
    badgeVariant: 'warning',
  },
  assigned: {
    label: 'Assigned to Department',
    explanation: 'Your grievance has been dispatched to the specialized municipal department wing for field action.',
    publicSummary: 'Dispatched to relevant municipal department wing.',
    badgeVariant: 'primary',
  },
  in_progress: {
    label: 'Remediation In Progress',
    explanation: 'Field workers and engineering personnel have commenced physical remediation work at the reported site.',
    publicSummary: 'Remediation work actively underway.',
    badgeVariant: 'primary',
  },
  resolved: {
    label: 'Remediation Resolved',
    explanation: 'Municipal works at the location have been completed and verified by civic authorities.',
    publicSummary: 'Civic issue resolved and verified.',
    badgeVariant: 'success',
  },
  rejected: {
    label: 'Submission Not Accepted',
    explanation: 'This report could not be accepted under municipal civic guidelines (e.g., outside jurisdiction or non-civic matter).',
    publicSummary: 'Grievance closed as outside municipal guidelines.',
    badgeVariant: 'danger',
  },
  duplicate: {
    label: 'Duplicate Grievance Identified',
    explanation: 'This complaint refers to an active civic issue already reported in this sector. Field remediation is tracking under the primary report.',
    publicSummary: 'Identified as duplicate of an existing active civic report.',
    badgeVariant: 'default',
  },
};

/**
 * Sanitizes any administrative text to ensure NO internal notes, admin UUIDs,
 * or officer private discussions leak to citizens.
 */
export function getCitizenSafeStatusMessage(
  status: ComplaintStatus,
  departmentCode?: string | null
): string {
  if (status === 'assigned' && departmentCode) {
    return `Complaint has been assigned to the ${departmentCode.replace(/_/g, ' ').toUpperCase()} wing for field action.`;
  }
  return CITIZEN_SAFE_STATUS_MAPPINGS[status]?.explanation || 'Status updated by municipal desk.';
}

/**
 * Deterministic citizen-safe notification titles for each event.
 */
export function getCitizenSafeNotificationTitle(status: ComplaintStatus): string {
  switch (status) {
    case 'submitted':
      return 'Grievance Registered';
    case 'under_review':
      return 'Grievance Under Review';
    case 'assigned':
      return 'Grievance Dispatched to Department';
    case 'in_progress':
      return 'Remediation In Progress';
    case 'resolved':
      return 'Grievance Marked Resolved';
    case 'rejected':
      return 'Grievance Status Update';
    case 'duplicate':
      return 'Duplicate Grievance Identified';
    default:
      return 'Civic Status Update';
  }
}
