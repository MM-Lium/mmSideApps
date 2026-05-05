/* ============================================================
   SplitEasy — App Logic
   ============================================================ */

// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
const STORAGE_KEY = 'spliteasy_data';

let state = {
  groupName: '新的群組',
  members: [],       // { id, name, lineId, color }
  expenses: [],      // { id, name, amount, date, payerId, participantIds }
};

let editingExpenseId = null;

// Avatar colour palette
const AVATAR_COLORS = [
  '#7c5cfc', '#5c9cfc', '#fc5c9c', '#fcb85c',
  '#5cfcb8', '#fc5c5c', '#5cf0fc', '#c85cfc',
];

// ──────────────────────────────────────────────
// PERSISTENCE
// ──────────────────────────────────────────────
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
    }
  } catch (_) { /* ignore */ }
}

// ──────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function initials(name) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function colorOf(memberId) {
  const idx = state.members.findIndex(m => m.id === memberId);
  return AVATAR_COLORS[idx % AVATAR_COLORS.length] || '#7c5cfc';
}

function memberName(id) {
  return state.members.find(m => m.id === id)?.name || '未知';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}`;
}

function formatAmount(n) {
  return `NT$${Math.abs(n).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// ──────────────────────────────────────────────
// TOAST
// ──────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ──────────────────────────────────────────────
// TABS
// ──────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active);
  });
  document.querySelectorAll('.page').forEach(page => {
    const active = page.id === `page${capitalize(tabName)}Panel`;
    page.classList.toggle('active', active);
  });

  if (tabName === 'settle') renderSettle();
  if (tabName === 'expenses') renderExpenses();
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ──────────────────────────────────────────────
// MEMBERS
// ──────────────────────────────────────────────
function renderMembers() {
  const list = document.getElementById('memberList');
  const empty = document.getElementById('memberEmptyState');
  const badge = document.getElementById('memberCountBadge');

  badge.textContent = `${state.members.length} 人`;

  if (state.members.length === 0) {
    list.innerHTML = '';
    list.appendChild(empty);
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  // Remove old items (keep empty state in DOM)
  list.querySelectorAll('.member-item').forEach(el => el.remove());

  state.members.forEach(member => {
    const item = document.createElement('div');
    item.className = 'member-item';
    item.dataset.id = member.id;

    const color = AVATAR_COLORS[state.members.indexOf(member) % AVATAR_COLORS.length];

    item.innerHTML = `
      <div class="member-avatar" style="background:${color}">${initials(member.name)}</div>
      <div class="member-info">
        <div class="member-name">${escHtml(member.name)}</div>
        ${member.lineId ? `<div class="member-line-id">LINE: ${escHtml(member.lineId)}</div>` : ''}
      </div>
      <div class="member-actions">
        <button class="btn-icon btn-line-icon" aria-label="連結LINE" data-action="line" data-id="${member.id}" title="連結 LINE">🔗</button>
        <button class="btn-icon btn-delete" aria-label="刪除成員" data-action="delete" data-id="${member.id}" title="刪除">🗑</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function addMember() {
  const input = document.getElementById('newMemberName');
  const name = input.value.trim();
  if (!name) { showToast('請輸入成員名稱'); return; }
  if (state.members.some(m => m.name === name)) { showToast('名稱已存在'); return; }
  if (state.members.length >= 20) { showToast('最多 20 位成員'); return; }

  state.members.push({ id: uid(), name, lineId: '' });
  input.value = '';
  saveState();
  renderMembers();
  showToast(`✅ 已新增 ${name}`);
}

function deleteMember(id) {
  const member = state.members.find(m => m.id === id);
  if (!member) return;
  // Check if member has expenses
  const used = state.expenses.some(e => e.payerId === id || e.participantIds.includes(id));
  if (used && !confirm(`「${member.name}」有相關款項，確定刪除？`)) return;

  state.members = state.members.filter(m => m.id !== id);
  saveState();
  renderMembers();
  showToast('已刪除成員');
}

function openLineModal(memberId) {
  const member = state.members.find(m => m.id === memberId);
  if (!member) return;
  document.getElementById('lineModalMemberId').value = memberId;
  document.getElementById('lineIdInput').value = member.lineId || '';
  document.getElementById('lineModalTitle').textContent = `連結 LINE — ${member.name}`;
  openModal('lineModal');
}

function saveLineId() {
  const memberId = document.getElementById('lineModalMemberId').value;
  const lineId = document.getElementById('lineIdInput').value.trim();
  const member = state.members.find(m => m.id === memberId);
  if (!member) return;
  member.lineId = lineId;
  saveState();
  renderMembers();
  closeModal('lineModal');
  showToast(lineId ? `✅ 已儲存 LINE ID` : '已清除 LINE ID');
}

// ──────────────────────────────────────────────
// EXPENSES
// ──────────────────────────────────────────────
function renderExpenses() {
  const list = document.getElementById('expenseList');
  const empty = document.getElementById('expenseEmptyState');
  const badge = document.getElementById('totalAmountBadge');

  const total = state.expenses.reduce((s, e) => s + e.amount, 0);
  badge.textContent = formatAmount(total);

  if (state.expenses.length === 0) {
    list.innerHTML = '';
    list.appendChild(empty);
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';
  list.querySelectorAll('.expense-item').forEach(el => el.remove());

  // Show newest first
  [...state.expenses].reverse().forEach(exp => {
    const payer = state.members.find(m => m.id === exp.payerId);
    const payerColor = payer ? colorOf(payer.id) : '#7c5cfc';
    const payerName = payer ? payer.name : '未知';

    const participants = exp.participantIds.map(pid => {
      const m = state.members.find(x => x.id === pid);
      return m ? m.name : null;
    }).filter(Boolean);

    const tags = participants.map(n => `<span class="expense-tag">${escHtml(n)}</span>`).join('');

    const item = document.createElement('div');
    item.className = 'expense-item';
    item.dataset.id = exp.id;
    item.innerHTML = `
      <div class="expense-top">
        <div>
          <div class="expense-name">${escHtml(exp.name)}</div>
          <div class="expense-date">${formatDate(exp.date)}</div>
        </div>
        <div class="expense-amount">${formatAmount(exp.amount)}</div>
      </div>
      <div class="expense-meta">
        <div class="expense-payer">💳 由 <strong style="color:${payerColor}">${escHtml(payerName)}</strong> 付款</div>
        <div class="expense-tags">${tags}</div>
      </div>
      <div class="expense-actions">
        <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${exp.id}">✏️ 編輯</button>
        <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${exp.id}" style="color:#fc5c5c">🗑 刪除</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function openExpenseModal(expenseId = null) {
  if (state.members.length < 2) {
    showToast('請先新增至少 2 位成員');
    return;
  }

  editingExpenseId = expenseId;
  const isEdit = expenseId !== null;
  document.getElementById('modalTitle').textContent = isEdit ? '編輯款項' : '新增款項';

  let exp = { name: '', amount: '', date: todayString(), payerId: state.members[0]?.id || '', participantIds: state.members.map(m => m.id) };
  if (isEdit) {
    const found = state.expenses.find(e => e.id === expenseId);
    if (found) exp = { ...found };
  }

  document.getElementById('expenseName').value = exp.name;
  document.getElementById('expenseAmount').value = exp.amount || '';
  document.getElementById('expenseDate').value = exp.date || todayString();

  renderPayerSelector(exp.payerId);
  renderParticipantsGrid(exp.participantIds);

  openModal('expenseModal');
}

function renderPayerSelector(selectedId) {
  const container = document.getElementById('payerSelector');
  container.innerHTML = '';
  state.members.forEach((m, idx) => {
    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    const btn = document.createElement('button');
    btn.className = 'payer-chip' + (m.id === selectedId ? ' selected' : '');
    btn.dataset.id = m.id;
    btn.type = 'button';
    btn.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span>${escHtml(m.name)}`;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.payer-chip').forEach(c => c.classList.remove('selected'));
      btn.classList.add('selected');
    });
    container.appendChild(btn);
  });
}

function renderParticipantsGrid(selectedIds) {
  const grid = document.getElementById('participantsGrid');
  grid.innerHTML = '';
  state.members.forEach((m, idx) => {
    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    const isSelected = selectedIds.includes(m.id);
    const chip = document.createElement('button');
    chip.className = 'participant-chip' + (isSelected ? ' selected' : '');
    chip.dataset.id = m.id;
    chip.type = 'button';
    chip.innerHTML = `
      <div class="chip-avatar" style="background:${color}">${initials(m.name)}</div>
      <span>${escHtml(m.name)}</span>
      <span class="participant-check">✓</span>
    `;
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
    grid.appendChild(chip);
  });
}

function getSelectedPayer() {
  return document.querySelector('#payerSelector .payer-chip.selected')?.dataset.id || null;
}

function getSelectedParticipants() {
  return [...document.querySelectorAll('#participantsGrid .participant-chip.selected')].map(c => c.dataset.id);
}

function saveExpense() {
  const name = document.getElementById('expenseName').value.trim();
  const amount = parseFloat(document.getElementById('expenseAmount').value);
  const date = document.getElementById('expenseDate').value;
  const payerId = getSelectedPayer();
  const participantIds = getSelectedParticipants();

  if (!name) { showToast('請輸入款項名稱'); return; }
  if (!amount || amount <= 0) { showToast('請輸入有效金額'); return; }
  if (!payerId) { showToast('請選擇付款人'); return; }
  if (participantIds.length === 0) { showToast('請選擇至少 1 位分攤成員'); return; }

  if (editingExpenseId) {
    const exp = state.expenses.find(e => e.id === editingExpenseId);
    if (exp) Object.assign(exp, { name, amount, date, payerId, participantIds });
  } else {
    state.expenses.push({ id: uid(), name, amount, date, payerId, participantIds });
  }

  saveState();
  renderExpenses();
  closeModal('expenseModal');
  showToast(editingExpenseId ? '✅ 款項已更新' : '✅ 款項已新增');
  editingExpenseId = null;
}

function deleteExpense(id) {
  if (!confirm('確定刪除此款項？')) return;
  state.expenses = state.expenses.filter(e => e.id !== id);
  saveState();
  renderExpenses();
  showToast('已刪除款項');
}

// ──────────────────────────────────────────────
// SETTLE
// ──────────────────────────────────────────────
function computeBalances() {
  // balance[memberId] = net amount (+= receive, -= owe)
  const balance = {};
  state.members.forEach(m => { balance[m.id] = 0; });

  state.expenses.forEach(exp => {
    const { payerId, participantIds, amount } = exp;
    if (!participantIds.length) return;
    const share = amount / participantIds.length;

    // payer gets credit
    balance[payerId] = (balance[payerId] || 0) + amount;
    // each participant owes their share
    participantIds.forEach(pid => {
      balance[pid] = (balance[pid] || 0) - share;
    });
  });

  return balance;
}

function simplifyDebts(balances) {
  // Returns list of { from, to, amount }
  const creditors = [];
  const debtors = [];

  Object.entries(balances).forEach(([id, bal]) => {
    const rounded = Math.round(bal);
    if (rounded > 0) creditors.push({ id, amount: rounded });
    else if (rounded < 0) debtors.push({ id, amount: -rounded });
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i];
    const debt = debtors[j];
    const transfer = Math.min(credit.amount, debt.amount);

    transfers.push({ from: debt.id, to: credit.id, amount: transfer });

    credit.amount -= transfer;
    debt.amount -= transfer;

    if (credit.amount === 0) i++;
    if (debt.amount === 0) j++;
  }

  return transfers;
}

function renderSettle() {
  const balanceList = document.getElementById('balanceList');
  const emptyState = document.getElementById('settleEmptyState');
  const transferCard = document.getElementById('transferCard');
  const transferList = document.getElementById('transferList');

  if (state.members.length === 0 || state.expenses.length === 0) {
    balanceList.innerHTML = '';
    balanceList.appendChild(emptyState);
    emptyState.style.display = 'flex';
    transferCard.style.display = 'none';
    return;
  }
  emptyState.style.display = 'none';
  balanceList.querySelectorAll('.balance-item').forEach(el => el.remove());

  const balances = computeBalances();
  const transfers = simplifyDebts({ ...balances });

  // Render per-person balance
  state.members.forEach((m, idx) => {
    const bal = Math.round(balances[m.id] || 0);
    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    const item = document.createElement('div');
    item.className = 'balance-item';

    let amountClass = bal > 0 ? 'positive' : bal < 0 ? 'negative' : 'zero';
    let amountText = bal > 0 ? `+${formatAmount(bal)}` : bal < 0 ? `-${formatAmount(bal)}` : '已結清';
    let subText = bal > 0 ? '應收' : bal < 0 ? '應付' : '';

    item.innerHTML = `
      <div class="balance-avatar" style="background:${color}">${initials(m.name)}</div>
      <div class="balance-info">
        <div class="balance-name">${escHtml(m.name)}</div>
        ${m.lineId ? `<div class="member-line-id">LINE: ${escHtml(m.lineId)}</div>` : ''}
        <div class="balance-sub">${subText}</div>
      </div>
      <div class="balance-amount ${amountClass}">${amountText}</div>
    `;
    balanceList.appendChild(item);
  });

  // Render transfer suggestions
  if (transfers.length === 0) {
    transferCard.style.display = 'none';
    return;
  }
  transferCard.style.display = 'flex';
  transferCard.style.flexDirection = 'column';
  transferCard.style.gap = '16px';
  transferList.innerHTML = '';

  transfers.forEach(t => {
    const fromMember = state.members.find(m => m.id === t.from);
    const toMember = state.members.find(m => m.id === t.to);
    if (!fromMember || !toMember) return;

    const item = document.createElement('div');
    item.className = 'transfer-item';

    const lineBtn = toMember.lineId
      ? `<button class="transfer-line-btn" data-lineid="${escHtml(toMember.lineId)}" data-amount="${t.amount}" data-from="${escHtml(fromMember.name)}" data-to="${escHtml(toMember.name)}" aria-label="傳LINE訊息">LINE 通知</button>`
      : '';

    item.innerHTML = `
      <span class="transfer-from">${escHtml(fromMember.name)}</span>
      <span class="transfer-arrow">→</span>
      <span class="transfer-to">${escHtml(toMember.name)}</span>
      <span class="transfer-amount">${formatAmount(t.amount)}</span>
      ${lineBtn}
    `;
    transferList.appendChild(item);
  });
}

function shareViaLine() {
  const balances = computeBalances();
  const transfers = simplifyDebts({ ...balances });

  const groupName = state.groupName || 'SplitEasy 分帳';
  let text = `【${groupName}】分帳結算 💸\n\n`;

  if (transfers.length === 0) {
    text += '🎉 大家都結清了！';
  } else {
    text += '📋 轉帳清單：\n';
    transfers.forEach(t => {
      const from = memberName(t.from);
      const to = memberName(t.to);
      text += `• ${from} → ${to}：${formatAmount(t.amount)}\n`;
    });
  }

  text += `\n🔗 由 SplitEasy 產生`;
  const url = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
}

function sendLineNotify(lineId, fromName, toName, amount) {
  const text = `嗨 ${toName}！${fromName} 需要轉給你 ${formatAmount(amount)} 喔 💸（SplitEasy 分帳提醒）`;
  const url = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
}

// ──────────────────────────────────────────────
// MODAL HELPERS
// ──────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// ──────────────────────────────────────────────
// SECURITY
// ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ──────────────────────────────────────────────
// EVENT BINDINGS
// ──────────────────────────────────────────────
function bindEvents() {
  // ── Tab navigation ──
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ── Group name ──
  const groupInput = document.getElementById('groupNameInput');
  groupInput.addEventListener('input', () => {
    state.groupName = groupInput.value.trim() || '新的群組';
    document.getElementById('groupNameDisplay').textContent = state.groupName;
    saveState();
  });

  // ── Add member ──
  document.getElementById('addMemberBtn').addEventListener('click', addMember);
  document.getElementById('newMemberName').addEventListener('keydown', e => {
    if (e.key === 'Enter') addMember();
  });

  // ── Member list actions (delegate) ──
  document.getElementById('memberList').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'delete') deleteMember(id);
    else if (action === 'line') openLineModal(id);
  });

  // ── LINE modal ──
  document.getElementById('saveLineBtn').addEventListener('click', saveLineId);
  document.getElementById('cancelLineModalBtn').addEventListener('click', () => closeModal('lineModal'));
  document.getElementById('closeLineModalBtn').addEventListener('click', () => closeModal('lineModal'));
  document.getElementById('lineIdInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveLineId();
  });
  document.getElementById('lineModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('lineModal');
  });

  // ── Add expense FAB ──
  document.getElementById('addExpenseBtn').addEventListener('click', () => openExpenseModal());

  // ── Expense list actions (delegate) ──
  document.getElementById('expenseList').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit') openExpenseModal(id);
    else if (action === 'delete') deleteExpense(id);
  });

  // ── Expense modal ──
  document.getElementById('saveExpenseBtn').addEventListener('click', saveExpense);
  document.getElementById('cancelModalBtn').addEventListener('click', () => closeModal('expenseModal'));
  document.getElementById('closeModalBtn').addEventListener('click', () => closeModal('expenseModal'));
  document.getElementById('expenseModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('expenseModal');
  });

  // ── Select/Clear all participants ──
  document.getElementById('selectAllParticipants').addEventListener('click', () => {
    document.querySelectorAll('#participantsGrid .participant-chip').forEach(c => c.classList.add('selected'));
  });
  document.getElementById('clearAllParticipants').addEventListener('click', () => {
    document.querySelectorAll('#participantsGrid .participant-chip').forEach(c => c.classList.remove('selected'));
  });

  // ── LINE share (full) ──
  document.getElementById('lineShareBtn').addEventListener('click', shareViaLine);

  // ── Transfer line notify ──
  document.getElementById('transferList').addEventListener('click', e => {
    const btn = e.target.closest('.transfer-line-btn');
    if (!btn) return;
    const { lineid, amount, from, to } = btn.dataset;
    sendLineNotify(lineid, from, to, Number(amount));
  });

  // ── Keyboard close modal ──
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('expenseModal');
      closeModal('lineModal');
    }
  });
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
function init() {
  loadState();

  // Restore group name
  document.getElementById('groupNameInput').value = state.groupName;
  document.getElementById('groupNameDisplay').textContent = state.groupName;

  renderMembers();
  renderExpenses();

  bindEvents();
}

document.addEventListener('DOMContentLoaded', init);
