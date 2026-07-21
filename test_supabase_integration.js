const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load .env
const envRaw = fs.readFileSync('.env', 'utf-8');
const envVars = {};
for (const line of envRaw.split('\n')) {
  const t = line.trim();
  if (!t || t.starts('export') || t.startsWith('#')) continue;
  const eqIdx = t.indexOf('=');
  if (eqIdx < 0) continue;
  let val = t.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  const key = t.slice(0, eqIdx).trim();
  envVars[key] = val;
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;

console.log('[Integration Test] .env check:', { SUPABASE_URL, hasKey: !!SUPABASE_ANON_KEY });

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Integration Test] ❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function integrationTest() {
  console.log('\n=== Supabase Integration Test ===');

  const testEmployee = {
    id: 'int_emp_001',
    name: 'Integration Test Employee',
    username: 'integtest',
    department: 'Integration',
    email: 'integration@test.com',
    phone: '123456789',
    password: '$2a$10$placeholder',
    role: 'tester'
  };

  const testProject = {
    id: 'int_proj_001',
    name: 'Integration Test Project',
    code: 'INT-001',
    customer_id: 'cust_1',
    type: 'construction',
    status: 'new',
    progress: 0,
    contract_value: 123456789,
    start_date: '2026-07-01',
    end_date: '2026-12-31',
    pm_id: '',
    address: '',
    notes: 'Integration test project'
  };

  const testTask = {
    id: 'int_task_001',
    name: 'Integration Test Task',
    status: 'todo',
    priority: 'medium',
    project_id: 'proj_lib_1'
  };

  const testReceipt = {
    id: 'int_rec_001',
    code: 'INT-REC-001',
    date: '2026-07-20',
    customer_id: 'cust_1',
    amount: 12345678,
    payment_method: 'transfer',
    notes: 'Integration test receipt',
    collector: 'Test'
  };

  const testPayment = {
    id: 'int_pay_001',
    code: 'INT-PAY-001',
    date: '2026-07-20',
    recipient: 'Integration Test',
    category: 'material',
    amount: 9876543,
    payment_method: 'transfer',
    notes: 'Integration test payment',
    proposer: 'Test',
    approver: 'Test',
    status: 'pending'
  };

  try {
    // 1. Save employee
    console.log('\n1. Saving test employee...');
    const { data: empData, error: empError } = await supabase
      .from('employees')
      .upsert(testEmployee)
      .select()
      .single();
    if (empError) {
      console.error('[FAIL] Employee upsert failed:', empError.message);
      return;
    }
    console.log('✅ Employee saved:', empData?.id);

    // 2. Save project
    console.log('\n2. Saving test project...');
    const { data: projData, error: projError } = await supabase
      .from('projects')
      .upsert(testProject)
      .select()
      .single();
    if (projError) {
      console.error('[FAIL] Project upsert failed:', projError.message);
      return;
    }
    console.log('✅ Project saved:', projData?.id);

    // 3. Save task
    console.log('\n3. Saving test task...');
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .upsert(testTask)
      .select()
      .single();
    if (taskError) {
      console.error('[FAIL] Task upsert failed:', taskError.message);
      return;
    }
    console.log('✅ Task saved:', taskData?.id);

    // 4. Save receipt
    console.log('\n4. Saving test receipt...');
    const { data: recData, error: recError } = await supabase
      .from('receipts')
      .upsert(testReceipt)
      .select()
      .single();
    if (recError) {
      console.error('[FAIL] Receipt upsert failed:', recError.message);
      return;
    }
    console.log('✅ Receipt saved:', recData?.id);

    // 5. Save payment
    console.log('\n5. Saving test payment...');
    const { data: payData, error: payError } = await supabase
      .from('payments')
      .upsert(testPayment)
      .select()
      .single();
    if (payError) {
      console.error('[FAIL] Payment upsert failed:', payError.message);
      return;
    }
    console.log('✅ Payment saved:', payData?.id);

    // 6. Query all test data
    console.log('\n6. Querying all test data...');
    const [empRes, projRes, taskRes, recRes, payRes] = await Promise.all([
      supabase.from('employees').select('*').eq('id', 'int_emp_001'),
      supabase.from('projects').select('*').eq('id', 'int_proj_001'),
      supabase.from('tasks').select('*').eq('id', 'int_task_001'),
      supabase.from('receipts').select('*').eq('id', 'int_rec_001'),
      supabase.from('payments').select('*').eq('id', 'int_pay_001')
    ]);

    const results = [
      { name: 'employees', data: empRes.data, error: empRes.error },
      { name: 'projects', data: projRes.data, error: projRes.error },
      { name: 'tasks', data: taskRes.data, error: taskRes.error },
      { name: 'receipts', data: recRes.data, error: recRes.error },
      { name: 'payments', data: payRes.data, error: payRes.error }
    ];n
    const allGood = results.every(r => {
      if (r.error) {
        console.error(`[${r.name}] ❌ Query failed:`, r.error.message);
        return false;
      }
      console.log(`[${r.name}] ✅ Found ${r.data?.length} row(s)`);
      return true;
    });

    if (!allGood) {
      console.error('\n❌ Some queries failed');
      return;
    }

    console.log('\n✅ ALL INTEGRATION TESTS PASSED!');

    // 7. Cleanup
    console.log('\n7. Cleaning up test data...');
    await Promise.all([
      supabase.from('employees').delete().eq('id', 'int_emp_001'),
      supabase.from('projects').delete().eq('id', 'int_proj_001'),
      supabase.from('tasks').delete().eq('id', 'int_task_001'),
      supabase.from('receipts').delete().eq('id', 'int_rec_001'),
      supabase.from('payments').delete().eq('id', 'int_pay_001')
    ]);
    console.log('✅ Cleanup complete');

  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    process.exit(1);
  }
}

integrationTest();