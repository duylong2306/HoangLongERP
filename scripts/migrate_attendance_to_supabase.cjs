#!/usr/bin/env node
/**
 * Migrate attendance records from localStorage export (hl_hrm_attendance_v3)
 * to Supabase `attendance_records` table.
 *
 * Usage:
 *   1. Export localStorage key `hl_hrm_attendance_v3` from browser → save as attendance_export.json
 *   2. Set env: SUPABASE_URL, SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE)
 *   3. node scripts/migrate_attendance_to_supabase.cjs attendance_export.json
 *
 * If no file arg: tries to read ./attendance_export.json
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sujhvotnlbsgavoenuma.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE || '';

if (!SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE env var');
  process.exit(1);
}

// Lazy require supabase (optional dependency)
let createClient;
try {
  ({ createClient } = require('@supabase/supabase-js'));
} catch (e) {
  console.error('❌ @supabase/supabase-js not installed. Run: npm install @supabase/supabase-js');
  process.exit(1);
}

const inputFile = process.argv[2] || path.join(__dirname, 'attendance_export.json');
if (!fs.existsSync(inputFile)) {
  console.error(`❌ Input file not found: ${inputFile}`);
  process.exit(1);
}

function mapToRow(r) {
  // Ensure id uniqueness: empId+date+slot is common in app; we keep app id but
  // enforce (emp_id, date) uniqueness via index — prefer the "main" row per day.
  const id = String(r.id || `${r.empId}_${r.date}`).slice(0, 255);
  return {
    id,
    emp_id: r.empId || '',
    emp_name: r.empName || null,
    date: r.date || null,
    time_in_s: r.timeInS || '--:--',
    time_out_s: r.timeOutS || '--:--',
    time_in_c: r.timeInC || '--:--',
    time_out_c: r.timeOutC || '--:--',
    time_in_ot: r.timeInOT || '--:--',
    time_out_ot: r.timeOutOT || '--:--',
    method: r.method || null,
    status: r.status || 'valid',
    ot_hours: Number(r.otHours) || 0,
    notes: r.notes || null,
    photo_in: r.photoIn || null,
    location_in: r.locationIn || null,
    coords_in: r.coordsIn || null,
    photo_out: r.photoOut || null,
    location_out: r.locationOut || null,
    coords_out: r.coordsOut || null,
    is_locked: Boolean(r.isLocked),
  };
}

(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const raw = fs.readFileSync(inputFile, 'utf-8');
  let data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    console.error('❌ Expected a JSON array of attendance records');
    process.exit(1);
  }

  // Deduplicate by emp_id+date, keep last occurrence
  const byKey = new Map();
  for (const r of data) {
    const key = `${r.empId}_${r.date}`;
    byKey.set(key, r);
  }
  const rows = [...byKey.values()].map(mapToRow);
  console.log(`📦 Prepared ${rows.length} unique attendance rows (from ${data.length} raw).`);

  // Upsert in chunks of 100
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('attendance_records').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error(`❌ Failed chunk ${i / CHUNK}:`, error.message);
      process.exit(1);
    }
    inserted += chunk.length;
    console.log(`  ✓ ${inserted}/${rows.length}`);
  }

  console.log(`✅ Migration complete: ${inserted} records pushed to Supabase.`);
})();
