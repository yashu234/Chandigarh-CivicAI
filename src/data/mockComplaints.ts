import type { Complaint } from '../types';

/**
 * Chandigarh CivicAI — Dedicated Mock Data Service
 * 
 * Provides realistic civic grievances across Chandigarh sectors.
 * All AI assessments and priority calculations are strictly tagged as demonstration data.
 */

// Visual SVG representations of civic evidence photographs
export const MOCK_EVIDENCE_IMAGES = {
  pothole: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
      <defs>
        <linearGradient id="roadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#334155"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <radialGradient id="holeGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="70%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#475569"/>
        </radialGradient>
      </defs>
      <rect width="800" height="500" fill="url(#roadGrad)"/>
      <path d="M 0,220 L 800,240" stroke="#facc15" stroke-width="8" stroke-dasharray="40,30" opacity="0.7"/>
      <!-- Cracked pavement texture -->
      <path d="M 180,180 L 260,240 L 320,210 L 400,280 L 520,250 L 610,310" stroke="#0f172a" stroke-width="4" fill="none" opacity="0.6"/>
      <path d="M 280,250 L 310,320 L 290,380" stroke="#0f172a" stroke-width="3" fill="none" opacity="0.5"/>
      <!-- Major Pothole Cavity -->
      <ellipse cx="420" cy="310" rx="190" ry="110" fill="url(#holeGrad)"/>
      <ellipse cx="430" cy="320" rx="140" ry="70" fill="#020617"/>
      <!-- Broken metal grate / rubble -->
      <polygon points="350,310 410,290 440,340 370,350" fill="#64748b" opacity="0.8"/>
      <line x1="360" y1="315" x2="430" y2="335" stroke="#334155" stroke-width="5"/>
      <line x1="380" y1="300" x2="400" y2="350" stroke="#334155" stroke-width="5"/>
      <!-- Water accumulation reflection -->
      <ellipse cx="440" cy="335" rx="70" ry="25" fill="#38bdf8" opacity="0.3"/>
      <!-- Measurement overlay badge -->
      <rect x="240" y="420" width="320" height="36" rx="6" fill="#0f172a" opacity="0.85"/>
      <text x="400" y="443" fill="#38bdf8" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">
        [EVIDENCE CORROBORATION: 1.2m Cavity + Grate Fracture]
      </text>
    </svg>
  `)}`,
  waterLeak: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
      <rect width="800" height="500" fill="#334155"/>
      <rect x="0" y="0" width="800" height="200" fill="#64748b"/>
      <rect x="0" y="195" width="800" height="15" fill="#cbd5e1"/>
      <!-- Ruptured pipe fountain -->
      <ellipse cx="380" cy="320" rx="280" ry="120" fill="#0284c7" opacity="0.5"/>
      <ellipse cx="380" cy="320" rx="190" ry="70" fill="#38bdf8" opacity="0.7"/>
      <path d="M 360,330 Q 380,180 390,160 Q 400,180 410,330 Z" fill="#e0f2fe" opacity="0.8"/>
      <circle cx="390" cy="180" r="16" fill="#bae6fd" opacity="0.9"/>
      <!-- Warning indicator -->
      <rect x="230" y="420" width="340" height="36" rx="6" fill="#0f172a" opacity="0.85"/>
      <text x="400" y="443" fill="#38bdf8" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">
        [EVIDENCE CORROBORATION: High Pressure Potable Main Rupture]
      </text>
    </svg>
  `)}`,
  electrical: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
      <rect width="800" height="500" fill="#1e293b"/>
      <!-- Utility pole tilted -->
      <line x1="320" y1="500" x2="380" y2="80" stroke="#78350f" stroke-width="26"/>
      <line x1="330" y1="120" x2="430" y2="135" stroke="#475569" stroke-width="12"/>
      <!-- Dangling wires -->
      <path d="M 370,125 Q 430,280 470,360 Q 510,440 520,490" stroke="#ef4444" stroke-width="5" fill="none"/>
      <path d="M 380,130 Q 410,310 440,390" stroke="#000000" stroke-width="6" fill="none"/>
      <path d="M 360,120 Q 320,290 300,420" stroke="#f59e0b" stroke-width="4" fill="none"/>
      <!-- Spark symbol -->
      <polygon points="465,340 475,360 455,360 470,380 450,365 470,365" fill="#facc15"/>
      <rect x="210" y="420" width="380" height="36" rx="6" fill="#0f172a" opacity="0.85"/>
      <text x="400" y="443" fill="#f87171" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">
        [EVIDENCE CORROBORATION: Tilted 11kV Feeder Pole & Dangling Conductor]
      </text>
    </svg>
  `)}`,
  garbage: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
      <rect width="800" height="500" fill="#475569"/>
      <rect x="0" y="320" width="800" height="180" fill="#334155"/>
      <!-- Green Municipal Dumpster overflowing -->
      <polygon points="260,200 540,200 510,380 290,380" fill="#15803d"/>
      <rect x="240" y="180" width="320" height="25" fill="#166534" rx="4"/>
      <!-- Overflowing trash heap -->
      <ellipse cx="400" cy="180" rx="140" ry="60" fill="#713f12" opacity="0.9"/>
      <polygon points="320,180 360,110 420,130 460,95 500,170" fill="#ca8a04" opacity="0.85"/>
      <ellipse cx="240" cy="380" rx="90" ry="40" fill="#a16207" opacity="0.7"/>
      <ellipse cx="560" cy="390" rx="110" ry="50" fill="#854d0e" opacity="0.7"/>
      <rect x="210" y="430" width="380" height="36" rx="6" fill="#0f172a" opacity="0.85"/>
      <text x="400" y="453" fill="#fde047" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">
        [EVIDENCE CORROBORATION: Overflowing Solid Waste Blocking Corridor]
      </text>
    </svg>
  `)}`,
  drainage: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
      <rect width="800" height="500" fill="#334155"/>
      <!-- Submerged curb & road corridor -->
      <rect x="0" y="180" width="800" height="320" fill="#0369a1" opacity="0.75"/>
      <path d="M 0,260 Q 400,290 800,260 L 800,500 L 0,500 Z" fill="#075985" opacity="0.8"/>
      <!-- Submerged grate with floating debris -->
      <ellipse cx="380" cy="360" rx="110" ry="40" fill="#1e293b" opacity="0.8"/>
      <rect x="330" y="340" width="100" height="30" fill="#0f172a" opacity="0.9"/>
      <!-- Swirl lines for blockage -->
      <path d="M 350,350 Q 380,330 410,350 Q 380,370 350,350" stroke="#bae6fd" stroke-width="3" fill="none"/>
      <rect x="220" y="430" width="360" height="36" rx="6" fill="#0f172a" opacity="0.85"/>
      <text x="400" y="453" fill="#7dd3fc" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">
        [EVIDENCE CORROBORATION: Stormwater Choked Grate & Road Impoundment]
      </text>
    </svg>
  `)}`,
  streetlight: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
      <!-- Night sky background -->
      <rect width="800" height="500" fill="#090d16"/>
      <!-- Street pole fixture with no light -->
      <line x1="400" y1="500" x2="400" y2="100" stroke="#475569" stroke-width="16"/>
      <path d="M 400,100 Q 400,60 450,60 L 520,60" stroke="#475569" stroke-width="12" fill="none"/>
      <ellipse cx="520" cy="70" rx="35" ry="15" fill="#334155"/>
      <!-- Dark crossroad below with red danger zone -->
      <ellipse cx="520" cy="380" rx="160" ry="60" fill="#1e293b" opacity="0.7"/>
      <circle cx="520" cy="70" r="10" fill="#64748b"/>
      <rect x="230" y="430" width="340" height="36" rx="6" fill="#0f172a" opacity="0.85"/>
      <text x="400" y="453" fill="#cbd5e1" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">
        [EVIDENCE CORROBORATION: Defective High-Mast Lamp at Junction]
      </text>
    </svg>
  `)}`,
  fallenTree: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
      <rect width="800" height="500" fill="#334155"/>
      <rect x="0" y="160" width="800" height="340" fill="#1e293b"/>
      <!-- Cycle track green lane -->
      <rect x="0" y="240" width="800" height="120" fill="#065f46" opacity="0.6"/>
      <!-- Fallen trunk across carriageway -->
      <polygon points="120,380 680,210 690,240 130,420" fill="#5c3a21"/>
      <polygon points="420,290 530,160 560,180 440,300" fill="#452613"/>
      <!-- Green foliage obstruction -->
      <circle cx="550" cy="180" r="70" fill="#166534" opacity="0.85"/>
      <circle cx="620" cy="220" r="80" fill="#14532d" opacity="0.9"/>
      <circle cx="360" cy="330" r="50" fill="#15803d" opacity="0.8"/>
      <rect x="210" y="430" width="380" height="36" rx="6" fill="#0f172a" opacity="0.85"/>
      <text x="400" y="453" fill="#86efac" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">
        [EVIDENCE CORROBORATION: Fallen Bough Blocking Non-Motorized Transport Lane]
      </text>
    </svg>
  `)}`
};

export const MOCK_COMPLAINTS: Complaint[] = [
  {
    id: 'CHD-2026-00124',
    trackingNumber: 'CHD-2026-00124',
    citizenId: 'usr-chd-4091',
    citizenName: 'Jaswinder S. Ahluwalia',
    title: 'Severe road cavity and collapsed storm drainage grate',
    description: 'Deep cavity formed directly adjacent to the storm drainage grate on the Plaza fountain crossroad. The metal rim has collapsed downwards by 6 inches. Two-wheelers have skidded here during rainfall, and night pedestrians risk serious falls.',
    category: 'Pothole / Road Hazard',
    location: {
      sector: 'Sector 17',
      address: 'Between Bank Square and Plaza Fountain Corridor',
      landmark: 'Opposite State Bank Plaza entrance',
      coordinates: { latitude: 30.7415, longitude: 76.7865 },
    },
    imageUrl: MOCK_EVIDENCE_IMAGES.pothole,
    createdAt: '2026-10-12T09:42:00Z',
    updatedAt: '2026-10-13T11:20:00Z',
    status: 'under_review',
    assignedDepartmentId: 'dept-roads',
    assignedOfficerName: 'Er. R. Sharma (Executive Engineer, MCC-ROADS)',
    aiAssessment: {
      detectedIssue: 'Severe Road Surface Cavity & Damaged Storm Water Ingress Frame',
      severity: 'critical',
      safetyRisk: 'severe',
      evidenceSupport: 'strong',
      evidenceSupportNotes: 'Clear photographic evidence shows ~1.2m diameter road cave-in and sharp metal structural failure on high-volume corridor.',
      imageQuality: 'high',
      descriptionImageConsistency: 'consistent',
      publicImpact: 'widespread',
      summaryReasoning: 'Demonstration AI triage: High commuter traffic corridor with structural road collapse. Skidding risk for two-wheelers and tripping hazard for pedestrians.',
      assessedAt: '2026-10-12T09:43:12Z',
    },
    priorityCalculation: {
      baseSeverityScore: 92,
      safetyRiskScore: 95,
      publicImpactScore: 88,
      evidenceSupportWeight: 0.96,
      finalScore: 91.8,
      priorityLevel: 'critical',
      explanation: 'Formula: (0.35 * Severity [92] + 0.35 * Safety [95] + 0.15 * Impact [88]) * Evidence Weight [0.96] + Recency Bonus [4.0] = 91.8 / 100.',
    },
    adminNotes: 'Assigned to Sub-Division 2 inspection crew. Barricading requested immediately.',
    hasDuplicateAdvisory: true,
    duplicateCandidateCount: 1,
    statusHistory: [
      { status: 'submitted', timestamp: '2026-10-12T09:42:00Z', actor: 'Citizen Portal', notes: 'Intake received with 1 photographic evidence file.' },
      { status: 'under_review', timestamp: '2026-10-12T09:43:12Z', actor: 'CivicAI Engine', notes: 'Deterministic triage scored at 91.8 (Critical). Triage alert dispatched to Control Room.' },
    ],
  },
  {
    id: 'CHD-2026-00128',
    trackingNumber: 'CHD-2026-00128',
    citizenId: 'usr-chd-4099',
    citizenName: 'Manmohan Singh',
    title: 'Collapsed drainage frame and dangerous road cavity',
    description: 'Deep road cavity next to collapsed storm drainage grate in Sector 17 plaza near bank square. Skidding hazard for two-wheelers during evening traffic.',
    category: 'Pothole / Road Hazard',
    location: {
      sector: 'Sector 17',
      address: 'Near Plaza Fountain and Bank Square passage',
      landmark: 'Near Bank Square SBI corridor',
      coordinates: { latitude: 30.7417, longitude: 76.7868 },
    },
    imageUrl: MOCK_EVIDENCE_IMAGES.pothole,
    createdAt: '2026-10-12T12:15:00Z',
    updatedAt: '2026-10-12T12:15:00Z',
    status: 'under_review',
    assignedDepartmentId: 'dept-roads',
    hasDuplicateAdvisory: true,
    duplicateCandidateCount: 1,
    aiAssessment: {
      detectedIssue: 'Severe Road Surface Cavity & Damaged Storm Water Ingress Frame',
      severity: 'critical',
      safetyRisk: 'severe',
      evidenceSupport: 'strong',
      evidenceSupportNotes: 'Image corroborates road cavity next to damaged drainage grate in Sector 17.',
      imageQuality: 'high',
      descriptionImageConsistency: 'consistent',
      publicImpact: 'widespread',
      summaryReasoning: 'Corroborates high pedestrian skidding hazard in commercial bank square plaza.',
      assessedAt: '2026-10-12T12:16:00Z',
    },
    priorityCalculation: {
      baseSeverityScore: 90,
      safetyRiskScore: 92,
      publicImpactScore: 85,
      evidenceSupportWeight: 0.95,
      finalScore: 89.5,
      priorityLevel: 'critical',
      explanation: 'Formula: (0.35 * Severity + 0.35 * Safety + 0.15 * Impact) * Evidence Weight = 89.5.',
    },
    statusHistory: [
      { status: 'submitted', timestamp: '2026-10-12T12:15:00Z', actor: 'Citizen Portal', notes: 'Intake received.' },
      { status: 'under_review', timestamp: '2026-10-12T12:16:00Z', actor: 'CivicAI Engine', notes: 'Priority calculated at 89.5 (Critical).' },
    ],
  },
  {
    id: 'CHD-2026-00142',
    trackingNumber: 'CHD-2026-00142',
    citizenId: 'usr-chd-8120',
    citizenName: 'Simran Kaur',
    title: 'Exposed live electrical cables dangling from tilted utility pole',
    description: 'Heavy vehicular hit caused an electrical utility pole to tilt at a 15-degree angle. Insulated secondary bundle is torn and dangling less than 2 meters from the pedestrian pathway right outside the residential park.',
    category: 'Exposed Electrical Wire / Pole Damage',
    location: {
      sector: 'Sector 22-B',
      address: 'Between House #1024 and Sector 22 Community Centre Road',
      landmark: 'Adjoining Sector 22 Children Park Gate 2',
      coordinates: { latitude: 30.7380, longitude: 76.7725 },
    },
    imageUrl: MOCK_EVIDENCE_IMAGES.electrical,
    createdAt: '2026-10-13T06:15:00Z',
    updatedAt: '2026-10-13T07:30:00Z',
    status: 'in_progress',
    assignedDepartmentId: 'dept-electricity',
    assignedOfficerName: 'Er. Sandeep Verma (Sub-Divisional Officer, UT-ELEC)',
    aiAssessment: {
      detectedIssue: 'Exposed Electrical Conductor Hazard on Mechanically Tilted Pole',
      severity: 'critical',
      safetyRisk: 'severe',
      evidenceSupport: 'strong',
      evidenceSupportNotes: 'Photograph substantiates severe pole displacement and exposed conductor wires at pedestrian height.',
      imageQuality: 'high',
      descriptionImageConsistency: 'consistent',
      publicImpact: 'widespread',
      summaryReasoning: 'Demonstration AI triage: Critical electrocution hazard near residential park. High foot-fall zone during morning/evening hours.',
      assessedAt: '2026-10-13T06:16:30Z',
    },
    priorityCalculation: {
      baseSeverityScore: 98,
      safetyRiskScore: 98,
      publicImpactScore: 92,
      evidenceSupportWeight: 0.98,
      finalScore: 96.4,
      priorityLevel: 'critical',
      explanation: 'Formula: (0.35 * Severity [98] + 0.35 * Safety [98] + 0.15 * Impact [92]) * Evidence Weight [0.98] + Recency Bonus [5.0] = 96.4 / 100.',
    },
    adminNotes: 'Field Lineman Unit 4 on site. Feeder section temporarily de-energized for pole re-alignment.',
    statusHistory: [
      { status: 'submitted', timestamp: '2026-10-13T06:15:00Z', actor: 'Citizen Portal', notes: 'Emergency hazard intake recorded.' },
      { status: 'under_review', timestamp: '2026-10-13T06:16:30Z', actor: 'CivicAI Engine', notes: 'Highest urgency flagged. Priority score: 96.4.' },
      { status: 'assigned', timestamp: '2026-10-13T06:30:00Z', actor: 'Central Dispatch Duty Officer', notes: 'Routed to UT Electricity Division 2.' },
      { status: 'in_progress', timestamp: '2026-10-13T07:10:00Z', actor: 'Er. Sandeep Verma', notes: 'Repair crew deployed on site with hydraulic lifter.' },
    ],
  },
  {
    id: 'CHD-2026-00089',
    trackingNumber: 'CHD-2026-00089',
    citizenId: 'usr-chd-3209',
    citizenName: 'Gurpreet Singh Gill',
    title: 'Main pipeline joint rupture gushing potable water across carriageway',
    description: 'Underground 300mm water distribution line has ruptured near the shopping arcade. Clean potable water is gushing across two lanes of traffic and flooding the parking corridor.',
    category: 'Water Supply / Pipeline Leak',
    location: {
      sector: 'Sector 35-C',
      address: 'SCO 142-144 Inner Service Lane',
      landmark: 'Front of Main Market Plaza parking entrance',
      coordinates: { latitude: 30.7258, longitude: 76.7642 },
    },
    imageUrl: MOCK_EVIDENCE_IMAGES.waterLeak,
    createdAt: '2026-10-12T14:30:00Z',
    updatedAt: '2026-10-13T08:00:00Z',
    status: 'assigned',
    assignedDepartmentId: 'dept-public-health',
    assignedOfficerName: 'Er. Harpreet Dhillon (MCC-WATER)',
    aiAssessment: {
      detectedIssue: 'Pressurized Potable Water Main Leakage & Road Inundation',
      severity: 'high',
      safetyRisk: 'moderate',
      evidenceSupport: 'strong',
      evidenceSupportNotes: 'Image demonstrates substantial water pressure fountain rising ~0.5m above asphalt with widespread pooling.',
      imageQuality: 'high',
      descriptionImageConsistency: 'consistent',
      publicImpact: 'neighborhood',
      summaryReasoning: 'Demonstration AI triage: Massive potable water loss and road base erosion danger. Commercial shopping area access impacted.',
      assessedAt: '2026-10-12T14:31:45Z',
    },
    priorityCalculation: {
      baseSeverityScore: 84,
      safetyRiskScore: 78,
      publicImpactScore: 85,
      evidenceSupportWeight: 0.94,
      finalScore: 83.2,
      priorityLevel: 'high',
      explanation: 'Formula: (0.35 * Severity [84] + 0.35 * Safety [78] + 0.15 * Impact [85]) * Evidence Weight [0.94] + Recency Bonus [2.0] = 83.2 / 100.',
    },
    adminNotes: 'Valve isolation team notified. Excavation permit approved for emergency repair.',
    statusHistory: [
      { status: 'submitted', timestamp: '2026-10-12T14:30:00Z', actor: 'Citizen Portal', notes: 'Intake verified.' },
      { status: 'under_review', timestamp: '2026-10-12T14:31:45Z', actor: 'CivicAI Engine', notes: 'Assessed at 83.2 priority.' },
      { status: 'assigned', timestamp: '2026-10-12T16:00:00Z', actor: 'Municipal Control', notes: 'Dispatched to Public Health Water Wing.' },
    ],
  },
  {
    id: 'CHD-2026-00077',
    trackingNumber: 'CHD-2026-00077',
    citizenId: 'usr-chd-4091',
    citizenName: 'Jaswinder S. Ahluwalia',
    title: 'Commercial dumpster overflow blocking sidewalk and stormwater inlet',
    description: 'Bulk municipal bin has not been lifted for 4 days. Commercial packaging and organic waste is spilling 15 feet across the public pedestrian sidewalk and choking the corner stormwater drain inlet.',
    category: 'Garbage Dumping / Sanitation',
    location: {
      sector: 'Sector 19-C',
      address: 'Behind Sadar Bazaar Grocery Row, Street 4',
      landmark: 'Near Community Dispensary Back Gate',
      coordinates: { latitude: 30.7305, longitude: 76.7912 },
    },
    imageUrl: MOCK_EVIDENCE_IMAGES.garbage,
    createdAt: '2026-10-11T16:45:00Z',
    updatedAt: '2026-10-12T10:15:00Z',
    status: 'under_review',
    assignedDepartmentId: 'dept-sanitation',
    assignedOfficerName: 'Dr. V. K. Aggarwal (Medical Officer of Health, MCC-SWM)',
    aiAssessment: {
      detectedIssue: 'Solid Waste Over-Accumulation & Storm Drain Obstruction',
      severity: 'high',
      safetyRisk: 'moderate',
      evidenceSupport: 'strong',
      evidenceSupportNotes: 'Image confirms completely overflowing municipal compactor container and ground spillage obstructing pathway.',
      imageQuality: 'high',
      descriptionImageConsistency: 'consistent',
      publicImpact: 'neighborhood',
      summaryReasoning: 'Demonstration AI triage: Sanitation and vector breeding hazard in proximity to dispensary. Pedestrian forced onto vehicle lane.',
      assessedAt: '2026-10-11T16:47:00Z',
    },
    priorityCalculation: {
      baseSeverityScore: 78,
      safetyRiskScore: 72,
      publicImpactScore: 80,
      evidenceSupportWeight: 0.95,
      finalScore: 77.5,
      priorityLevel: 'high',
      explanation: 'Formula: (0.35 * Severity [78] + 0.35 * Safety [72] + 0.15 * Impact [80]) * Evidence Weight [0.95] + Recency Bonus [3.0] = 77.5 / 100.',
    },
    adminNotes: 'Added to Evening Special Lifting Route by SWM Concessionaire.',
    statusHistory: [
      { status: 'submitted', timestamp: '2026-10-11T16:45:00Z', actor: 'Citizen Portal', notes: 'Grievance registered.' },
      { status: 'under_review', timestamp: '2026-10-11T16:47:00Z', actor: 'CivicAI Engine', notes: 'Priority calculated at 77.5.' },
    ],
  },
  {
    id: 'CHD-2026-00156',
    trackingNumber: 'CHD-2026-00156',
    citizenId: 'usr-chd-9041',
    citizenName: 'Anita Sharma',
    title: 'Clogged stormwater inlet causing 1-foot waterlogging on roundabout',
    description: 'During yesterday light rain, the stormwater inlet on the roundabout remained completely choked with dry silt and plastic debris. Water accumulated up to 1 foot, stalling small cars.',
    category: 'Sewage Overflow / Clogged Drain',
    location: {
      sector: 'Sector 8-C',
      address: 'Roundabout connecting Sector 8 and Sector 9 (Jan Marg junction)',
      landmark: 'Near Sector 8 Market petrol station',
      coordinates: { latitude: 30.7480, longitude: 76.7950 },
    },
    imageUrl: MOCK_EVIDENCE_IMAGES.drainage,
    createdAt: '2026-10-13T08:10:00Z',
    updatedAt: '2026-10-13T08:15:00Z',
    status: 'submitted',
    assignedDepartmentId: 'dept-public-health',
    aiAssessment: {
      detectedIssue: 'Storm Drain Inlet Silt Choking & Surface Water Retention',
      severity: 'moderate',
      safetyRisk: 'moderate',
      evidenceSupport: 'moderate',
      evidenceSupportNotes: 'Image displays pooled surface water around stormwater curb opening; silt accumulation partially visible under water surface.',
      imageQuality: 'adequate',
      descriptionImageConsistency: 'consistent',
      publicImpact: 'localized',
      summaryReasoning: 'Demonstration AI triage: Roundabout traffic disruption and hydroplaning risk during precipitation.',
      assessedAt: '2026-10-13T08:12:00Z',
    },
    priorityCalculation: {
      baseSeverityScore: 65,
      safetyRiskScore: 60,
      publicImpactScore: 68,
      evidenceSupportWeight: 0.88,
      finalScore: 62.4,
      priorityLevel: 'medium',
      explanation: 'Formula: (0.35 * Severity [65] + 0.35 * Safety [60] + 0.15 * Impact [68]) * Evidence Weight [0.88] + Recency Bonus [4.0] = 62.4 / 100.',
    },
    adminNotes: 'Super-sucker de-silting machine scheduled for Sector 8 roundabouts.',
    statusHistory: [
      { status: 'submitted', timestamp: '2026-10-13T08:10:00Z', actor: 'Citizen Portal', notes: 'Grievance submitted by resident.' },
    ],
  },
  {
    id: 'CHD-2026-00031',
    trackingNumber: 'CHD-2026-00031',
    citizenId: 'usr-chd-4091',
    citizenName: 'Jaswinder S. Ahluwalia',
    title: 'Non-functional high-mast streetlight cluster creating dark blindspot',
    description: 'Three high-mast lamps at the busy entrance of the inter-sector link road have been completely dark for over 10 days. The blindspot makes crossing perilous for senior citizens.',
    category: 'Non-Functional Streetlight',
    location: {
      sector: 'Sector 43-B',
      address: 'Opposite ISBT Terminal South Service Lane',
      landmark: 'Near District Court Complex Exit Gate',
      coordinates: { latitude: 30.7180, longitude: 76.7450 },
    },
    imageUrl: MOCK_EVIDENCE_IMAGES.streetlight,
    createdAt: '2026-10-08T20:10:00Z',
    updatedAt: '2026-10-11T14:00:00Z',
    status: 'resolved',
    assignedDepartmentId: 'dept-electricity',
    assignedOfficerName: 'Er. Rajesh Bansal (UT-ELEC)',
    aiAssessment: {
      detectedIssue: 'Luminance Failure in High-Mast Public Lighting Corridor',
      severity: 'moderate',
      safetyRisk: 'moderate',
      evidenceSupport: 'strong',
      evidenceSupportNotes: 'Night photo corroborates that all luminaire fixtures are dark while adjacent commercial signage is powered.',
      imageQuality: 'adequate',
      descriptionImageConsistency: 'consistent',
      publicImpact: 'neighborhood',
      summaryReasoning: 'Demonstration AI triage: Pedestrian vulnerability around interstate transit hub during night hours.',
      assessedAt: '2026-10-08T20:12:00Z',
    },
    priorityCalculation: {
      baseSeverityScore: 58,
      safetyRiskScore: 62,
      publicImpactScore: 60,
      evidenceSupportWeight: 0.92,
      finalScore: 57.8,
      priorityLevel: 'medium',
      explanation: 'Formula: (0.35 * Severity [58] + 0.35 * Safety [62] + 0.15 * Impact [60]) * Evidence Weight [0.92] = 57.8 / 100.',
    },
    adminNotes: 'Control gear capacitor replaced on high-mast pole #14. Luminaires tested and verified operational.',
    statusHistory: [
      { status: 'submitted', timestamp: '2026-10-08T20:10:00Z', actor: 'Citizen Portal', notes: 'Intake received.' },
      { status: 'under_review', timestamp: '2026-10-08T20:12:00Z', actor: 'CivicAI Engine', notes: 'Scored at 57.8.' },
      { status: 'assigned', timestamp: '2026-10-09T09:00:00Z', actor: 'UT Electricity', notes: 'Work order #EL-4091 issued.' },
      { status: 'in_progress', timestamp: '2026-10-10T11:00:00Z', actor: 'Lineman Crew 3', notes: 'Replacement ballast installed.' },
      { status: 'resolved', timestamp: '2026-10-11T14:00:00Z', actor: 'Er. Rajesh Bansal', notes: 'Field verification confirmed complete.' },
    ],
  },
  {
    id: 'CHD-2026-00015',
    trackingNumber: 'CHD-2026-00015',
    citizenId: 'usr-chd-1980',
    citizenName: 'Manpreet Sandhu',
    title: 'Heavy eucalyptus bough fractured and blocking bicycle track',
    description: 'Storm winds partially snapped a 10-inch branch which is hanging horizontally across the dedicated green bicycle track on Madhya Marg.',
    category: 'Fallen Tree / Hazardous Branches',
    location: {
      sector: 'Sector 26',
      address: 'Madhya Marg non-motorized transport corridor',
      landmark: 'Opposite Grain Market Sector 26 Gate 1',
      coordinates: { latitude: 30.7240, longitude: 76.8120 },
    },
    imageUrl: MOCK_EVIDENCE_IMAGES.fallenTree,
    createdAt: '2026-10-05T11:20:00Z',
    updatedAt: '2026-10-06T15:30:00Z',
    status: 'resolved',
    assignedDepartmentId: 'dept-horticulture',
    assignedOfficerName: 'Er. K. P. Singh (MCC-HORT)',
    aiAssessment: {
      detectedIssue: 'Fallen Tree Limb Obstructing Non-Motorized Transport Lane',
      severity: 'low',
      safetyRisk: 'low',
      evidenceSupport: 'strong',
      evidenceSupportNotes: 'Image clearly shows branch resting across green asphalt cycle track.',
      imageQuality: 'high',
      descriptionImageConsistency: 'consistent',
      publicImpact: 'localized',
      summaryReasoning: 'Demonstration AI triage: Non-motorized transport obstruction without carriageway blockage.',
      assessedAt: '2026-10-05T11:22:00Z',
    },
    priorityCalculation: {
      baseSeverityScore: 42,
      safetyRiskScore: 38,
      publicImpactScore: 45,
      evidenceSupportWeight: 0.95,
      finalScore: 41.5,
      priorityLevel: 'low',
      explanation: 'Formula: (0.35 * Severity [42] + 0.35 * Safety [38] + 0.15 * Impact [45]) * Evidence Weight [0.95] = 41.5 / 100.',
    },
    adminNotes: 'Horticulture pruning squad removed fallen timber. Path cleared and swept.',
    statusHistory: [
      { status: 'submitted', timestamp: '2026-10-05T11:20:00Z', actor: 'Citizen Portal', notes: 'Intake logged.' },
      { status: 'assigned', timestamp: '2026-10-05T13:00:00Z', actor: 'MCC Horticulture', notes: 'Dispatched to East Pruning Unit.' },
      { status: 'resolved', timestamp: '2026-10-06T15:30:00Z', actor: 'Er. K. P. Singh', notes: 'Track cleared.' },
    ],
  },
];

/**
 * Accessor functions for mock service
 */
export const getMockComplaints = (): Complaint[] => {
  return [...MOCK_COMPLAINTS];
};

export const getMockComplaintById = (id: string): Complaint | undefined => {
  return MOCK_COMPLAINTS.find((c) => c.id.toLowerCase() === id.toLowerCase());
};

export const getCitizenMockComplaints = (citizenId = 'usr-chd-4091'): Complaint[] => {
  return MOCK_COMPLAINTS.filter((c) => c.citizenId === citizenId);
};

export const getAdminMetrics = () => {
  const total = MOCK_COMPLAINTS.length;
  const critical = MOCK_COMPLAINTS.filter((c) => c.priorityCalculation?.priorityLevel === 'critical').length;
  const high = MOCK_COMPLAINTS.filter((c) => c.priorityCalculation?.priorityLevel === 'high').length;
  const underReview = MOCK_COMPLAINTS.filter((c) => c.status === 'under_review' || c.status === 'submitted').length;
  const inProgress = MOCK_COMPLAINTS.filter((c) => c.status === 'in_progress' || c.status === 'assigned').length;
  const resolved = MOCK_COMPLAINTS.filter((c) => c.status === 'resolved').length;

  return {
    total,
    critical,
    high,
    underReview,
    inProgress,
    resolved,
  };
};
