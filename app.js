(() => {
  'use strict';

  const STORAGE_KEY = 'unlethargic-state-v1';

  const fmtHM = (mins) => {
    const m = Math.max(0, Math.round(mins));
    const h = Math.floor(m / 60);
    const r = m % 60;
    return `${h}:${String(r).padStart(2, '0')}`;
  };
  const fmtClock = (totalSeconds) => {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
  };
  const uid = () => Math.random().toString(36).slice(2, 10);

  function defaultState() {
    return {
      tasks: [],              // {id, name, due, estMinutes, subtasks:[{id,name,done}], done}
      agenda: [],             // [{taskId, allocMinutes}]
      budgetMinutes: 240,
      confirmed: false,
      focus: {
        index: 0,
        remainingSeconds: 0,
        running: false,
        pausedAt: null,
        wastedSeconds: 0,
        completedIds: [],
      },
      draftSubtasks: [],
    };
  }

  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) { return defaultState(); }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ---------- DOM refs ----------
  const taskNameInput = document.getElementById('taskNameInput');
  const taskDueInput = document.getElementById('taskDueInput');
  const taskHoursInput = document.getElementById('taskHoursInput');
  const taskMinsInput = document.getElementById('taskMinsInput');
  const subtaskList = document.getElementById('subtaskList');
  const addSubtaskBtn = document.getElementById('addSubtaskBtn');
  const addTaskBtn = document.getElementById('addTaskBtn');
  const taskListWrap = document.getElementById('taskListWrap');

  const budgetHoursInput = document.getElementById('budgetHoursInput');
  const dropZone = document.getElementById('dropZone');
  const allocTotal = document.getElementById('allocTotal');
  const remainingRow = document.getElementById('remainingRow');
  const remainingTotal = document.getElementById('remainingTotal');
  const receiptDate = document.getElementById('receiptDate');
  const agendaActions = document.getElementById('agendaActions');
  const planningView = document.getElementById('planningView');
  const focusView = document.getElementById('focusView');
  const wastedRow = document.getElementById('wastedRow');
  const wastedTotal = document.getElementById('wastedTotal');

  receiptDate.textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric'
  }).toUpperCase();

  budgetHoursInput.value = (state.budgetMinutes / 60).toString();

  // ---------- Subtask draft (new task form) ----------
  function renderDraftSubtasks() {
    subtaskList.innerHTML = '';
    state.draftSubtasks.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'subtask-row';
      row.innerHTML = `
        <input type="text" data-i="${i}" value="${escapeAttr(s)}" placeholder="Subtask name" />
        <button class="x-btn" data-i="${i}">×</button>
      `;
      subtaskList.appendChild(row);
    });
    subtaskList.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        state.draftSubtasks[+e.target.dataset.i] = e.target.value;
      });
    });
    subtaskList.querySelectorAll('.x-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state.draftSubtasks.splice(+e.target.dataset.i, 1);
        renderDraftSubtasks();
      });
    });
  }
  addSubtaskBtn.addEventListener('click', () => {
    state.draftSubtasks.push('');
    renderDraftSubtasks();
  });

  addTaskBtn.addEventListener('click', () => {
    const name = taskNameInput.value.trim();
    if (!name) { taskNameInput.focus(); return; }
    const h = parseFloat(taskHoursInput.value) || 0;
    const m = parseFloat(taskMinsInput.value) || 0;
    const est = Math.round(h * 60 + m);
    const subtasks = state.draftSubtasks
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => ({ id: uid(), name: s, done: false }));

    state.tasks.push({
      id: uid(),
      name,
      due: taskDueInput.value || null,
      estMinutes: est,
      subtasks,
      done: false,
    });

    taskNameInput.value = '';
    taskDueInput.value = '';
    taskHoursInput.value = '';
    taskMinsInput.value = '';
    state.draftSubtasks = [];
    renderDraftSubtasks();
    save();
    renderAll();
    taskNameInput.focus();
  });
  taskNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTaskBtn.click();
  });

  renderDraftSubtasks();

  // ---------- Task list (ledger) ----------
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }

  function renderTaskList() {
    taskListWrap.innerHTML = '';
    if (state.tasks.length === 0) {
      taskListWrap.innerHTML = '<div class="empty-note">Nothing on the ledger yet. Add your first task above.</div>';
      return;
    }
    state.tasks.forEach(task => {
      const inAgenda = state.agenda.some(a => a.taskId === task.id);
      const card = document.createElement('div');
      card.className = 'task-card' + (inAgenda ? ' in-agenda' : '') + (task.done ? ' done' : '');
      card.draggable = !state.confirmed;
      card.dataset.taskId = task.id;

      const metaBits = [];
      if (task.due) metaBits.push(`<span class="tag">due ${escapeHtml(task.due)}</span>`);
      if (task.estMinutes) metaBits.push(`<span class="tag">${fmtHM(task.estMinutes)}</span>`);

      let subHtml = '';
      if (task.subtasks.length) {
        subHtml = '<div class="task-sub">' + task.subtasks.map(s => `
          <div class="task-sub-item ${s.done ? 'done' : ''}" data-sub-id="${s.id}" data-task-id="${task.id}">
            <input type="checkbox" ${s.done ? 'checked' : ''} data-sub-id="${s.id}" data-task-id="${task.id}" />
            <span>${escapeHtml(s.name)}</span>
          </div>`).join('') + '</div>';
      }

      card.innerHTML = `
        <div class="task-top">
          <div>
            <div class="task-name ${task.done ? 'strike' : ''}">${escapeHtml(task.name)}</div>
            <div class="task-meta">${metaBits.join('')}</div>
          </div>
          ${inAgenda ? '<span class="in-agenda-badge">in agenda</span>' : `<button class="x-btn" data-remove-task="${task.id}" title="Remove">×</button>`}
        </div>
        ${subHtml}
      `;

      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', task.id);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));

      taskListWrap.appendChild(card);
    });

    taskListWrap.querySelectorAll('[data-remove-task]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.removeTask;
        state.tasks = state.tasks.filter(t => t.id !== id);
        save(); renderAll();
      });
    });
    taskListWrap.querySelectorAll('input[type="checkbox"][data-sub-id]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const t = state.tasks.find(t => t.id === e.target.dataset.taskId);
        const s = t.subtasks.find(s => s.id === e.target.dataset.subId);
        s.done = e.target.checked;
        save(); renderAll();
      });
    });
  }

  // ---------- Drop zone / agenda ----------
  dropZone.addEventListener('dragover', (e) => {
    if (state.confirmed) return;
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (state.confirmed) return;
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    if (state.agenda.some(a => a.taskId === taskId)) return;
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    state.agenda.push({ taskId, allocMinutes: task.estMinutes || 25 });
    save(); renderAll();
  });

  budgetHoursInput.addEventListener('input', () => {
    const h = parseFloat(budgetHoursInput.value);
    state.budgetMinutes = isNaN(h) ? 0 : Math.round(h * 60);
    save(); renderAgenda();
  });

  function renderAgenda() {
    // Rebuild drop zone content (line items) — dropZone itself stays the drop target
    dropZone.innerHTML = '';
    if (state.agenda.length === 0) {
      dropZone.innerHTML = '<div class="empty-note" style="padding:20px 4px;">Drag tasks here to build today\'s agenda</div>';
    } else {
      state.agenda.forEach(item => {
        const task = state.tasks.find(t => t.id === item.taskId);
        if (!task) return;
        const row = document.createElement('div');
        row.className = 'line-item';
        row.innerHTML = `
          <span class="li-name">${escapeHtml(task.name)}</span>
          <span class="li-time">${fmtHM(item.allocMinutes)}</span>
          ${state.confirmed ? '' : `<button class="li-remove" data-remove-agenda="${task.id}">×</button>`}
        `;
        dropZone.appendChild(row);
      });
    }
    dropZone.querySelectorAll('[data-remove-agenda]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.removeAgenda;
        state.agenda = state.agenda.filter(a => a.taskId !== id);
        save(); renderAll();
      });
    });

    const alloc = state.agenda.reduce((sum, a) => sum + a.allocMinutes, 0);
    allocTotal.textContent = fmtHM(alloc);
    const remaining = state.budgetMinutes - alloc;
    remainingTotal.textContent = fmtHM(Math.abs(remaining));
    remainingRow.classList.toggle('over', remaining < 0);
    remainingRow.querySelector('span').textContent = remaining < 0 ? 'OVER BUDGET' : 'REMAINING BUDGET';

    budgetHoursInput.disabled = state.confirmed;
  }

  function confirmAgenda() {
    if (state.agenda.length === 0) return;
    state.confirmed = true;
    state.focus.index = 0;
    state.focus.remainingSeconds = (state.agenda[0]?.allocMinutes || 0) * 60;
    state.focus.running = false;
    state.focus.pausedAt = null;
    state.focus.wastedSeconds = 0;
    state.focus.completedIds = [];
    save();
    renderAll();
  }

  // ---------- Focus / timer ----------
  let tickHandle = null;

  function startTicking() {
    stopTicking();
    tickHandle = setInterval(() => {
      if (!state.focus.running) return;
      if (state.focus.remainingSeconds > 0) {
        state.focus.remainingSeconds -= 1;
      } else {
        advanceTask(true);
      }
      save();
      renderFocus();
    }, 1000);
  }
  function stopTicking() {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;
  }

  function advanceTask(auto) {
    const current = state.agenda[state.focus.index];
    if (current) state.focus.completedIds.push(current.taskId);
    if (state.focus.index < state.agenda.length - 1) {
      state.focus.index += 1;
      state.focus.remainingSeconds = (state.agenda[state.focus.index].allocMinutes || 0) * 60;
      state.focus.running = auto ? true : state.focus.running;
    } else {
      state.focus.running = false;
      state.focus.remainingSeconds = 0;
    }
  }

  function playPause() {
    if (!state.focus.running) {
      // resume: fold accumulated pause time into wasted total
      if (state.focus.pausedAt) {
        const pausedFor = Math.round((Date.now() - state.focus.pausedAt) / 1000);
        state.focus.wastedSeconds += pausedFor;
        state.focus.pausedAt = null;
      }
      state.focus.running = true;
    } else {
      state.focus.running = false;
      state.focus.pausedAt = Date.now();
    }
    save();
    renderFocus();
  }

  function skipTask() {
    advanceTask(false);
    save();
    renderFocus();
  }

  function resetAgenda() {
    state.confirmed = false;
    state.focus = defaultState().focus;
    stopTicking();
    save();
    renderAll();
  }

  function renderFocus() {
    if (!state.confirmed) {
      planningView.style.display = '';
      focusView.style.display = 'none';
      agendaActions.innerHTML = `<button class="primary-btn full" id="confirmBtn" ${state.agenda.length === 0 ? 'disabled' : ''}>Confirm agenda</button>`;
      agendaActions.querySelector('#confirmBtn').addEventListener('click', confirmAgenda);
      wastedRow.style.display = 'none';
      return;
    }
    planningView.style.display = 'none';
    focusView.style.display = '';

    const item = state.agenda[state.focus.index];
    const task = item ? state.tasks.find(t => t.id === item.taskId) : null;
    const totalAlloc = (item?.allocMinutes || 0) * 60;
    const pct = totalAlloc > 0 ? Math.min(100, 100 * (1 - state.focus.remainingSeconds / totalAlloc)) : 100;
    const allDone = state.focus.index >= state.agenda.length - 1 && state.focus.remainingSeconds <= 0 && !state.focus.running && state.focus.completedIds.includes(item?.taskId);

    let extraLines = '';
    state.agenda.forEach((a, i) => {
      const t = state.tasks.find(t => t.id === a.taskId);
      if (!t) return;
      const cls = i === state.focus.index ? 'current' : (state.focus.completedIds.includes(a.taskId) ? 'completed' : '');
      extraLines += `<div class="line-item ${cls}"><span class="li-name">${i === state.focus.index ? '→ ' : ''}${escapeHtml(t.name)}</span><span class="li-time">${fmtHM(a.allocMinutes)}</span></div>`;
    });

    focusView.innerHTML = `
      <div style="font-size:10.5px;letter-spacing:.1em;color:var(--ink-soft);">${state.focus.index + 1} OF ${state.agenda.length}</div>
      <div class="focus-taskname">${task ? escapeHtml(task.name) : 'Agenda complete'}</div>
      <div class="focus-clock ${!state.focus.running ? 'paused' : ''}">${fmtClock(state.focus.remainingSeconds)}</div>
      <div class="focus-progress"><div style="width:${pct}%"></div></div>
      <div class="focus-controls">
        <button class="icon-btn" id="resetBtn" title="Reset agenda">↺</button>
        <button class="icon-btn big" id="playPauseBtn" title="Play/Pause">${state.focus.running ? '⏸' : '▶'}</button>
        <button class="icon-btn" id="skipBtn" title="Skip to next">⏭</button>
      </div>
      <div class="wasted-flag">${!state.focus.running && state.focus.pausedAt ? 'Paused — time is being wasted…' : (state.agenda.length === 0 ? '' : '')}</div>
      <hr class="receipt-divider" />
      <div>${extraLines}</div>
    `;

    focusView.querySelector('#playPauseBtn').addEventListener('click', playPause);
    focusView.querySelector('#skipBtn').addEventListener('click', skipTask);
    focusView.querySelector('#resetBtn').addEventListener('click', resetAgenda);

    wastedRow.style.display = '';
    wastedTotal.textContent = fmtClock(state.focus.wastedSeconds +
      (state.focus.pausedAt ? Math.round((Date.now() - state.focus.pausedAt) / 1000) : 0));

    agendaActions.innerHTML = '';
    startTicking();
  }

  // live-update wasted counter + paused clock every second even while paused
  setInterval(() => {
    if (state.confirmed && !state.focus.running && state.focus.pausedAt) {
      wastedTotal.textContent = fmtClock(state.focus.wastedSeconds +
        Math.round((Date.now() - state.focus.pausedAt) / 1000));
      const flag = focusView.querySelector('.wasted-flag');
      if (flag) flag.textContent = 'Paused — time is being wasted…';
    }
  }, 1000);

  function renderAll() {
    renderTaskList();
    renderAgenda();
    renderFocus();
  }

  renderAll();
})();
