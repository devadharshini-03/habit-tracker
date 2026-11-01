/**
 * ============================================================================
 * HABITFLOW — Vanilla JavaScript Aesthetic Habit Tracker
 * ============================================================================
 * Features:
 * - Time-based greeting & rotating motivational quotes
 * - Real-time streak counter (🔥 current streak)
 * - Celebratory canvas confetti shower when all habits for today are completed
 * - Habit management: Emoji picker, color picker, custom colors
 * - "Clear All Habits" with confirm popup ("Ellam delete pannalama?")
 * - Row delete with confirm modal
 * - 5-second "Undo" toast with animated countdown bar for all deletions
 * - "Reset This Month" button to clear only current month checks
 * - Friendly empty state with interactive "Add your first habit" button
 * - Monthly history persistence across all months via LocalStorage
 * - Inline SVG Donut Chart & Daily Progress Line Chart
 * - Google Sheets Pastel Weeks (W1 to W5) with soft pulsing Today column
 * - Custom circular checkboxes filled with each habit's custom color
 * - Wrapped in try/catch for robust data persistence
 * ============================================================================
 */

(function () {
  'use strict';

  // --- Constants & Configurations ---
  const STORAGE_KEY = 'habit_tracker_data';
  const THEME_KEY = 'habit_tracker_theme';

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Motivational quotes collection
  const MOTIVATIONAL_QUOTES = [
    '“Small daily improvements over time lead to stunning results.”',
    '“Consistency is what transforms average into excellence.”',
    '“You do not have to be extreme, just consistent!”',
    '“We are what we repeatedly do. Excellence is a habit.”',
    '“Action is the foundational key to all success.”',
    '“Your future is created by what you do today, not tomorrow.”',
    '“Every strike brings me closer to the next home run.”',
    '“Success is the sum of small efforts repeated day in and day out.”'
  ];

  // Preset Emojis & Colors
  const PRESET_EMOJIS = [
    '💧', '🏃', '😴', '📚', '🧘', '🥗', '🚶', '💻', 
    '🎯', '🌿', '🎨', '🎵', '✍️', '🍵', '💊', '⚡', 
    '🍎', '🚴', '🧹', '🌅', '💰', '🪴', '🥑', '✨'
  ];

  const PRESET_COLORS = [
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f43f5e', // Rose
    '#f97316', // Orange
    '#84cc16'  // Lime
  ];

  // Default preloaded habits for initial run
  const DEFAULT_HABITS = [
    { id: 'h_water', name: 'Drink 2.5L Water', emoji: '💧', color: '#06b6d4' },
    { id: 'h_workout', name: '30 Min Workout', emoji: '🏃', color: '#f97316' },
    { id: 'h_sleep', name: '8 Hours Sleep', emoji: '😴', color: '#8b5cf6' },
    { id: 'h_read', name: 'Read 20 Pages', emoji: '📚', color: '#10b981' },
    { id: 'h_meditate', name: 'Mindfulness Meditation', emoji: '🧘', color: '#ec4899' },
    { id: 'h_diet', name: 'Healthy Eating', emoji: '🥗', color: '#84cc16' },
    { id: 'h_steps', name: '10,000 Steps', emoji: '🚶', color: '#3b82f6' },
    { id: 'h_code', name: 'Daily Coding / Learning', emoji: '💻', color: '#6366f1' }
  ];

  // --- Application State ---
  const state = {
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(), // 0-indexed (0 = Jan, 11 = Dec)
    todayYear: new Date().getFullYear(),
    todayMonth: new Date().getMonth(),
    todayDate: new Date().getDate(),
    habits: [],
    checks: {}, // format: { "YYYY-MM": { habitId: { "dayNum": 1 } } }
    selectedEmoji: '💧',
    selectedColor: '#06b6d4',
    pendingAction: null, // modal callback { title, desc, confirmText, onConfirm }
    undoStack: [], // stores items for undo: { type: 'delete'|'clear_all'|'reset_month', data }
    undoTimer: null
  };

  // --- DOM Element References ---
  const dom = {
    // Greeting & Streak
    greetingText: document.getElementById('greetingText'),
    motivationalQuoteText: document.getElementById('motivationalQuoteText'),
    streakCount: document.getElementById('streakCount'),
    
    // Header Controls
    monthSelect: document.getElementById('monthSelect'),
    yearSelect: document.getElementById('yearSelect'),
    prevMonthBtn: document.getElementById('prevMonthBtn'),
    nextMonthBtn: document.getElementById('nextMonthBtn'),
    todayBtn: document.getElementById('todayBtn'),
    resetMonthBtn: document.getElementById('resetMonthBtn'),
    clearAllHabitsBtn: document.getElementById('clearAllHabitsBtn'),
    themeToggle: document.getElementById('themeToggle'),
    monthBadge: document.getElementById('monthBadge'),
    
    // Stats & Donut
    donutChartContainer: document.getElementById('donutChartContainer'),
    completedCountText: document.getElementById('completedCountText'),
    incompleteCountText: document.getElementById('incompleteCountText'),
    totalChecksText: document.getElementById('totalChecksText'),
    bestHabitText: document.getElementById('bestHabitText'),
    bestDayText: document.getElementById('bestDayText'),
    dailyAvgText: document.getElementById('dailyAvgText'),
    activeHabitsCount: document.getElementById('activeHabitsCount'),
    
    // Weekly Cards & Chart
    weeklyCardsGrid: document.getElementById('weeklyCardsGrid'),
    dailyChartWrapper: document.getElementById('dailyChartWrapper'),
    chartTooltip: document.getElementById('chartTooltip'),
    
    // Add Habit Form & Pickers
    addHabitForm: document.getElementById('addHabitForm'),
    habitInput: document.getElementById('habitInput'),
    addHabitBtn: document.getElementById('addHabitBtn'),
    emojiPickerContainer: document.getElementById('emojiPickerContainer'),
    emojiPickerBtn: document.getElementById('emojiPickerBtn'),
    selectedEmojiDisplay: document.getElementById('selectedEmojiDisplay'),
    emojiPalette: document.getElementById('emojiPalette'),
    emojiGrid: document.getElementById('emojiGrid'),
    customEmojiInput: document.getElementById('customEmojiInput'),
    colorSwatches: document.getElementById('colorSwatches'),
    customColorInput: document.getElementById('customColorInput'),
    
    // Habits Table
    tableScrollContainer: document.getElementById('tableScrollContainer'),
    tableHead: document.getElementById('habitTableHead'),
    tableBody: document.getElementById('habitTableBody'),
    
    // Confirmation Modal
    confirmModal: document.getElementById('confirmModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalDesc: document.getElementById('modalDesc'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    modalConfirmBtn: document.getElementById('modalConfirmBtn'),
    
    // Undo Toast
    undoToast: document.getElementById('undoToast'),
    undoToastMessage: document.getElementById('undoToastMessage'),
    undoToastBtn: document.getElementById('undoToastBtn'),
    undoToastClose: document.getElementById('undoToastClose'),
    undoProgressBar: document.getElementById('undoProgressBar'),
    
    // Confetti Canvas
    confettiCanvas: document.getElementById('confettiCanvas')
  };

  // ==========================================================================
  // 1. DATA STORAGE & PERSISTENCE (With Try/Catch & Migration)
  // ==========================================================================

  /**
   * Safe read from LocalStorage with auto-migration for emojis and colors
   */
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.habits)) {
          state.habits = parsed.habits.map((h, i) => {
            // Auto-migrate legacy habit items if emoji or color are missing
            let name = h.name || '';
            let emoji = h.emoji;
            let color = h.color || PRESET_COLORS[i % PRESET_COLORS.length];

            if (!emoji) {
              // Try to extract emoji from start of name
              const emojiMatch = name.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|\uFE0F|[\u2300-\u23FF])/);
              if (emojiMatch) {
                emoji = emojiMatch[0];
                name = name.replace(emojiMatch[0], '').trim();
              } else {
                emoji = PRESET_EMOJIS[i % PRESET_EMOJIS.length];
              }
            }

            return {
              id: h.id,
              name: name,
              emoji: emoji,
              color: color
            };
          });

          state.checks = parsed.checks || {};
          return;
        }
      }
    } catch (err) {
      console.warn('HabitFlow: Failed to load data from localStorage', err);
    }

    // First load fallback
    seedDefaultData();
  }

  /**
   * Safe write to LocalStorage
   */
  function saveData() {
    try {
      const payload = {
        habits: state.habits,
        checks: state.checks
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error('HabitFlow: Failed to save data to localStorage', err);
    }
  }

  /**
   * Seed realistic initial data on very first launch
   */
  function seedDefaultData() {
    state.habits = JSON.parse(JSON.stringify(DEFAULT_HABITS));
    state.checks = {};

    const monthKey = getMonthKey(state.currentYear, state.currentMonth);
    state.checks[monthKey] = {};

    // Generate initial sample checks up to today
    const maxSampleDay = Math.min(state.todayDate > 0 ? state.todayDate : 10, 14);
    state.habits.forEach((habit, hIdx) => {
      state.checks[monthKey][habit.id] = {};
      for (let day = 1; day <= maxSampleDay; day++) {
        if ((day + hIdx * 2) % 3 !== 0) {
          state.checks[monthKey][habit.id][day] = 1;
        }
      }
    });

    saveData();
  }

  // ==========================================================================
  // 2. DATE & CALENDAR CALCULATIONS (Accurate Leap Years)
  // ==========================================================================

  function getDaysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function getDayOfWeek(year, monthIndex, day) {
    return new Date(year, monthIndex, day).getDay();
  }

  function getMonthKey(year, monthIndex) {
    const formattedMonth = String(monthIndex + 1).padStart(2, '0');
    return `${year}-${formattedMonth}`;
  }

  function getWeekIndexForDay(day) {
    if (day <= 7) return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    if (day <= 28) return 4;
    return 5;
  }

  // ==========================================================================
  // 3. UTILITIES & SANITIZATION
  // ==========================================================================

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ==========================================================================
  // 4. GREETING, MOTIVATION & STREAK COUNTER
  // ==========================================================================

  /**
   * Sets greeting based on local hour and picks inspirational quote
   */
  function updateGreetingAndQuote() {
    const hour = new Date().getHours();
    let greeting = 'Good Morning, Champion! ☀️';
    if (hour >= 12 && hour < 17) {
      greeting = 'Good Afternoon, Achiever! 🌤️';
    } else if (hour >= 17 && hour < 22) {
      greeting = 'Good Evening, Superstar! 🌙';
    } else if (hour >= 22 || hour < 5) {
      greeting = 'Rest Well, Star! ✨';
    }
    dom.greetingText.textContent = greeting;

    // Daily rotating quote
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const quoteIndex = dayOfYear % MOTIVATIONAL_QUOTES.length;
    dom.motivationalQuoteText.textContent = MOTIVATIONAL_QUOTES[quoteIndex];
  }

  /**
   * Calculates consecutive active days streak (days with at least 1 habit completed)
   */
  function calculateStreak() {
    if (state.habits.length === 0) {
      dom.streakCount.textContent = '0';
      return;
    }

    let streak = 0;
    const now = new Date();
    let checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Check if today has at least 1 completion; if not, test yesterday as start of active streak
    const hasCompletionsOnDate = (d) => {
      const y = d.getFullYear();
      const m = d.getMonth();
      const dayNum = d.getDate();
      const mKey = getMonthKey(y, m);
      const mChecks = state.checks[mKey] || {};

      for (let h of state.habits) {
        if (mChecks[h.id] && mChecks[h.id][dayNum]) {
          return true;
        }
      }
      return false;
    };

    if (!hasCompletionsOnDate(checkDate)) {
      // Step 1 day back to see if streak was alive yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Count backwards
    while (hasCompletionsOnDate(checkDate)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      // Failsafe limit to 365 days
      if (streak > 365) break;
    }

    dom.streakCount.textContent = streak;
  }

  // ==========================================================================
  // 5. CELEBRATORY CANVAS CONFETTI
  // ==========================================================================

  let confettiParticles = [];
  let confettiAnimId = null;

  function triggerConfetti() {
    const canvas = dom.confettiCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    confettiParticles = [];
    const colors = ['#6366f1', '#ec4899', '#f43f5e', '#10b981', '#06b6d4', '#f59e0b', '#a855f7'];

    for (let i = 0; i < 110; i++) {
      confettiParticles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.45,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 1.2) * 18,
        size: Math.random() * 8 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 12,
        alpha: 1
      });
    }

    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      for (let p of confettiParticles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.45; // gravity
        p.vx *= 0.98; // drag
        p.rotation += p.rSpeed;
        p.alpha -= 0.009;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.3);
          ctx.restore();
        }
      }

      if (alive) {
        confettiAnimId = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    animate();
  }

  /**
   * Checks if all habits for today are completed; if so, triggers confetti
   */
  function checkTodayCompletionForConfetti() {
    if (state.habits.length === 0) return;
    const monthKey = getMonthKey(state.todayYear, state.todayMonth);
    const mChecks = state.checks[monthKey] || {};

    let doneTodayCount = 0;
    state.habits.forEach(h => {
      if (mChecks[h.id] && mChecks[h.id][state.todayDate]) {
        doneTodayCount++;
      }
    });

    if (doneTodayCount === state.habits.length && state.habits.length > 0) {
      triggerConfetti();
    }
  }

  // ==========================================================================
  // 6. EMOJI & COLOR PICKERS INITIALIZATION
  // ==========================================================================

  function initEmojiAndColorPickers() {
    // Populate Emoji Grid
    dom.emojiGrid.innerHTML = PRESET_EMOJIS.map(emoji => `
      <button type="button" class="emoji-option-btn" data-emoji="${emoji}">${emoji}</button>
    `).join('');

    // Populate Color Swatches
    dom.colorSwatches.innerHTML = PRESET_COLORS.map((color, idx) => `
      <button 
        type="button" 
        class="color-swatch-btn ${idx === 0 ? 'selected' : ''}" 
        style="background: ${color}" 
        data-color="${color}" 
        title="${color}"
      ></button>
    `).join('');

    // Toggle Emoji Palette
    dom.emojiPickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.emojiPalette.classList.toggle('open');
    });

    // Close emoji palette on click outside
    document.addEventListener('click', (e) => {
      if (!dom.emojiPickerContainer.contains(e.target)) {
        dom.emojiPalette.classList.remove('open');
      }
    });

    // Select emoji from grid
    dom.emojiGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.emoji-option-btn');
      if (btn) {
        setEmoji(btn.dataset.emoji);
        dom.emojiPalette.classList.remove('open');
      }
    });

    // Custom emoji input
    dom.customEmojiInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) {
        setEmoji(val);
      }
    });

    // Select color swatch
    dom.colorSwatches.addEventListener('click', (e) => {
      const btn = e.target.closest('.color-swatch-btn');
      if (btn) {
        setColor(btn.dataset.color);
      }
    });

    // Native color picker input
    dom.customColorInput.addEventListener('input', (e) => {
      setColor(e.target.value);
    });
  }

  function setEmoji(emoji) {
    state.selectedEmoji = emoji;
    dom.selectedEmojiDisplay.textContent = emoji;
  }

  function setColor(color) {
    state.selectedColor = color;
    dom.customColorInput.value = color;

    // Update selected class on swatches
    const swatches = dom.colorSwatches.querySelectorAll('.color-swatch-btn');
    swatches.forEach(s => {
      if (s.dataset.color.toLowerCase() === color.toLowerCase()) {
        s.classList.add('selected');
      } else {
        s.classList.remove('selected');
      }
    });
  }

  // ==========================================================================
  // 7. HEADER & NAVIGATION CONTROLS
  // ==========================================================================

  function initHeaderControls() {
    dom.monthSelect.innerHTML = MONTH_NAMES.map((name, idx) => 
      `<option value="${idx}">${name}</option>`
    ).join('');

    const startYear = 2020;
    const endYear = 2032;
    let yearOptions = '';
    for (let y = startYear; y <= endYear; y++) {
      yearOptions += `<option value="${y}">${y}</option>`;
    }
    dom.yearSelect.innerHTML = yearOptions;

    syncHeaderControls();
  }

  function syncHeaderControls() {
    dom.monthSelect.value = state.currentMonth;
    dom.yearSelect.value = state.currentYear;
    dom.monthBadge.textContent = `${MONTH_NAMES[state.currentMonth]} ${state.currentYear}`;
  }

  // ==========================================================================
  // 8. RENDERING: HABIT TABLE (STICKY FIRST COL, WEEKS 1-5, TODAY HIGHLIGHT)
  // ==========================================================================

  function renderTable() {
    const totalDays = getDaysInMonth(state.currentYear, state.currentMonth);
    const monthKey = getMonthKey(state.currentYear, state.currentMonth);
    const monthChecks = state.checks[monthKey] || {};

    const isCurrentCalendarMonth = (
      state.currentYear === state.todayYear && 
      state.currentMonth === state.todayMonth
    );

    // 1. Render Table Header
    let theadHtml = '<tr class="table-header-row">';
    theadHtml += '<th class="th-cell col-habit-header" scope="col">Habit Name</th>';

    for (let day = 1; day <= totalDays; day++) {
      const weekIdx = getWeekIndexForDay(day);
      const dayOfWeekIdx = getDayOfWeek(state.currentYear, state.currentMonth, day);
      const isToday = isCurrentCalendarMonth && (day === state.todayDate);

      const todayClass = isToday ? 'today-column' : '';
      const weekClass = `week-${weekIdx}`;

      theadHtml += `
        <th class="th-cell th-day-col ${weekClass} ${todayClass}" scope="col" title="${MONTH_NAMES[state.currentMonth]} ${day}">
          <div class="day-label-stack">
            <span class="day-num">${day}</span>
            <span class="day-weekday">${DAY_NAMES[dayOfWeekIdx]}</span>
            ${isToday ? '<span class="today-indicator-dot" title="Today"></span>' : ''}
          </div>
        </th>
      `;
    }

    theadHtml += '<th class="th-cell col-progress-header" scope="col">Monthly Progress</th>';
    theadHtml += '<th class="th-cell col-action-header" scope="col">Action</th>';
    theadHtml += '</tr>';

    dom.tableHead.innerHTML = theadHtml;

    // 2. Render Table Body (or Friendly Empty State)
    if (state.habits.length === 0) {
      dom.tableBody.innerHTML = `
        <tr class="table-empty-row">
          <td colspan="${totalDays + 3}">
            <div class="empty-state-card">
              <span class="empty-state-emoji" role="img" aria-label="Sprout">🌱</span>
              <h3 class="empty-state-title">No habits to track yet!</h3>
              <p class="empty-state-desc">Start small, stay consistent. Add your first habit above to begin building the life you want.</p>
              <button type="button" class="empty-state-btn" id="emptyStateAddBtn">
                <span>✨ Add your first habit</span>
              </button>
            </div>
          </td>
        </tr>
      `;
      // Attach click to focus input
      const emptyBtn = document.getElementById('emptyStateAddBtn');
      if (emptyBtn) {
        emptyBtn.addEventListener('click', () => {
          dom.habitInput.focus();
        });
      }
      return;
    }

    let tbodyHtml = '';
    state.habits.forEach((habit, index) => {
      const habitChecks = monthChecks[habit.id] || {};
      let completedDaysCount = 0;

      // Day cells
      let daysHtml = '';
      for (let day = 1; day <= totalDays; day++) {
        const weekIdx = getWeekIndexForDay(day);
        const isToday = isCurrentCalendarMonth && (day === state.todayDate);
        const isChecked = !!habitChecks[day];

        if (isChecked) completedDaysCount++;

        const todayClass = isToday ? 'today-column' : '';
        const weekClass = `week-${weekIdx}`;

        daysHtml += `
          <td class="td-cell ${weekClass} ${todayClass}">
            <label class="checkbox-wrap" aria-label="${escapeHtml(habit.name)} Day ${day}">
              <input 
                type="checkbox" 
                class="habit-checkbox" 
                data-habit-id="${habit.id}" 
                data-day="${day}" 
                style="--habit-color: ${habit.color}"
                ${isChecked ? 'checked' : ''}
              >
            </label>
          </td>
        `;
      }

      const percentage = Math.round((completedDaysCount / totalDays) * 100);

      tbodyHtml += `
        <tr class="habit-row" id="habit-row-${habit.id}" style="--habit-color: ${habit.color}">
          <!-- Sticky Habit Name Column -->
          <td class="td-cell col-habit-name">
            <div class="habit-name-wrapper" title="${escapeHtml(habit.name)}">
              <span class="habit-color-indicator" style="background: ${habit.color}"></span>
              <span class="habit-emoji-badge">${habit.emoji || '🎯'}</span>
              <span class="habit-title-text">${escapeHtml(habit.name)}</span>
            </div>
          </td>

          <!-- Day Columns -->
          ${daysHtml}

          <!-- Per-Habit Progress Column -->
          <td class="td-cell col-progress-cell" id="progress-cell-${habit.id}">
            <div class="habit-progress-wrap">
              <div class="progress-stats-line">
                <span class="progress-fraction">${completedDaysCount}/${totalDays} days</span>
                <span class="progress-percent-text">${percentage}%</span>
              </div>
              <div class="habit-progress-bar-track">
                <div class="habit-progress-bar-fill" style="width: ${percentage}%; background: ${habit.color}"></div>
              </div>
            </div>
          </td>

          <!-- Action / Delete Column -->
          <td class="td-cell col-action-cell">
            <button 
              type="button" 
              class="delete-habit-btn" 
              data-habit-id="${habit.id}" 
              data-habit-name="${escapeHtml(habit.name)}" 
              title="Delete '${escapeHtml(habit.name)}'"
              aria-label="Delete habit"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </td>
        </tr>
      `;
    });

    dom.tableBody.innerHTML = tbodyHtml;
  }

  /**
   * Fast update of a single habit row's progress bar without rebuilding entire DOM table
   */
  function updateSingleHabitProgress(habitId) {
    const totalDays = getDaysInMonth(state.currentYear, state.currentMonth);
    const monthKey = getMonthKey(state.currentYear, state.currentMonth);
    const habitChecks = (state.checks[monthKey] && state.checks[monthKey][habitId]) || {};
    const habit = state.habits.find(h => h.id === habitId);
    const color = habit ? habit.color : 'var(--primary)';
    
    let count = 0;
    for (let day = 1; day <= totalDays; day++) {
      if (habitChecks[day]) count++;
    }

    const percentage = Math.round((count / totalDays) * 100);
    const cell = document.getElementById(`progress-cell-${habitId}`);
    if (cell) {
      cell.innerHTML = `
        <div class="habit-progress-wrap">
          <div class="progress-stats-line">
            <span class="progress-fraction">${count}/${totalDays} days</span>
            <span class="progress-percent-text">${percentage}%</span>
          </div>
          <div class="habit-progress-bar-track">
            <div class="habit-progress-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
          </div>
        </div>
      `;
    }
  }

  // ==========================================================================
  // 9. RENDERING: STATS & OVERALL DONUT CHART
  // ==========================================================================

  function renderStats() {
    const totalDays = getDaysInMonth(state.currentYear, state.currentMonth);
    const monthKey = getMonthKey(state.currentYear, state.currentMonth);
    const monthChecks = state.checks[monthKey] || {};
    const habitCount = state.habits.length;

    const totalPossibleChecks = habitCount * totalDays;
    let completedCount = 0;

    const habitCompletionCounts = {};
    state.habits.forEach(h => { habitCompletionCounts[h.id] = 0; });

    const dailyCounts = new Array(totalDays + 1).fill(0);

    state.habits.forEach(h => {
      const hChecks = monthChecks[h.id] || {};
      for (let day = 1; day <= totalDays; day++) {
        if (hChecks[day]) {
          completedCount++;
          habitCompletionCounts[h.id]++;
          dailyCounts[day]++;
        }
      }
    });

    const incompleteCount = Math.max(0, totalPossibleChecks - completedCount);
    const overallPercentage = totalPossibleChecks > 0 
      ? Math.round((completedCount / totalPossibleChecks) * 100) 
      : 0;

    // Update KPI Text
    dom.completedCountText.textContent = completedCount.toLocaleString();
    dom.incompleteCountText.textContent = incompleteCount.toLocaleString();
    dom.totalChecksText.textContent = totalPossibleChecks.toLocaleString();
    dom.activeHabitsCount.textContent = habitCount;

    const dailyAvg = (completedCount / totalDays).toFixed(1);
    dom.dailyAvgText.textContent = `${dailyAvg} / day`;

    // Best Habit Calculation
    let bestHabitName = '—';
    let maxHabitScore = -1;
    state.habits.forEach(h => {
      if (habitCompletionCounts[h.id] > maxHabitScore && habitCompletionCounts[h.id] > 0) {
        maxHabitScore = habitCompletionCounts[h.id];
        bestHabitName = `${h.emoji || ''} ${h.name}`;
      }
    });
    dom.bestHabitText.textContent = bestHabitName;

    // Best Day Calculation
    let bestDayNum = '—';
    let maxDayCount = 0;
    for (let day = 1; day <= totalDays; day++) {
      if (dailyCounts[day] > maxDayCount) {
        maxDayCount = dailyCounts[day];
        bestDayNum = `Day ${day} (${maxDayCount} done)`;
      }
    }
    dom.bestDayText.textContent = bestDayNum;

    // Donut Chart SVG
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - (overallPercentage / 100));

    dom.donutChartContainer.innerHTML = `
      <svg class="donut-svg" viewBox="0 0 150 150">
        <circle 
          class="donut-bg-circle" 
          cx="75" 
          cy="75" 
          r="${radius}"
        />
        <circle 
          class="donut-fill-circle" 
          cx="75" 
          cy="75" 
          r="${radius}" 
          stroke-dasharray="${circumference}" 
          stroke-dashoffset="${strokeDashoffset}"
        />
      </svg>
      <div class="donut-center-label">
        <div class="donut-percentage">${overallPercentage}%</div>
        <div class="donut-sublabel">Overall</div>
      </div>
    `;

    calculateStreak();
  }

  // ==========================================================================
  // 10. RENDERING: WEEKLY BREAKDOWN CARDS (W1 to W5)
  // ==========================================================================

  function renderWeeklyCards() {
    const totalDays = getDaysInMonth(state.currentYear, state.currentMonth);
    const monthKey = getMonthKey(state.currentYear, state.currentMonth);
    const monthChecks = state.checks[monthKey] || {};
    const habitCount = state.habits.length;

    const weekDefinitions = [
      { week: 1, startDay: 1, endDay: 7, label: 'Days 1–7' },
      { week: 2, startDay: 8, endDay: 14, label: 'Days 8–14' },
      { week: 3, startDay: 15, endDay: 21, label: 'Days 15–21' },
      { week: 4, startDay: 22, endDay: 28, label: 'Days 22–28' },
      { week: 5, startDay: 29, endDay: totalDays, label: `Days 29–${totalDays}` }
    ];

    let cardsHtml = '';

    weekDefinitions.forEach(w => {
      const daysInThisWeek = Math.max(0, w.endDay - w.startDay + 1);
      const possibleInWeek = habitCount * daysInThisWeek;
      let completedInWeek = 0;

      if (daysInThisWeek > 0) {
        state.habits.forEach(h => {
          const hChecks = monthChecks[h.id] || {};
          for (let d = w.startDay; d <= w.endDay; d++) {
            if (hChecks[d]) completedInWeek++;
          }
        });
      }

      const percent = possibleInWeek > 0 
        ? Math.round((completedInWeek / possibleInWeek) * 100) 
        : 0;

      cardsHtml += `
        <div class="weekly-card week-${w.week}">
          <div class="week-card-header">
            <span class="week-tag">Week ${w.week}</span>
            <span class="week-days-range">${w.label}</span>
          </div>
          <div class="week-stats-row">
            <span class="week-percentage">${percent}%</span>
            <span class="week-counts">${completedInWeek}/${possibleInWeek}</span>
          </div>
          <div class="mini-progress-track">
            <div class="mini-progress-fill" style="width: ${percent}%"></div>
          </div>
        </div>
      `;
    });

    dom.weeklyCardsGrid.innerHTML = cardsHtml;
  }

  // ==========================================================================
  // 11. RENDERING: DAILY PROGRESS LINE CHART (INLINE SVG)
  // ==========================================================================

  function renderChart() {
    const totalDays = getDaysInMonth(state.currentYear, state.currentMonth);
    const monthKey = getMonthKey(state.currentYear, state.currentMonth);
    const monthChecks = state.checks[monthKey] || {};
    const habitCount = state.habits.length;

    const isCurrentCalendarMonth = (
      state.currentYear === state.todayYear && 
      state.currentMonth === state.todayMonth
    );

    const svgWidth = 840;
    const svgHeight = 220;
    const padLeft = 45;
    const padRight = 30;
    const padTop = 25;
    const padBottom = 35;

    const plotWidth = svgWidth - padLeft - padRight;
    const plotHeight = svgHeight - padTop - padBottom;

    const dailyData = [];
    for (let day = 1; day <= totalDays; day++) {
      let dayCompleted = 0;
      state.habits.forEach(h => {
        if (monthChecks[h.id] && monthChecks[h.id][day]) {
          dayCompleted++;
        }
      });
      const pct = habitCount > 0 ? (dayCompleted / habitCount) * 100 : 0;
      dailyData.push({ day, pct, count: dayCompleted, total: habitCount });
    }

    let gridLinesHtml = '';
    const gridSteps = [0, 25, 50, 75, 100];
    gridSteps.forEach(val => {
      const yPos = padTop + ((100 - val) / 100) * plotHeight;
      gridLinesHtml += `
        <line class="grid-line" x1="${padLeft}" y1="${yPos}" x2="${svgWidth - padRight}" y2="${yPos}" />
        <text class="axis-text" x="${padLeft - 8}" y="${yPos + 4}" text-anchor="end">${val}%</text>
      `;
    });

    const points = dailyData.map(item => {
      const x = padLeft + ((item.day - 1) / (totalDays - 1)) * plotWidth;
      const y = padTop + ((100 - item.pct) / 100) * plotHeight;
      return { ...item, x, y };
    });

    let xAxisLabelsHtml = '';
    points.forEach(pt => {
      if (pt.day === 1 || pt.day % 5 === 0 || pt.day === totalDays) {
        xAxisLabelsHtml += `
          <text class="axis-text" x="${pt.x}" y="${svgHeight - 12}" text-anchor="middle">Day ${pt.day}</text>
        `;
      }
    });

    const linePointsStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    const areaPathD = `
      M ${padLeft},${padTop + plotHeight} 
      L ${points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')} 
      L ${svgWidth - padRight},${padTop + plotHeight} Z
    `;

    let todayMarkerHtml = '';
    if (isCurrentCalendarMonth && state.todayDate <= totalDays) {
      const todayPt = points[state.todayDate - 1];
      if (todayPt) {
        todayMarkerHtml = `
          <line class="chart-today-line" x1="${todayPt.x}" y1="${padTop}" x2="${todayPt.x}" y2="${padTop + plotHeight}" />
          <text class="chart-today-tag" x="${todayPt.x}" y="${padTop - 8}" text-anchor="middle">TODAY</text>
        `;
      }
    }

    let circlesHtml = '';
    points.forEach(pt => {
      circlesHtml += `
        <circle 
          class="chart-data-point" 
          cx="${pt.x.toFixed(1)}" 
          cy="${pt.y.toFixed(1)}" 
          r="4.5"
          data-day="${pt.day}"
          data-pct="${Math.round(pt.pct)}"
          data-count="${pt.count}"
          data-total="${pt.total}"
          tabindex="0"
          aria-label="Day ${pt.day}: ${Math.round(pt.pct)}% (${pt.count}/${pt.total} done)"
        />
      `;
    });

    dom.dailyChartWrapper.innerHTML = `
      <svg class="chart-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart-area-start)" />
            <stop offset="100%" stop-color="var(--chart-area-end)" />
          </linearGradient>
        </defs>

        ${gridLinesHtml}
        <path class="chart-area-path" d="${areaPathD}" />
        <polyline class="chart-line-path" points="${linePointsStr}" />
        ${todayMarkerHtml}
        ${circlesHtml}
        ${xAxisLabelsHtml}
      </svg>
    `;

    attachChartTooltipEvents();
  }

  function attachChartTooltipEvents() {
    const points = dom.dailyChartWrapper.querySelectorAll('.chart-data-point');
    const tooltip = dom.chartTooltip;

    points.forEach(pt => {
      const showTooltip = () => {
        const day = pt.dataset.day;
        const pct = pt.dataset.pct;
        const count = pt.dataset.count;
        const total = pt.dataset.total;

        const dayOfWeekIdx = getDayOfWeek(state.currentYear, state.currentMonth, parseInt(day, 10));
        const dayOfWeek = DAY_NAMES[dayOfWeekIdx];

        tooltip.innerHTML = `<strong>Day ${day} (${dayOfWeek})</strong>: ${pct}% • ${count}/${total} done`;

        const ptRect = pt.getBoundingClientRect();
        const wrapperRect = dom.dailyChartWrapper.getBoundingClientRect();

        const leftOffset = ptRect.left - wrapperRect.left + (ptRect.width / 2);
        const topOffset = ptRect.top - wrapperRect.top;

        tooltip.style.left = `${leftOffset}px`;
        tooltip.style.top = `${topOffset}px`;
        tooltip.classList.add('visible');
      };

      const hideTooltip = () => {
        tooltip.classList.remove('visible');
      };

      pt.addEventListener('mouseenter', showTooltip);
      pt.addEventListener('mouseleave', hideTooltip);
      pt.addEventListener('focus', showTooltip);
      pt.addEventListener('blur', hideTooltip);
      pt.addEventListener('touchstart', showTooltip, { passive: true });
    });
  }

  // ==========================================================================
  // 12. COMPLETE APP RENDER COORDINATOR
  // ==========================================================================

  function renderApp() {
    updateGreetingAndQuote();
    syncHeaderControls();
    renderTable();
    renderStats();
    renderWeeklyCards();
    renderChart();
  }

  // ==========================================================================
  // 13. CONFIRMATION MODAL & UNDO TOAST LOGIC
  // ==========================================================================

  /**
   * Opens confirmation modal with custom title, desc, button text, and action callback
   */
  function showConfirmModal({ title, desc, confirmText = 'Proceed', onConfirm }) {
    state.pendingAction = onConfirm;
    dom.modalTitle.textContent = title;
    dom.modalDesc.textContent = desc;
    dom.modalConfirmBtn.textContent = confirmText;
    dom.confirmModal.classList.add('active');
    dom.confirmModal.setAttribute('aria-hidden', 'false');
    dom.modalConfirmBtn.focus();
  }

  function closeConfirmModal() {
    state.pendingAction = null;
    dom.confirmModal.classList.remove('active');
    dom.confirmModal.setAttribute('aria-hidden', 'true');
  }

  /**
   * Displays 5-second Undo Toast
   */
  function showUndoToast(message, undoAction) {
    clearTimeout(state.undoTimer);

    // Save action to stack
    state.undoStack.push(undoAction);

    dom.undoToastMessage.textContent = message;
    dom.undoToast.classList.add('active');
    dom.undoToast.setAttribute('aria-hidden', 'false');

    // Reset progress bar animation
    dom.undoProgressBar.style.animation = 'none';
    dom.undoProgressBar.offsetHeight; // trigger reflow
    dom.undoProgressBar.style.animation = 'countdown 5s linear forwards';

    state.undoTimer = setTimeout(() => {
      closeUndoToast();
    }, 5000);
  }

  function closeUndoToast() {
    clearTimeout(state.undoTimer);
    dom.undoToast.classList.remove('active');
    dom.undoToast.setAttribute('aria-hidden', 'true');
  }

  function handleUndo() {
    if (state.undoStack.length === 0) return;
    const action = state.undoStack.pop();

    if (action.type === 'delete_habit') {
      // Restore deleted habit
      state.habits.splice(action.index, 0, action.habit);
      // Restore checks
      Object.keys(action.checks).forEach(mKey => {
        if (!state.checks[mKey]) state.checks[mKey] = {};
        state.checks[mKey][action.habit.id] = action.checks[mKey];
      });
    } else if (action.type === 'clear_all') {
      // Restore all habits and all checks
      state.habits = action.habits;
      state.checks = action.checks;
    } else if (action.type === 'reset_month') {
      // Restore monthly checks
      state.checks[action.monthKey] = action.checks;
    }

    saveData();
    renderApp();
    closeUndoToast();
  }

  // ==========================================================================
  // 14. HABIT ACTIONS: CHECK, ADD, DELETE, CLEAR ALL, RESET MONTH
  // ==========================================================================

  function handleTableChange(e) {
    if (e.target && e.target.classList.contains('habit-checkbox')) {
      const habitId = e.target.dataset.habitId;
      const day = e.target.dataset.day;
      const isChecked = e.target.checked;
      const monthKey = getMonthKey(state.currentYear, state.currentMonth);

      if (!state.checks[monthKey]) state.checks[monthKey] = {};
      if (!state.checks[monthKey][habitId]) state.checks[monthKey][habitId] = {};

      if (isChecked) {
        state.checks[monthKey][habitId][day] = 1;
      } else {
        delete state.checks[monthKey][habitId][day];
      }

      saveData();
      updateSingleHabitProgress(habitId);
      renderStats();
      renderWeeklyCards();
      renderChart();

      // Check for confetti celebration if checking for today
      if (isChecked && parseInt(day, 10) === state.todayDate && 
          state.currentYear === state.todayYear && 
          state.currentMonth === state.todayMonth) {
        checkTodayCompletionForConfetti();
      }
    }
  }

  function handleTableClick(e) {
    const deleteBtn = e.target.closest('.delete-habit-btn');
    if (deleteBtn) {
      const habitId = deleteBtn.dataset.habitId;
      const habitName = deleteBtn.dataset.habitName || 'this habit';
      promptDeleteSingleHabit(habitId, habitName);
    }
  }

  /**
   * Delete single habit with confirm modal & 5-second undo toast
   */
  function promptDeleteSingleHabit(habitId, habitName) {
    showConfirmModal({
      title: 'Delete Habit?',
      desc: `Are you sure you want to delete "${habitName}"? All tracking data for this habit will be removed.`,
      confirmText: 'Delete Habit',
      onConfirm: () => {
        const habitIndex = state.habits.findIndex(h => h.id === habitId);
        if (habitIndex === -1) return;
        const deletedHabit = state.habits[habitIndex];

        // Backup checks for this habit across all months
        const habitChecksBackup = {};
        Object.keys(state.checks).forEach(mKey => {
          if (state.checks[mKey] && state.checks[mKey][habitId]) {
            habitChecksBackup[mKey] = JSON.parse(JSON.stringify(state.checks[mKey][habitId]));
            delete state.checks[mKey][habitId];
          }
        });

        // Remove habit
        state.habits.splice(habitIndex, 1);
        saveData();
        renderApp();

        // 5-second Undo Toast
        showUndoToast(`Deleted "${deletedHabit.name}"`, {
          type: 'delete_habit',
          index: habitIndex,
          habit: deletedHabit,
          checks: habitChecksBackup
        });
      }
    });
  }

  /**
   * Clear All Habits with confirm prompt: "Ellam delete pannalama?"
   */
  function promptClearAllHabits() {
    if (state.habits.length === 0) return;

    showConfirmModal({
      title: 'Clear All Habits?',
      desc: 'Ellam delete pannalama? This will remove every habit and all check records.',
      confirmText: 'Yes, Clear All',
      onConfirm: () => {
        // Backup for Undo
        const habitsBackup = JSON.parse(JSON.stringify(state.habits));
        const checksBackup = JSON.parse(JSON.stringify(state.checks));

        state.habits = [];
        state.checks = {};
        saveData();
        renderApp();

        // 5-second Undo Toast
        showUndoToast('All habits cleared', {
          type: 'clear_all',
          habits: habitsBackup,
          checks: checksBackup
        });
      }
    });
  }

  /**
   * Reset This Month (clears ticks for selected month, habits remain)
   */
  function promptResetMonth() {
    const monthKey = getMonthKey(state.currentYear, state.currentMonth);
    const monthName = MONTH_NAMES[state.currentMonth];
    const year = state.currentYear;

    showConfirmModal({
      title: 'Reset This Month?',
      desc: `Reset all checks for ${monthName} ${year}? All your habits will remain intact.`,
      confirmText: 'Reset Month',
      onConfirm: () => {
        const checksBackup = JSON.parse(JSON.stringify(state.checks[monthKey] || {}));

        state.checks[monthKey] = {};
        saveData();
        renderApp();

        // 5-second Undo Toast
        showUndoToast(`Reset checks for ${monthName}`, {
          type: 'reset_month',
          monthKey: monthKey,
          checks: checksBackup
        });
      }
    });
  }

  /**
   * Add a new habit with chosen emoji and color
   */
  function handleAddHabit(e) {
    if (e) e.preventDefault();

    const name = dom.habitInput.value.trim();
    if (!name) {
      dom.habitInput.focus();
      return;
    }

    const newHabit = {
      id: 'h_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: name,
      emoji: state.selectedEmoji || '🎯',
      color: state.selectedColor || '#06b6d4'
    };

    state.habits.push(newHabit);
    saveData();

    dom.habitInput.value = '';
    renderApp();

    // Scroll to new row smoothly
    const newRow = document.getElementById(`habit-row-${newHabit.id}`);
    if (newRow) {
      newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Month navigation
   */
  function changeMonth(delta) {
    let newMonth = state.currentMonth + delta;
    let newYear = state.currentYear;

    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }

    state.currentMonth = newMonth;
    state.currentYear = newYear;

    renderApp();
  }

  function jumpToTodayMonth() {
    state.currentMonth = state.todayMonth;
    state.currentYear = state.todayYear;
    renderApp();
  }

  // ==========================================================================
  // 15. THEME TOGGLE (LIGHT / DARK NEON-PURPLE)
  // ==========================================================================

  function initTheme() {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem(THEME_KEY);
    } catch (e) {}

    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch (e) {}
  }

  // ==========================================================================
  // 16. EVENT BINDINGS & APP INITIALIZATION
  // ==========================================================================

  function bindEvents() {
    // Header Selects
    dom.monthSelect.addEventListener('change', (e) => {
      state.currentMonth = parseInt(e.target.value, 10);
      renderApp();
    });

    dom.yearSelect.addEventListener('change', (e) => {
      state.currentYear = parseInt(e.target.value, 10);
      renderApp();
    });

    // Month Navigation & Management Buttons
    dom.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    dom.nextMonthBtn.addEventListener('click', () => changeMonth(1));
    dom.todayBtn.addEventListener('click', jumpToTodayMonth);
    dom.resetMonthBtn.addEventListener('click', promptResetMonth);
    dom.clearAllHabitsBtn.addEventListener('click', promptClearAllHabits);
    dom.themeToggle.addEventListener('click', toggleTheme);

    // Add Habit Form
    dom.addHabitForm.addEventListener('submit', handleAddHabit);

    // Table Event Delegation (Checkbox toggles & Delete clicks)
    dom.tableBody.addEventListener('change', handleTableChange);
    dom.tableBody.addEventListener('click', handleTableClick);

    // Modal Events
    dom.modalCancelBtn.addEventListener('click', closeConfirmModal);
    dom.modalConfirmBtn.addEventListener('click', () => {
      if (typeof state.pendingAction === 'function') {
        const action = state.pendingAction;
        closeConfirmModal();
        action();
      } else {
        closeConfirmModal();
      }
    });

    dom.confirmModal.addEventListener('click', (e) => {
      if (e.target === dom.confirmModal) closeConfirmModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.confirmModal.classList.contains('active')) {
        closeConfirmModal();
      }
    });

    // Undo Toast Events
    dom.undoToastBtn.addEventListener('click', handleUndo);
    dom.undoToastClose.addEventListener('click', closeUndoToast);

    // Window Resize chart redraw
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderChart();
      }, 150);
    });
  }

  function init() {
    initTheme();
    loadData();
    initHeaderControls();
    initEmojiAndColorPickers();
    bindEvents();
    renderApp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
