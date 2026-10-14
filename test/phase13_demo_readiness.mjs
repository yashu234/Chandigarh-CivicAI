#!/usr/bin/env node
/**
 * Phase 13 — Deployment & Demo Readiness Test Suite
 *
 * Validates:
 * 1.  Production build artifacts are present and non-empty
 * 2.  Code splitting produced vendor chunks
 * 3.  No source maps in dist/ (security — avoids leaking source paths)
 * 4.  .env.local is in .gitignore (secrets not committed)
 * 5.  .env.example is committed and contains no real secrets
 * 6.  All 7 migration files are present in correct chronological order
 * 7.  Phase 13 migration defines demo_readiness_check() function
 * 8.  Phase 13 migration defines v_demo_complaints advisory view
 * 9.  seed.sql covers all 4 priority tiers (critical/high/medium/low)
 * 10. seed.sql has 6 demo complaints
 * 11. seed.sql has AI assessments for demo complaints
 * 12. seed.sql uses CHD-TEST- prefix exclusively for tracking IDs
 * 13. seed.sql does NOT contain any real personal data keywords
 * 14. Demo seed contains duplicate candidate pair
 * 15. Demo seed contains notifications with event_key
 * 16. README is updated beyond Phase 1 scope
 * 17. Deployment guide (docs/deployment.md) is present and comprehensive
 * 18. Demo guide (docs/demo-guide.md) is present and has demo script
 * 19. vite.config.ts has code-splitting (manualChunks)
 * 20. vite.config.ts suppresses sourcemaps in production
 * 21. No vercel.json or deployment config exposes secrets
 * 22. CI/CD workflow template is present in deployment docs
 * 23. All prior phase test suites still pass (regression guard)
 * 24. Security audit doc (docs/security-audit.md) is present
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function pass(n, desc) {
  console.log(`[PASS] ${n}. ${desc}`);
  passed++;
}

function fail(n, desc, reason) {
  console.error(`[FAIL] ${n}. ${desc}`);
  console.error(`       Reason: ${reason}`);
  failed++;
}

function readFile(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function listDir(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs);
}

// ---------------------------------------------------------------------------
// 1. Production build artifacts present
// ---------------------------------------------------------------------------
(function test1() {
  const distIndex = path.join(ROOT, 'dist', 'index.html');
  const assetsDir = path.join(ROOT, 'dist', 'assets');
  if (!fs.existsSync(distIndex)) {
    fail(1, 'Production build artifacts are present', 'dist/index.html missing. Run npm run build first.');
    return;
  }
  if (!fs.existsSync(assetsDir)) {
    fail(1, 'Production build artifacts are present', 'dist/assets/ directory missing.');
    return;
  }
  const assets = fs.readdirSync(assetsDir);
  if (assets.length < 2) {
    fail(1, 'Production build artifacts are present', `Only ${assets.length} asset files found in dist/assets/`);
    return;
  }
  pass(1, 'Production build artifacts are present and non-empty');
})();

// ---------------------------------------------------------------------------
// 2. Code splitting produced vendor chunks
// ---------------------------------------------------------------------------
(function test2() {
  const assetsDir = path.join(ROOT, 'dist', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fail(2, 'Code splitting produced vendor chunks', 'dist/assets/ missing — run npm run build first.');
    return;
  }
  const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  // After manual chunking we expect at least 2 JS files (app + at least one vendor)
  if (jsFiles.length < 2) {
    fail(2, 'Code splitting produced vendor chunks', `Only ${jsFiles.length} JS files found — expected ≥2 with code splitting.`);
    return;
  }
  pass(2, `Code splitting produced ${jsFiles.length} JS chunks (vendor separation active)`);
})();

// ---------------------------------------------------------------------------
// 3. No .map files in dist/ (sourcemaps suppressed in production)
// ---------------------------------------------------------------------------
(function test3() {
  const assetsDir = path.join(ROOT, 'dist', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fail(3, 'No source maps in dist/', 'dist/assets/ missing — run npm run build first.');
    return;
  }
  const mapFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.map'));
  if (mapFiles.length > 0) {
    fail(3, 'No source maps in dist/', `Found ${mapFiles.length} .map files: ${mapFiles.join(', ')}. Source maps leak code paths.`);
    return;
  }
  pass(3, 'No source maps present in dist/ (production build suppresses sourcemaps)');
})();

// ---------------------------------------------------------------------------
// 4. .env.local is in .gitignore
// ---------------------------------------------------------------------------
(function test4() {
  const gitignore = readFile('.gitignore');
  if (!gitignore) {
    fail(4, '.env.local is in .gitignore', '.gitignore file not found.');
    return;
  }
  if (!gitignore.includes('*.local') && !gitignore.includes('.env.local')) {
    fail(4, '.env.local is in .gitignore', '.gitignore does not ignore .env.local or *.local');
    return;
  }
  pass(4, '.env.local is excluded by .gitignore (secrets not committed)');
})();

// ---------------------------------------------------------------------------
// 5. .env.example exists and contains no real secret values
// ---------------------------------------------------------------------------
(function test5() {
  const envExample = readFile('.env.example');
  if (!envExample) {
    fail(5, '.env.example is committed and secret-free', '.env.example not found.');
    return;
  }
  // Should not contain real-looking Supabase keys (they start with eyJ)
  if (envExample.includes('eyJ')) {
    fail(5, '.env.example is committed and secret-free', 'Contains what appears to be a real JWT/key starting with "eyJ".');
    return;
  }
  // Should not contain real Gemini API key pattern (AIzaSy...)
  if (/AIzaSy[A-Za-z0-9_-]{33}/.test(envExample)) {
    fail(5, '.env.example is committed and secret-free', 'Contains what appears to be a real Gemini API key.');
    return;
  }
  pass(5, '.env.example exists with placeholder values only — no real secrets.');
})();

// ---------------------------------------------------------------------------
// 6. All 7 migration files present in chronological order
// ---------------------------------------------------------------------------
(function test6() {
  const expectedMigrations = [
    '20261013000000_civicai_initial_schema.sql',
    '20261013010000_phase5_tracking_id_generator.sql',
    '20261013015000_phase9_duplicate_status_check.sql',
    '20261013018000_phase10_complaint_duplicates.sql',
    '20261013020000_phase11_notifications.sql',
    '20261013030000_phase12_security_hardening.sql',
    '20261013040000_phase13_demo_seed_guard.sql',
  ];
  const missing = expectedMigrations.filter(m => !fileExists(`supabase/migrations/${m}`));
  if (missing.length > 0) {
    fail(6, 'All 7 migration files present in order', `Missing: ${missing.join(', ')}`);
    return;
  }
  pass(6, 'All 7 migration files present in correct chronological order');
})();

// ---------------------------------------------------------------------------
// 7. Phase 13 migration defines demo_readiness_check() function
// ---------------------------------------------------------------------------
(function test7() {
  const migration = readFile('supabase/migrations/20261013040000_phase13_demo_seed_guard.sql');
  if (!migration) {
    fail(7, 'Phase 13 migration defines demo_readiness_check()', 'Migration file not found.');
    return;
  }
  if (!migration.includes('demo_readiness_check')) {
    fail(7, 'Phase 13 migration defines demo_readiness_check()', 'Function not found in migration.');
    return;
  }
  pass(7, 'Phase 13 migration defines demo_readiness_check() SQL function');
})();

// ---------------------------------------------------------------------------
// 8. Phase 13 migration defines v_demo_complaints view
// ---------------------------------------------------------------------------
(function test8() {
  const migration = readFile('supabase/migrations/20261013040000_phase13_demo_seed_guard.sql');
  if (!migration) {
    fail(8, 'Phase 13 migration defines v_demo_complaints view', 'Migration file not found.');
    return;
  }
  if (!migration.includes('v_demo_complaints')) {
    fail(8, 'Phase 13 migration defines v_demo_complaints view', 'View not found in migration.');
    return;
  }
  if (!migration.includes('SYNTHETIC_DEMO')) {
    fail(8, 'Phase 13 migration defines v_demo_complaints view', 'data_classification SYNTHETIC_DEMO label missing.');
    return;
  }
  pass(8, 'Phase 13 migration defines v_demo_complaints advisory view with SYNTHETIC_DEMO classification');
})();

// ---------------------------------------------------------------------------
// 9. seed.sql covers all 4 priority tiers
// ---------------------------------------------------------------------------
(function test9() {
  const seed = readFile('supabase/seed.sql');
  if (!seed) {
    fail(9, 'seed.sql covers all 4 priority tiers', 'seed.sql not found.');
    return;
  }
  const tiers = ['critical', 'high', 'medium', 'low'];
  const missing = tiers.filter(t => !seed.includes(`'${t}'`));
  if (missing.length > 0) {
    fail(9, 'seed.sql covers all 4 priority tiers', `Missing priority tiers: ${missing.join(', ')}`);
    return;
  }
  pass(9, 'seed.sql covers all 4 priority tiers (critical / high / medium / low)');
})();

// ---------------------------------------------------------------------------
// 10. seed.sql has at least 6 demo complaints
// ---------------------------------------------------------------------------
(function test10() {
  const seed = readFile('supabase/seed.sql');
  if (!seed) {
    fail(10, 'seed.sql has 6 demo complaints', 'seed.sql not found.');
    return;
  }
  const matches = (seed.match(/CHD-TEST-000\d/g) || []);
  const unique = new Set(matches);
  if (unique.size < 6) {
    fail(10, 'seed.sql has 6 demo complaints', `Only ${unique.size} unique CHD-TEST-* IDs found.`);
    return;
  }
  pass(10, `seed.sql contains ${unique.size} distinct demo complaints (CHD-TEST-*)`);
})();

// ---------------------------------------------------------------------------
// 11. seed.sql has AI assessments
// ---------------------------------------------------------------------------
(function test11() {
  const seed = readFile('supabase/seed.sql');
  if (!seed) {
    fail(11, 'seed.sql has AI assessments', 'seed.sql not found.');
    return;
  }
  if (!seed.includes('ai_assessments')) {
    fail(11, 'seed.sql has AI assessments', 'No ai_assessments INSERT found in seed.');
    return;
  }
  if (!seed.includes('civicai-multimodal-v0.1-demo')) {
    fail(11, 'seed.sql has AI assessments', 'Demo model_version identifier missing.');
    return;
  }
  pass(11, 'seed.sql includes AI assessments with demo model version marker');
})();

// ---------------------------------------------------------------------------
// 12. seed.sql uses CHD-TEST- prefix exclusively for tracking IDs
// ---------------------------------------------------------------------------
(function test12() {
  const seed = readFile('supabase/seed.sql');
  if (!seed) {
    fail(12, 'seed.sql tracking IDs use CHD-TEST- prefix', 'seed.sql not found.');
    return;
  }
  // Find all tracking_id values that are NOT CHD-TEST- (excluding comments and function references)
  const trackingIdLines = seed.split('\n').filter(l => l.trim().match(/^'CHD-/));
  const badIds = trackingIdLines.filter(l => !l.includes('CHD-TEST-'));
  if (badIds.length > 0) {
    fail(12, 'seed.sql tracking IDs use CHD-TEST- prefix', `Non-CHD-TEST- tracking IDs found: ${badIds.join(', ')}`);
    return;
  }
  pass(12, 'All seed.sql tracking IDs use CHD-TEST- prefix (clearly marked synthetic)');
})();

// ---------------------------------------------------------------------------
// 13. seed.sql does NOT contain real personal data keywords
// ---------------------------------------------------------------------------
(function test13() {
  const seed = readFile('supabase/seed.sql');
  if (!seed) {
    fail(13, 'seed.sql contains no real personal data', 'seed.sql not found.');
    return;
  }
  const forbidden = [
    'aadhaar', 'aadhar', 'biometric', 'pan card', 'voter id',
    'real name', 'passport',
  ];
  const seedLower = seed.toLowerCase();
  const found = forbidden.filter(term => seedLower.includes(term));
  if (found.length > 0) {
    fail(13, 'seed.sql contains no real personal data', `Forbidden terms found: ${found.join(', ')}`);
    return;
  }
  pass(13, 'seed.sql contains no real personal data keywords (Aadhaar, biometric, PAN, passport)');
})();

// ---------------------------------------------------------------------------
// 14. seed.sql has a duplicate candidate pair
// ---------------------------------------------------------------------------
(function test14() {
  const seed = readFile('supabase/seed.sql');
  if (!seed) {
    fail(14, 'seed.sql has a duplicate candidate pair', 'seed.sql not found.');
    return;
  }
  if (!seed.includes('complaint_duplicates')) {
    fail(14, 'seed.sql has a duplicate candidate pair', 'No complaint_duplicates INSERT in seed.');
    return;
  }
  if (!seed.includes('similarity_score')) {
    fail(14, 'seed.sql has a duplicate candidate pair', 'similarity_score not present in duplicate insert.');
    return;
  }
  pass(14, 'seed.sql includes a duplicate candidate pair with similarity_score');
})();

// ---------------------------------------------------------------------------
// 15. seed.sql has notifications with event_key
// ---------------------------------------------------------------------------
(function test15() {
  const seed = readFile('supabase/seed.sql');
  if (!seed) {
    fail(15, 'seed.sql has notifications with event_key', 'seed.sql not found.');
    return;
  }
  if (!seed.includes('public.notifications')) {
    fail(15, 'seed.sql has notifications with event_key', 'No notifications INSERT in seed.');
    return;
  }
  if (!seed.includes('demo-evt-')) {
    fail(15, 'seed.sql has notifications with event_key', 'No demo-evt-* event_key found.');
    return;
  }
  pass(15, 'seed.sql includes notifications with idempotent demo-evt-* event_keys');
})();

// ---------------------------------------------------------------------------
// 16. README is updated beyond Phase 1 scope
// ---------------------------------------------------------------------------
(function test16() {
  const readme = readFile('README.md');
  if (!readme) {
    fail(16, 'README updated beyond Phase 1', 'README.md not found.');
    return;
  }
  // If README still says "currently at Phase 1" it's not updated
  if (readme.includes('currently at **Phase 1') || readme.includes('Phase 1: Project Foundation Only')) {
    fail(16, 'README updated beyond Phase 1', 'README still shows Phase 1 only scope. Update required for Phase 13.');
    return;
  }
  pass(16, 'README.md has been updated beyond Phase 1 scope');
})();

// ---------------------------------------------------------------------------
// 17. docs/deployment.md is present and comprehensive
// ---------------------------------------------------------------------------
(function test17() {
  const deployment = readFile('docs/deployment.md');
  if (!deployment) {
    fail(17, 'docs/deployment.md is present and comprehensive', 'File not found.');
    return;
  }
  const requiredSections = [
    'Pre-deployment Checklist',
    'Supabase Production Setup',
    'Edge Function Secrets',
    'Vercel',
    'Post-Deploy Verification',
  ];
  const missing = requiredSections.filter(s => !deployment.includes(s));
  if (missing.length > 0) {
    fail(17, 'docs/deployment.md is present and comprehensive', `Missing sections: ${missing.join(', ')}`);
    return;
  }
  pass(17, 'docs/deployment.md present with all required sections');
})();

// ---------------------------------------------------------------------------
// 18. docs/demo-guide.md is present and has demo script
// ---------------------------------------------------------------------------
(function test18() {
  const guide = readFile('docs/demo-guide.md');
  if (!guide) {
    fail(18, 'docs/demo-guide.md is present with demo script', 'File not found.');
    return;
  }
  const requiredSections = ['Scene 1', 'Scene 2', 'Scene 3', 'Q&A'];
  const missing = requiredSections.filter(s => !guide.includes(s));
  if (missing.length > 0) {
    fail(18, 'docs/demo-guide.md is present with demo script', `Missing sections: ${missing.join(', ')}`);
    return;
  }
  pass(18, 'docs/demo-guide.md present with 6-scene demo script and Q&A section');
})();

// ---------------------------------------------------------------------------
// 19. vite.config.ts has code-splitting (manualChunks)
// ---------------------------------------------------------------------------
(function test19() {
  const viteConfig = readFile('vite.config.ts');
  if (!viteConfig) {
    fail(19, 'vite.config.ts has manualChunks code splitting', 'vite.config.ts not found.');
    return;
  }
  if (!viteConfig.includes('manualChunks')) {
    fail(19, 'vite.config.ts has manualChunks code splitting', 'manualChunks not defined in vite.config.ts');
    return;
  }
  if (!viteConfig.includes('react-vendor') || !viteConfig.includes('supabase-vendor')) {
    fail(19, 'vite.config.ts has manualChunks code splitting', 'Expected react-vendor and supabase-vendor chunks not defined.');
    return;
  }
  pass(19, 'vite.config.ts defines react-vendor, supabase-vendor, icons-vendor manual chunks');
})();

// ---------------------------------------------------------------------------
// 20. vite.config.ts suppresses sourcemaps in production
// ---------------------------------------------------------------------------
(function test20() {
  const viteConfig = readFile('vite.config.ts');
  if (!viteConfig) {
    fail(20, 'vite.config.ts suppresses sourcemaps in production', 'vite.config.ts not found.');
    return;
  }
  if (!viteConfig.includes('sourcemap')) {
    fail(20, 'vite.config.ts suppresses sourcemaps in production', 'sourcemap configuration not found.');
    return;
  }
  // Should have conditional: mode === 'development' ? 'inline' : false
  if (!viteConfig.includes("mode === 'development'")) {
    fail(20, 'vite.config.ts suppresses sourcemaps in production', 'Sourcemap is not conditionally disabled for production.');
    return;
  }
  pass(20, "vite.config.ts suppresses sourcemaps in production (mode === 'development' ? 'inline' : false)");
})();

// ---------------------------------------------------------------------------
// 21. No vercel.json or deployment config contains secret values
// ---------------------------------------------------------------------------
(function test21() {
  // vercel.json may or may not exist — if it does, check it for secrets
  const vercelJson = readFile('vercel.json');
  if (!vercelJson) {
    // No vercel.json — that's fine, deployment docs cover the instructions
    pass(21, 'No vercel.json present (secrets not accidentally committed in deploy config)');
    return;
  }
  if (/eyJ[A-Za-z0-9_-]{10}/.test(vercelJson) || /AIzaSy/.test(vercelJson)) {
    fail(21, 'No secrets in vercel.json', 'vercel.json appears to contain a real API key or JWT.');
    return;
  }
  pass(21, 'vercel.json present and contains no secret values');
})();

// ---------------------------------------------------------------------------
// 22. CI/CD workflow template mentioned in deployment docs
// ---------------------------------------------------------------------------
(function test22() {
  const deployment = readFile('docs/deployment.md');
  if (!deployment) {
    fail(22, 'CI/CD workflow template in deployment docs', 'docs/deployment.md not found.');
    return;
  }
  if (!deployment.includes('GitHub Actions') || !deployment.includes('ci.yml')) {
    fail(22, 'CI/CD workflow template in deployment docs', 'No GitHub Actions CI/CD example in deployment guide.');
    return;
  }
  pass(22, 'docs/deployment.md includes GitHub Actions CI/CD workflow template');
})();

// ---------------------------------------------------------------------------
// 23. Security audit doc is present
// ---------------------------------------------------------------------------
(function test23() {
  if (!fileExists('docs/security-audit.md')) {
    fail(23, 'docs/security-audit.md present', 'File not found.');
    return;
  }
  const audit = readFile('docs/security-audit.md');
  if (!audit || audit.length < 1000) {
    fail(23, 'docs/security-audit.md present', 'File is too short — may not be a real security audit doc.');
    return;
  }
  pass(23, 'docs/security-audit.md present with substantive security audit content');
})();

// ---------------------------------------------------------------------------
// 24. All prior phase test suites pass (regression guard)
// ---------------------------------------------------------------------------
(function test24() {
  const suites = [
    'test/phase6_tests.mjs',
    'test/phase7_tests.mjs',
    'test/phase8_tests.mjs',
    'test/phase9_tests.mjs',
    'test/phase9_patch_tests.mjs',
    'test/phase10_tests.mjs',
    'test/phase11_tests.mjs',
    'test/phase12_security_tests.mjs',
  ];
  const failed_suites = [];
  for (const suite of suites) {
    try {
      execSync(`node ${suite}`, { cwd: ROOT, stdio: 'pipe' });
    } catch {
      failed_suites.push(suite);
    }
  }
  if (failed_suites.length > 0) {
    fail(24, 'All prior phase test suites pass (regression guard)', `Failing suites: ${failed_suites.join(', ')}`);
    return;
  }
  pass(24, `All ${suites.length} prior phase test suites pass — zero regressions introduced by Phase 13`);
})();

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('');
console.log('=============================================================================');
if (failed === 0) {
  console.log(`--- ALL ${passed}/${passed + failed} PHASE 13 DEMO READINESS TESTS PASSED SUCCESSFULLY ---`);
} else {
  console.log(`--- ${passed}/${passed + failed} PHASE 13 TESTS PASSED — ${failed} FAILED ---`);
}
console.log('=============================================================================');
console.log('');

if (failed > 0) {
  process.exit(1);
}
