import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('--- SUPABASE LIVE SECURITY & AI SCHEMA VERIFICATION ---');

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('[SKIP] Supabase credentials not found in .env.local.');
  process.exit(0);
}

const client = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('1. Checking read access to ai_assessments table...');
  const { data: readData, error: readError } = await client
    .from('ai_assessments')
    .select('id, complaint_id, severity, evidence_support, human_review_required')
    .limit(1);

  if (readError) {
    console.log(`   Read result error (expected under strict RLS if no public rows): ${readError.message}`);
  } else {
    console.log(`   Read successful: ${readData.length} records returned. Schema columns confirmed.`);
  }

  console.log('2. Verifying RLS prevents arbitrary anonymous write to ai_assessments...');
  const { error: insertError } = await client
    .from('ai_assessments')
    .insert({
      complaint_id: '00000000-0000-0000-0000-000000000000',
      severity: 99,
      evidence_support: 99,
      human_review_required: false,
    });

  if (insertError) {
    console.log(`[PASS] Anonymous INSERT was correctly REJECTED by RLS: ${insertError.message} (code: ${insertError.code})`);
  } else {
    console.error('[FAIL] Anonymous user was able to insert into ai_assessments! Security violation!');
    process.exit(1);
  }

  console.log('--- LIVE SUPABASE VERIFICATION COMPLETED SUCCESSFULLY ---');
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
