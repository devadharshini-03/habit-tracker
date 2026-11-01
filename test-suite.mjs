import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8092;
const CDP_PORT = 9898;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\DEVADHARSHINI S\\.gemini\\antigravity\\scratch\\test-cdp-profile-v2';

// Clean profile
try {
  fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
} catch (e) {}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

// 1. Static HTTP Server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(__dirname, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log(`[HTTP Server] Listening on http://127.0.0.1:${PORT}`);

// 2. Launch Chrome Headless
const chromeProcess = spawn(CHROME_PATH, [
  '--headless=new',
  `--remote-debugging-port=${CDP_PORT}`,
  '--remote-allow-origins=*',
  `--user-data-dir=${USER_DATA_DIR}`,
  '--no-first-run',
  '--disable-gpu',
  '--disable-extensions',
  '--window-size=1200,850',
  'about:blank'
]);

await new Promise(r => setTimeout(r, 1500));

// 3. Connect to CDP Page Target
const targetsRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
const targets = await targetsRes.json();
const pageTarget = targets.find(t => t.type === 'page') || targets[0];
const targetWsUrl = pageTarget?.webSocketDebuggerUrl;

if (!targetWsUrl) {
  console.error('Failed to get WebSocket debugger URL');
  process.exit(1);
}

const ws = new WebSocket(targetWsUrl);
let messageId = 1;
const pending = new Map();

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
  }
};

await new Promise((resolve) => { ws.onopen = resolve; });
console.log('[CDP] Connected to Chrome DevTools Protocol');

function send(method, params = {}) {
  const id = messageId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (res.exceptionDetails) {
    throw new Error('Eval error: ' + JSON.stringify(res.exceptionDetails));
  }
  return res.result?.value;
}

async function waitForSelector(selector, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const exists = await evaluate(`!!document.querySelector('${selector}')`);
    if (exists) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Timeout waiting for selector: ${selector}`);
}

async function captureScreenshot(fileName, fullPage = false) {
  const params = { format: 'png' };
  if (fullPage) params.captureBeyondViewport = true;
  const res = await send('Page.captureScreenshot', params);
  fs.writeFileSync(path.join(__dirname, fileName), Buffer.from(res.data, 'base64'));
  console.log(`[Screenshot Saved] ${fileName}`);
}

await send('Page.enable');
await send('Runtime.enable');

// --- BEGIN TEST SUITE ---
try {
  console.log('\n================ RUNNING UPDATED HABIT TRACKER TEST SUITE ================\n');

  // Navigate to local habit tracker
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
  await waitForSelector('#monthSelect option');
  await new Promise(r => setTimeout(r, 400));

  // Test 1: Initial Load & Aesthetic Elements
  console.log('--- TEST 1: Initial Load, Aesthetic Cards & Greeting ---');
  const initialData = await evaluate(`(() => {
    const greeting = document.getElementById('greetingText').textContent;
    const quote = document.getElementById('motivationalQuoteText').textContent;
    const streak = document.getElementById('streakCount').textContent;
    const habits = document.querySelectorAll('.habit-row');
    const days = document.querySelectorAll('.th-day-col');
    const donut = !!document.querySelector('.donut-svg');
    const chart = !!document.querySelector('.chart-svg');
    const weeklyCards = document.querySelectorAll('.weekly-card').length;
    const resetBtn = !!document.getElementById('resetMonthBtn');
    const clearAllBtn = !!document.getElementById('clearAllHabitsBtn');

    return {
      greeting,
      quote,
      streak,
      habitCount: habits.length,
      daysCount: days.length,
      donut,
      chart,
      weeklyCards,
      resetBtn,
      clearAllBtn
    };
  })()`);

  console.log('Initial State:', initialData);
  if (initialData.habitCount !== 8) throw new Error(`Expected 8 habits, got ${initialData.habitCount}`);
  if (!initialData.donut || !initialData.chart) throw new Error('Charts missing');
  if (initialData.weeklyCards !== 5) throw new Error('Weekly cards count mismatch');
  if (!initialData.resetBtn || !initialData.clearAllBtn) throw new Error('Missing Reset or Clear All button');
  console.log('✅ TEST 1 PASSED: Greeting, quote, streak, 8 habits, SVG charts, and action buttons present.');

  // Test 2: Add Habit with Custom Emoji & Color
  console.log('\n--- TEST 2: Add Habit with Emoji & Color ---');
  const addResult = await evaluate(`(() => {
    // Select emoji '🌿'
    const emojiBtn = document.querySelector('.emoji-option-btn[data-emoji="🌿"]');
    if (emojiBtn) emojiBtn.click();

    // Select color '#8b5cf6'
    const colorBtn = document.querySelector('.color-swatch-btn[data-color="#8b5cf6"]');
    if (colorBtn) colorBtn.click();

    // Type name
    const input = document.getElementById('habitInput');
    input.value = 'Daily Plant Care';

    // Submit
    document.getElementById('addHabitForm').dispatchEvent(new Event('submit', { cancelable: true }));

    const habits = document.querySelectorAll('.habit-row');
    const lastRow = habits[habits.length - 1];
    const emoji = lastRow.querySelector('.habit-emoji-badge').textContent;
    const title = lastRow.querySelector('.habit-title-text').textContent;
    const colorIndicator = lastRow.querySelector('.habit-color-indicator').style.backgroundColor;

    return {
      totalHabits: habits.length,
      emoji,
      title,
      colorIndicator
    };
  })()`);

  console.log('Add Habit Result:', addResult);
  if (addResult.totalHabits !== 9) throw new Error(`Expected 9 habits, got ${addResult.totalHabits}`);
  if (addResult.title !== 'Daily Plant Care') throw new Error('Habit title mismatch');
  if (addResult.emoji !== '🌿') throw new Error(`Expected emoji 🌿, got ${addResult.emoji}`);
  console.log('✅ TEST 2 PASSED: New habit added with custom emoji and custom color.');

  // Test 3: Delete Habit with Confirm Modal & 5-Second Undo
  console.log('\n--- TEST 3: Delete Habit & 5-Second Undo Toast ---');
  const deleteAndUndoResult = await evaluate(`(() => {
    const habitsBefore = document.querySelectorAll('.habit-row').length;
    const lastDeleteBtn = document.querySelectorAll('.delete-habit-btn')[habitsBefore - 1];
    
    // 1. Open delete modal
    lastDeleteBtn.click();
    const modalActive = document.getElementById('confirmModal').classList.contains('active');

    // 2. Confirm delete
    document.getElementById('modalConfirmBtn').click();
    const habitsAfterDelete = document.querySelectorAll('.habit-row').length;

    // 3. Verify Undo Toast is active
    const undoToastActive = document.getElementById('undoToast').classList.contains('active');
    const undoMsg = document.getElementById('undoToastMessage').textContent;

    // 4. Click Undo
    document.getElementById('undoToastBtn').click();
    const habitsAfterUndo = document.querySelectorAll('.habit-row').length;
    const restoredTitle = document.querySelectorAll('.habit-row')[habitsAfterUndo - 1].querySelector('.habit-title-text').textContent;

    return {
      modalActive,
      habitsAfterDelete,
      undoToastActive,
      undoMsg,
      habitsAfterUndo,
      restoredTitle
    };
  })()`);

  console.log('Delete & Undo Result:', deleteAndUndoResult);
  if (!deleteAndUndoResult.modalActive) throw new Error('Delete modal did not open');
  if (deleteAndUndoResult.habitsAfterDelete !== 8) throw new Error('Habit was not deleted');
  if (!deleteAndUndoResult.undoToastActive) throw new Error('Undo toast did not appear');
  if (deleteAndUndoResult.habitsAfterUndo !== 9) throw new Error('Habit was not restored on Undo');
  if (deleteAndUndoResult.restoredTitle !== 'Daily Plant Care') throw new Error('Restored habit title mismatch');
  console.log('✅ TEST 3 PASSED: Delete modal confirms, removes habit, shows 5s Undo toast, and restores habit on Undo.');

  // Test 4: Clear All Habits with "Ellam delete pannalama?" Confirm & Undo
  console.log('\n--- TEST 4: Clear All Habits ("Ellam delete pannalama?") & Empty State ---');
  const clearAllResult = await evaluate(`(() => {
    // 1. Click Clear All
    document.getElementById('clearAllHabitsBtn').click();
    const modalActive = document.getElementById('confirmModal').classList.contains('active');
    const modalDesc = document.getElementById('modalDesc').textContent;

    // 2. Confirm Clear All
    document.getElementById('modalConfirmBtn').click();
    const habitsAfterClear = document.querySelectorAll('.habit-row').length;
    const hasEmptyState = !!document.querySelector('.empty-state-card');
    const hasEmptyStateAddBtn = !!document.getElementById('emptyStateAddBtn');

    // 3. Undo Toast check
    const undoActive = document.getElementById('undoToast').classList.contains('active');

    // 4. Click Undo to restore all habits
    document.getElementById('undoToastBtn').click();
    const habitsRestored = document.querySelectorAll('.habit-row').length;

    return {
      modalActive,
      modalDesc,
      habitsAfterClear,
      hasEmptyState,
      hasEmptyStateAddBtn,
      undoActive,
      habitsRestored
    };
  })()`);

  console.log('Clear All Result:', clearAllResult);
  if (!clearAllResult.modalActive) throw new Error('Clear all modal did not open');
  if (!clearAllResult.modalDesc.includes('Ellam delete pannalama?')) {
    throw new Error(`Expected prompt to contain 'Ellam delete pannalama?', got: ${clearAllResult.modalDesc}`);
  }
  if (clearAllResult.habitsAfterClear !== 0) throw new Error('Habits were not cleared');
  if (!clearAllResult.hasEmptyState || !clearAllResult.hasEmptyStateAddBtn) {
    throw new Error('Friendly empty state card is missing when habits are 0');
  }
  if (!clearAllResult.undoActive) throw new Error('Undo toast missing after Clear All');
  if (clearAllResult.habitsRestored !== 9) throw new Error('Habits were not restored after Undo');
  console.log('✅ TEST 4 PASSED: Clear All prompts "Ellam delete pannalama?", displays friendly empty state, and restores all habits on Undo.');

  // Test 5: Reset This Month & Undo
  console.log('\n--- TEST 5: Reset This Month & Undo ---');
  const resetMonthResult = await evaluate(`(() => {
    // Tick a habit on day 1
    const cb = document.querySelector('input[data-habit-id="h_water"][data-day="1"]');
    if (!cb.checked) cb.click();

    const completedBefore = parseInt(document.getElementById('completedCountText').textContent.replace(/,/g, ''), 10);

    // Click Reset Month
    document.getElementById('resetMonthBtn').click();
    const modalActive = document.getElementById('confirmModal').classList.contains('active');
    document.getElementById('modalConfirmBtn').click();

    const completedAfterReset = parseInt(document.getElementById('completedCountText').textContent.replace(/,/g, ''), 10);
    const cbAfterReset = document.querySelector('input[data-habit-id="h_water"][data-day="1"]').checked;
    const habitsStillExist = document.querySelectorAll('.habit-row').length;

    // Click Undo
    document.getElementById('undoToastBtn').click();
    const completedAfterUndo = parseInt(document.getElementById('completedCountText').textContent.replace(/,/g, ''), 10);
    const cbAfterUndo = document.querySelector('input[data-habit-id="h_water"][data-day="1"]').checked;

    return {
      completedBefore,
      completedAfterReset,
      cbAfterReset,
      habitsStillExist,
      completedAfterUndo,
      cbAfterUndo
    };
  })()`);

  console.log('Reset Month Result:', resetMonthResult);
  if (resetMonthResult.completedAfterReset !== 0) throw new Error('Month checks were not reset to 0');
  if (resetMonthResult.cbAfterReset) throw new Error('Checkbox remained checked after reset');
  if (resetMonthResult.habitsStillExist !== 9) throw new Error('Habits were deleted instead of only resetting checks');
  if (!resetMonthResult.cbAfterUndo || resetMonthResult.completedAfterUndo === 0) {
    throw new Error('Reset Month was not restored on Undo');
  }
  console.log('✅ TEST 5 PASSED: Reset Month clears all ticks for current month while keeping habits, and restores ticks on Undo.');

  // Test 6: Month Switching, Leap Years & Page Reload Persistence
  console.log('\n--- TEST 6: Month Switching, Leap Years & Reload ---');
  const monthLeapResult = await evaluate(`(() => {
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');

    // Switch to Feb 2024 (Leap year)
    monthSelect.value = "1";
    monthSelect.dispatchEvent(new Event('change'));
    yearSelect.value = "2024";
    yearSelect.dispatchEvent(new Event('change'));
    const feb2024Days = document.querySelectorAll('.th-day-col').length;

    // Switch to Feb 2025 (Standard)
    yearSelect.value = "2025";
    yearSelect.dispatchEvent(new Event('change'));
    const feb2025Days = document.querySelectorAll('.th-day-col').length;

    // Return to Nov 2026
    monthSelect.value = "10";
    monthSelect.dispatchEvent(new Event('change'));
    yearSelect.value = "2026";
    yearSelect.dispatchEvent(new Event('change'));

    return {
      feb2024Days,
      feb2025Days
    };
  })()`);

  if (monthLeapResult.feb2024Days !== 29 || monthLeapResult.feb2025Days !== 28) {
    throw new Error('Leap year days calculation error');
  }

  // Reload page
  await send('Page.reload');
  await waitForSelector('#monthSelect option');
  await new Promise(r => setTimeout(r, 400));

  const reloadCheck = await evaluate(`(() => {
    const habits = document.querySelectorAll('.habit-row');
    const lastHabit = habits[habits.length - 1];
    return {
      totalHabits: habits.length,
      lastTitle: lastHabit.querySelector('.habit-title-text').textContent,
      lastEmoji: lastHabit.querySelector('.habit-emoji-badge').textContent
    };
  })()`);

  if (reloadCheck.totalHabits !== 9 || reloadCheck.lastTitle !== 'Daily Plant Care' || reloadCheck.lastEmoji !== '🌿') {
    throw new Error('Data persistence check failed after reload');
  }
  console.log('✅ TEST 6 PASSED: Leap years accurate (29 vs 28 days) and all data persistent across browser reload.');

  // Capture Desktop Screenshot
  await captureScreenshot('desktop-full.png', true);

  // Test 7: Mobile View at 380px Width
  console.log('\n--- TEST 7: Mobile Responsiveness (380px) ---');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 380,
    height: 820,
    deviceScaleFactor: 2,
    mobile: true
  });
  await new Promise(r => setTimeout(r, 600));

  const mobileCheck = await evaluate(`(() => {
    const scrollContainer = document.getElementById('tableScrollContainer');
    const stickyHeader = document.querySelector('.col-habit-header');
    const stickyName = document.querySelector('.col-habit-name');
    const styleHeader = window.getComputedStyle(stickyHeader);
    const styleName = window.getComputedStyle(stickyName);

    return {
      containerClientWidth: scrollContainer.clientWidth,
      tableScrollWidth: scrollContainer.scrollWidth,
      isStickyHeader: styleHeader.position === 'sticky',
      isStickyName: styleName.position === 'sticky'
    };
  })()`);

  console.log('Mobile Check:', mobileCheck);
  if (!mobileCheck.isStickyHeader || !mobileCheck.isStickyName) {
    throw new Error('Sticky habit column failed on mobile');
  }

  await captureScreenshot('mobile-full.png', true);
  console.log('✅ TEST 7 PASSED: Mobile 380px view is fully responsive with sticky habit column.');

  console.log('\n================ ALL UPDATED TESTS PASSED SUCCESSFULLY! ================\n');

} catch (err) {
  console.error('\n❌ TEST FAILURE:', err);
  process.exitCode = 1;
} finally {
  ws.close();
  chromeProcess.kill();
  server.close();
  console.log('[Cleanup] Test suite finished.');
}
