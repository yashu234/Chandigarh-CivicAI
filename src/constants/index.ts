import type { Department, PriorityLevel, ComplaintStatus, EvidenceSupportLevel } from '../types';

export const APP_CONFIG = {
  name: 'Chandigarh CivicAI',
  tagline: 'AI-Assisted Civic Complaint Intelligence & Transparent Prioritization',
  jurisdiction: 'Union Territory of Chandigarh',
  version: '0.1.0-foundation',
} as const;

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  CITIZEN_DASHBOARD: '/dashboard',
  REPORT_ISSUE: '/report-issue',
  MY_COMPLAINTS: '/my-complaints',
  COMPLAINT_DETAILS: (id = ':id') => `/complaints/${id}`,
  AUTH_CALLBACK: '/auth/callback',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_COMPLAINT_DETAILS: (id = ':id') => `/admin/complaints/${id}`,
} as const;

export const CHANDIGARH_DEPARTMENTS: readonly Department[] = [
  {
    id: 'dept-sanitation',
    name: 'Sanitation & Solid Waste Management',
    code: 'MCC-SWM',
    description: 'Garbage disposal, public littering, street sweeping, and dumping violations.',
  },
  {
    id: 'dept-roads',
    name: 'Roads, Pavements & Civil Works',
    code: 'MCC-ROADS',
    description: 'Potholes, broken footpaths, road caving, dividers, and storm water grates.',
  },
  {
    id: 'dept-public-health',
    name: 'Public Health & Water Supply',
    code: 'MCC-WATER',
    description: 'Water pipeline leakages, contaminated supply, drainage blockage, and sewage overflow.',
  },
  {
    id: 'dept-electricity',
    name: 'Electricity & Public Lighting',
    code: 'UT-ELEC',
    description: 'Faulty streetlights, open junction boxes, dangling power lines, and transformer hazards.',
  },
  {
    id: 'dept-horticulture',
    name: 'Horticulture & Green Belts',
    code: 'MCC-HORT',
    description: 'Fallen trees, dangerous branches over roads, park maintenance, and overgrown weeds.',
  },
  {
    id: 'dept-traffic-safety',
    name: 'Traffic Infrastructure & Enforcement Support',
    code: 'UT-TRAFFIC',
    description: 'Damaged traffic signals, missing road signage, and blind corner obstacles.',
  },
] as const;

export const CIVIC_ISSUE_CATEGORIES = [
  'Pothole / Road Hazard',
  'Water Supply / Pipeline Leak',
  'Sewage Overflow / Clogged Drain',
  'Garbage Dumping / Sanitation',
  'Non-Functional Streetlight',
  'Exposed Electrical Wire / Pole Damage',
  'Fallen Tree / Hazardous Branches',
  'Encroachment / Public Obstruction',
  'Damaged Public Property / Signage',
  'Stray Cattle / Animal Hazard',
  'Other Civic Grievance',
] as const;

export const CHANDIGARH_SECTORS = Array.from({ length: 60 }, (_, i) => `Sector ${i + 1}`);

export const STATUS_METADATA: Record<ComplaintStatus, { label: string; description: string }> = {
  submitted: { label: 'Submitted', description: 'Received in the intake pipeline' },
  under_review: { label: 'Under Review', description: 'Assessing evidence & priority breakdown' },
  assigned: { label: 'Assigned', description: 'Dispatched to responsible municipal wing' },
  in_progress: { label: 'In Progress', description: 'Field remediation actively underway' },
  resolved: { label: 'Resolved', description: 'Field work concluded and verified' },
  rejected: { label: 'Rejected', description: 'Non-actionable, invalid, or out of municipal jurisdiction' },
  duplicate: { label: 'Duplicate', description: 'Manually verified duplicate of an existing civic grievance' },
};

export const PRIORITY_METADATA: Record<PriorityLevel, { label: string; badgeVariant: 'critical' | 'high' | 'medium' | 'low' }> = {
  critical: { label: 'Critical Priority', badgeVariant: 'critical' },
  high: { label: 'High Priority', badgeVariant: 'high' },
  medium: { label: 'Medium Priority', badgeVariant: 'medium' },
  low: { label: 'Low Priority', badgeVariant: 'low' },
};

export const EVIDENCE_SUPPORT_METADATA: Record<
  EvidenceSupportLevel,
  { label: string; description: string; badgeVariant: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  strong: {
    label: 'Strong Evidence Support',
    description: 'Visual evidence clearly demonstrates the reported condition and severity.',
    badgeVariant: 'success',
  },
  moderate: {
    label: 'Moderate Evidence Support',
    description: 'Visual evidence shows partial features of the reported issue.',
    badgeVariant: 'warning',
  },
  weak: {
    label: 'Weak Evidence Support',
    description: 'Image quality or framing makes verifying the condition ambiguous.',
    badgeVariant: 'neutral',
  },
  unsupported: {
    label: 'Unsupported by Image',
    description: 'Visual evidence does not substantiate or contradicts the reported issue.',
    badgeVariant: 'danger',
  },
};
