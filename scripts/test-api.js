#!/usr/bin/env node
/**
 * Zeu Backend — End-to-End API Test Runner
 * Tests the full lifecycle: health → session → chat → transfer → agent → resolve
 * 
 * Usage:
 *   npm run test:api                                    # Test against localhost:3000
 *   npm run test:api -- --url=https://your-vercel.app   # Test against remote
 */

const BASE = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:3000';

let passed = 0, failed = 0;
const results = [];

async function request(method, path, body = null) {
  const url = `${BASE}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(url, opts);
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

function assert(testName, condition, detail = '') {
  if (condition) {
    passed++;
    results.push({ name: testName, status: 'PASS' });
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    results.push({ name: testName, status: 'FAIL', detail });
    console.log(`  ❌ ${testName}${detail ? ' — ' + detail : ''}`);
  }
}

async function run() {
  console.log('='.repeat(60));
  console.log('🚀 Zeu Backend E2E Test Suite');
  console.log(`📍 Target: ${BASE}`);
  console.log('='.repeat(60));

  // ─── 1. Health Check ───
  console.log('\n📋 1. Health Check');
  const health = await request('GET', '/api');
  assert('GET /api returns 200', health.status === 200);
  assert('Response has status=online', health.data?.status === 'online');
  assert('Response lists endpoints', Array.isArray(health.data?.endpoints) && health.data.endpoints.length >= 10);

  // ─── 2. Input Validation ───
  console.log('\n📋 2. Input Validation');
  const noPrompt = await request('POST', '/api/generate', { classification: 'STANDARD' });
  assert('POST /api/generate without prompt → 400', noPrompt.status === 400);

  const methodCheck = await request('GET', '/api/generate');
  assert('GET /api/generate → 405 or 404', [404, 405].includes(methodCheck.status));

  // ─── 3. AI Generate (Standard) ───
  console.log('\n📋 3. AI Generate');
  const gen = await request('POST', '/api/generate', {
    prompt: 'What is Zeu and how does pickup work?',
    classification: 'STANDARD'
  });
  assert('POST /api/generate returns 200', gen.status === 200);
  assert('Response has success=true', gen.data?.success === true);
  assert('Response has non-empty reply', typeof gen.data?.reply === 'string' && gen.data.reply.length > 0);
  assert('Response has model_used field', typeof gen.data?.model_used === 'string');
  assert('is_transfer is false for standard query', gen.data?.is_transfer === false);

  // ─── 4. AI Generate (Escalation) ───
  console.log('\n📋 4. Escalation Detection');
  const esc = await request('POST', '/api/generate', {
    prompt: 'I never received my order, connect me to a human agent',
    classification: 'STANDARD'
  });
  assert('Escalation returns 200', esc.status === 200);
  assert('Escalation sets is_transfer=true', esc.data?.is_transfer === true);

  // ─── 5. Late Order (NO transfer) ───
  console.log('\n📋 5. Late Order Guard');
  const late = await request('POST', '/api/generate', {
    prompt: 'My order is delayed, when will it arrive?',
    classification: 'STANDARD'
  });
  assert('Late order returns 200', late.status === 200);
  assert('Late order does NOT trigger transfer', late.data?.is_transfer === false);

  // ─── 6. Session Lifecycle ───
  console.log('\n📋 6. Session Lifecycle');
  
  // Start session
  const startRes = await request('POST', '/api/v1/chat/session/start', {
    userId: 'test_user_e2e',
    platform: 'web',
    language: 'en'
  });
  assert('Start session returns 201', startRes.status === 201);
  assert('Session has sessionId', typeof startRes.data?.sessionId === 'string');
  const sessionId = startRes.data?.sessionId;

  if (!sessionId) {
    console.log('\n⚠️  Cannot continue lifecycle tests without sessionId');
  } else {
    // Missing userId validation
    const badStart = await request('POST', '/api/v1/chat/session/start', {});
    assert('Start session without userId → 400', badStart.status === 400);

    // Send chat message
    const chatRes = await request('POST', '/api/v1/chat/message', {
      sessionId,
      message: 'Hi, what are your store hours?',
      classification: 'STANDARD'
    });
    assert('Chat message returns 200', chatRes.status === 200);
    assert('Chat response has reply', typeof chatRes.data?.reply === 'string' && chatRes.data.reply.length > 0);

    // Get history
    const histRes = await request('GET', `/api/v1/chat/history/${sessionId}`);
    assert('Chat history returns 200', histRes.status === 200);
    assert('History has messages', Array.isArray(histRes.data?.messages) && histRes.data.messages.length >= 2);

    // Get status
    const statusRes = await request('GET', `/api/v1/chat/status/${sessionId}`);
    assert('Status returns 200', statusRes.status === 200);
    assert('Status is AI_ACTIVE', statusRes.data?.status === 'AI_ACTIVE');

    // Transfer to human
    const transferRes = await request('POST', '/api/v1/chat/transfer-to-human', {
      sessionId,
      reason: 'non_delivery',
      priorityLevel: 'HIGH'
    });
    assert('Transfer returns 200', transferRes.status === 200);
    assert('Transfer creates ticket', typeof transferRes.data?.ticketId === 'string');
    const ticketId = transferRes.data?.ticketId;

    // Agent queue
    const queueRes = await request('GET', '/api/v1/agent/queue');
    assert('Agent queue returns 200', queueRes.status === 200);
    assert('Queue has tickets', typeof queueRes.data?.queueLength === 'number');

    if (ticketId) {
      // Claim ticket
      const claimRes = await request('POST', '/api/v1/agent/claim-ticket', {
        ticketId,
        agentId: 'agent_test_001'
      });
      assert('Claim ticket returns 200', claimRes.status === 200);
      assert('Claim sets HUMAN_CONNECTED', claimRes.data?.status === 'HUMAN_CONNECTED');

      // Agent message
      const agentMsgRes = await request('POST', '/api/v1/agent/message', {
        sessionId,
        agentId: 'agent_test_001',
        message: 'I am looking into your issue right now.'
      });
      assert('Agent message returns 200', agentMsgRes.status === 200);

      // Resolve session
      const resolveRes = await request('POST', '/api/v1/chat/resolve', {
        sessionId,
        agentId: 'agent_test_001',
        resolution: 'full_refund'
      });
      assert('Resolve returns 200', resolveRes.status === 200);
      assert('Resolve sets CLOSED', resolveRes.data?.status === 'CLOSED');
    }
  }

  // ─── 7. 404 Check ───
  console.log('\n📋 7. Error Handling');
  const notFound = await request('GET', '/api/nonexistent');
  assert('Unknown endpoint returns 404', notFound.status === 404);

  // ─── Summary ───
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.name}${r.detail ? ': ' + r.detail : ''}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
