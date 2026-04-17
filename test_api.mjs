// ShieldPay Backend API Tests
const BASE = process.env.API_BASE_URL || 'http://localhost:5001';

async function test(name, method, path, body) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json();
    const icon = res.ok ? '✅' : '⚠️ ';
    console.log(`\n${icon} [${res.status}] ${method} ${path} — ${name}`);
    console.log(JSON.stringify(data, null, 2).split('\n').slice(0, 20).join('\n'));
    return data;
  } catch (e) {
    console.log(`\n❌ [FAIL] ${method} ${path} — ${name}`);
    console.log('   Error:', e.message);
    return null;
  }
}

console.log('═══════════════════════════════════════════');
console.log('   ShieldPay API Test Suite');
console.log('═══════════════════════════════════════════');

// 1. Health check
await test('Health Check', 'GET', '/health');

// 2. Quote — valid request
const quoteRes = await test('Get Quote (Valid)', 'POST', '/api/pricing/quote', {
  city: 'Mumbai',
  pincode: '400001',
  work_type: 'construction',
  daily_hours: 8,
  avg_weekly_income: 3500,
  plan_tier: 'standard',
  years_experience: 3,
  user_id: null,
});

// 3. Quote — missing fields
await test('Get Quote (Missing city+pincode)', 'POST', '/api/pricing/quote', {
  work_type: 'construction',
  daily_hours: 8,
  avg_weekly_income: 3500,
  plan_tier: 'standard',
});

// 4. Quote — invalid work_type
await test('Get Quote (Bad work_type)', 'POST', '/api/pricing/quote', {
  city: 'Delhi',
  work_type: 'hacking',
  daily_hours: 8,
  avg_weekly_income: 3500,
  plan_tier: 'basic',
});

// 5. Quote — invalid daily_hours
await test('Get Quote (daily_hours out of range)', 'POST', '/api/pricing/quote', {
  city: 'Delhi',
  work_type: 'delivery',
  daily_hours: 25,
  avg_weekly_income: 3500,
  plan_tier: 'basic',
});

// 6. Create policy — missing quote_id
await test('Create Policy (Missing quote_id)', 'POST', '/api/policies/create', {
  user_id: '00000000-0000-4000-8000-000000000001',
});

// 7. Create policy — invalid UUID
await test('Create Policy (Invalid UUID)', 'POST', '/api/policies/create', {
  quote_id: 'not-a-uuid',
  user_id: '00000000-0000-4000-8000-000000000001',
});

// 8. Get policies for a user
await test('Get User Policies', 'GET', '/api/policies/00000000-0000-4000-8000-000000000001');

// 9. Unknown route (404 handler)
await test('Unknown Route (404)', 'GET', '/api/unknown');

console.log('\n═══════════════════════════════════════════');
console.log('   Tests Complete');
console.log('═══════════════════════════════════════════\n');
