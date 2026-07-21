const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sb = createClient('https://cyuunmrdrymhzxfcruoe.supabase.co', 'sb_publishable_koAM0ouveX_M1SBE-OfdCw_XeRWJI0h');

const srcDir = path.join(__dirname, '..', 'src', 'components');

function extractTemplate(source, varName) {
  // Match: export const VAR_NAME = `...`;  or  const VAR_NAME = `...`;
  // Using a simpler approach: find the start, then match backticks
  const marker = 'const ' + varName + ' = `';
  const startIdx = source.indexOf(marker);
  if (startIdx === -1) return '';
  const contentStart = startIdx + marker.length;
  const endIdx = source.indexOf('`;', contentStart);
  if (endIdx === -1) return '';
  return source.substring(contentStart, endIdx).trim();
}

const cabinet = fs.readFileSync(path.join(srcDir, 'CabinetEstimator.tsx'), 'utf8');
const construction = fs.readFileSync(path.join(srcDir, 'ConstructionEstimator.tsx'), 'utf8');
const mechanical = fs.readFileSync(path.join(srcDir, 'MechanicalEstimator.tsx'), 'utf8');
const subcontractor = fs.readFileSync(path.join(srcDir, 'SubcontractorEstimator.tsx'), 'utf8');

const templates = {
  contract_template:                extractTemplate(cabinet, 'DEFAULT_FURN_CONTRACT_TEMPLATE'),
  acceptance_template:              extractTemplate(cabinet, 'DEFAULT_FURN_ACCEPTANCE_TEMPLATE'),
  liquidation_template:             extractTemplate(cabinet, 'DEFAULT_FURN_LIQUIDATION_TEMPLATE'),
  final_quote_template:             extractTemplate(cabinet, 'DEFAULT_FURN_ACCEPTANCE_TEMPLATE'),
  construction_contract_template:    extractTemplate(construction, 'DEFAULT_CONS_CONTRACT_TEMPLATE'),
  construction_acceptance_template:  extractTemplate(construction, 'DEFAULT_CONS_ACCEPTANCE_TEMPLATE'),
  construction_liquidation_template: extractTemplate(construction, 'DEFAULT_CONS_LIQUIDATION_TEMPLATE'),
  mechanical_contract_template:      extractTemplate(mechanical, 'DEFAULT_MECH_CONTRACT_TEMPLATE'),
  mechanical_acceptance_template:    extractTemplate(mechanical, 'DEFAULT_MECH_ACCEPTANCE_TEMPLATE'),
  mechanical_liquidation_template:   extractTemplate(mechanical, 'DEFAULT_MECH_LIQUIDATION_TEMPLATE'),
  subcontractor_contract_template:    extractTemplate(subcontractor, 'DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE'),
  subcontractor_acceptance_template:  extractTemplate(subcontractor, 'DEFAULT_SUBCONTRACTOR_ACCEPTANCE_TEMPLATE'),
  subcontractor_liquidation_template: extractTemplate(subcontractor, 'DEFAULT_SUBCONTRACTOR_LIQUIDATION_TEMPLATE'),
};

// Verify all templates extracted
let allOk = true;
Object.entries(templates).forEach(([k, v]) => {
  const len = v ? v.length : 0;
  const icon = len > 0 ? '✅' : '❌';
  console.log(icon + ' ' + k + ': ' + len + ' chars');
  if (!v) allOk = false;
});

if (!allOk) {
  console.error('\nSome templates are empty! Aborting.');
  process.exit(1);
}

// Upload
(async () => {
  console.log('\nUploading to Supabase...');
  const payload = { id: 'global', ...templates };
  const { error } = await sb.from('document_templates').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('UPSERT ERROR:', error.message);
    process.exit(1);
  }
  console.log('✅ Upsert success!');

  // Verify from Supabase
  console.log('\nVerifying from Supabase...');
  const { data, error: qErr } = await sb.from('document_templates').select('*').eq('id', 'global').single();
  if (qErr) { console.error('Verify error:', qErr.message); return; }
  Object.keys(data).forEach(k => {
    if (k === 'id') return;
    const v = data[k];
    const len = v ? v.length : 0;
    console.log('  ' + k + ': ' + len + ' chars');
  });
  console.log('\n🎉 Done!');
})();
