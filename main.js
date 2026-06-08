// main.js —— 主入口：分步骤向导 + 对比与渲染
import { diffJSON } from './diff.js';
import { renderDiff, summarize } from './render.js';
import { scanArrayKeys, resolveKeyMap, renderKeyChooser } from './arraykey.js';

const $ = (id) => document.getElementById(id);

const elLeft = $('jsonLeft');
const elRight = $('jsonRight');
const elResult = $('diffResult');
const elStatLeft = $('statLeft');
const elStatRight = $('statRight');
const elSummary = $('summaryBar');

// ---------- 本地持久化（localStorage） ----------
const LS_KEY = 'json-diff-state-v1';
const OPT_IDS = ['optIgnoreCase', 'optIgnoreTime', 'optHideSame', 'optCollapseAll'];

// 各对象数组路径 -> 选中的对比主键
let arrayKeyMap = {};
// 最近一次扫描到的对象数组列表
let detectedArrays = [];

// 当前步骤
let currentStep = 1;
const TOTAL_STEPS = 4;

// 保存当前状态：开关 + 左右文本 + 主键映射
function saveState() {
  try {
    const opts = {};
    OPT_IDS.forEach(id => { const el = $(id); if (el) opts[id] = el.checked; });
    const state = {
      opts,
      left: elLeft.value,
      right: elRight.value,
      arrayKeys: arrayKeyMap,
    };
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (_) { /* 忽略存储异常（隐私模式等） */ }
}

// 恢复状态，返回是否成功恢复了文本内容
function restoreState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const state = JSON.parse(raw);
    if (state.opts) {
      OPT_IDS.forEach(id => {
        const el = $(id);
        if (el && typeof state.opts[id] === 'boolean') el.checked = state.opts[id];
      });
    }
    if (state.arrayKeys && typeof state.arrayKeys === 'object') {
      arrayKeyMap = state.arrayKeys;
    }
    const hasText = typeof state.left === 'string' && typeof state.right === 'string'
      && (state.left.trim() || state.right.trim());
    if (hasText) {
      elLeft.value = state.left;
      elRight.value = state.right;
    }
    return !!hasText;
  } catch (_) {
    return false;
  }
}

// 读取当前开关选项
function getOptions() {
  const checked = (id) => { const el = $(id); return el ? el.checked : false; };
  return {
    ignoreCase: checked('optIgnoreCase'),
    ignoreTime: checked('optIgnoreTime'),
    hideSame: checked('optHideSame'),
    collapseAll: checked('optCollapseAll'),
    arrayKeys: arrayKeyMap,
  };
}

// 解析单侧文本，返回 { ok, data, error }
function parseSide(text, statEl) {
  if (!text.trim()) {
    statEl.textContent = '空';
    statEl.className = 'text-xs text-slate-400';
    return { ok: false, empty: true };
  }
  try {
    const data = JSON.parse(text);
    const t = Array.isArray(data) ? `数组(${data.length})` : (typeof data === 'object' && data !== null ? `对象(${Object.keys(data).length} keys)` : typeof data);
    statEl.textContent = '✓ ' + t;
    statEl.className = 'text-xs text-emerald-500';
    return { ok: true, data };
  } catch (e) {
    statEl.textContent = '✗ JSON 解析错误';
    statEl.className = 'text-xs text-rose-500';
    return { ok: false, error: e.message };
  }
}

// ---------- 步骤切换 ----------
function goStep(step) {
  step = Math.max(1, Math.min(TOTAL_STEPS, step));
  currentStep = step;

  // 切换面板显隐
  document.querySelectorAll('.step-panel').forEach(p => {
    p.classList.toggle('hidden', Number(p.dataset.step) !== step);
  });

  // 更新导航条高亮
  document.querySelectorAll('.step-item').forEach(item => {
    const s = Number(item.dataset.step);
    const dot = item.querySelector('.step-dot');
    const title = item.querySelector('.step-title');
    dot.classList.remove('bg-indigo-600', 'text-white', 'bg-emerald-500', 'bg-slate-200', 'text-slate-500');
    if (title) title.classList.remove('text-indigo-700', 'text-emerald-600', 'text-slate-400');
    if (s === step) {
      dot.classList.add('bg-indigo-600', 'text-white');
      dot.innerHTML = s;
      if (title) title.classList.add('text-indigo-700');
    } else if (s < step) {
      dot.classList.add('bg-emerald-500', 'text-white');
      dot.innerHTML = '<i class="ri-check-line"></i>';
      if (title) title.classList.add('text-emerald-600');
    } else {
      dot.classList.add('bg-slate-200', 'text-slate-500');
      dot.innerHTML = s;
      if (title) title.classList.add('text-slate-400');
    }
  });

  // 第3步：渲染主键选择器
  if (step === 3) prepareStep3();
  // 第4步：每次进入都重新对比
  if (step === 4) runCompare();

  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 校验两侧输入是否可对比
function validateInput() {
  const left = parseSide(elLeft.value, elStatLeft);
  const right = parseSide(elRight.value, elStatRight);
  if (!left.ok || !right.ok) {
    const msgs = [];
    if (left.error) msgs.push('左侧：' + left.error);
    if (left.empty) msgs.push('左侧为空');
    if (right.error) msgs.push('右侧：' + right.error);
    if (right.empty) msgs.push('右侧为空');
    alert('无法进入下一步：\n' + msgs.join('\n'));
    return null;
  }
  return { left: left.data, right: right.data };
}

// 第3步准备：扫描对象数组并渲染主键选择
function prepareStep3() {
  const parsed = validateInput();
  const list = $('keyList');
  if (!parsed) {
    detectedArrays = [];
    list.innerHTML = `<div class="text-center text-rose-500 py-10"><i class="ri-error-warning-line text-3xl block mb-2"></i>请先在第二步填写有效的 JSON</div>`;
    return;
  }
  detectedArrays = scanArrayKeys(parsed.left, parsed.right);
  arrayKeyMap = resolveKeyMap(detectedArrays, arrayKeyMap);
  renderKeyChooser(list, detectedArrays, arrayKeyMap, (path, value) => {
    arrayKeyMap[path] = value;
    saveState();
  });
}

// 真正执行对比与渲染（第4步进入时调用）
function runCompare() {
  const parsed = validateInput();
  if (!parsed) {
    elResult.innerHTML = `<div class="text-center text-rose-500 py-12">
      <i class="ri-error-warning-line text-4xl block mb-2"></i>
      无法对比，请返回第二步检查 JSON 输入
    </div>`;
    elSummary.innerHTML = '';
    return;
  }

  // 确保主键映射已就绪（用户可能跳过第3步直接点导航）
  detectedArrays = scanArrayKeys(parsed.left, parsed.right);
  arrayKeyMap = resolveKeyMap(detectedArrays, arrayKeyMap);

  const opts = getOptions();
  const tree = diffJSON(parsed.left, parsed.right, opts);
  renderDiff(elResult, tree, opts);
  saveState();

  const s = summarize(tree);
  elSummary.innerHTML = `
    <span class="flex items-center gap-1 text-emerald-100"><i class="ri-indeterminate-circle-line"></i> 仅A ${s.removed}</span>
    <span class="flex items-center gap-1 text-rose-100"><i class="ri-add-circle-line"></i> 仅B ${s.added}</span>
    <span class="flex items-center gap-1 text-amber-100"><i class="ri-error-warning-line"></i> 值不同 ${s.changed}</span>
    <span class="flex items-center gap-1 text-white/80"><i class="ri-equal-line"></i> 相同 ${s.same}</span>`;
}

// 格式化两侧 JSON
function doFormat() {
  [elLeft, elRight].forEach((el, i) => {
    const stat = i === 0 ? elStatLeft : elStatRight;
    if (!el.value.trim()) return;
    try {
      el.value = JSON.stringify(JSON.parse(el.value), null, 2);
      parseSide(el.value, stat);
    } catch (e) {
      parseSide(el.value, stat);
    }
  });
}

// 示例数据
const SAMPLE_LEFT = {
  name: 'Alice',
  age: 18,
  active: true,
  createdAt: '2024-01-01 10:00:00',
  tags: ['vip', 'new'],
  address: { city: 'Beijing', zip: '100000' },
  scores: [90, 85, 70],
  team: [
    { id: 1, role: 'admin' },
    { id: 2, role: 'user' }
  ]
};
const SAMPLE_RIGHT = {
  name: 'alice',
  age: 20,
  active: true,
  createdAt: '2024-01-01T10:00:00Z',
  tags: ['vip', 'old'],
  address: { city: 'Shanghai', zip: '100000', country: 'CN' },
  scores: [90, 85, 70, 60],
  team: [
    { id: 1, role: 'superadmin' },
    { id: 2, role: 'user' }
  ]
};

function loadSample() {
  elLeft.value = JSON.stringify(SAMPLE_LEFT, null, 2);
  elRight.value = JSON.stringify(SAMPLE_RIGHT, null, 2);
  parseSide(elLeft.value, elStatLeft);
  parseSide(elRight.value, elStatRight);
  saveState();
  goStep(2);
}

function clearAll() {
  elLeft.value = '';
  elRight.value = '';
  arrayKeyMap = {};
  detectedArrays = [];
  elStatLeft.textContent = '等待输入…';
  elStatRight.textContent = '等待输入…';
  elStatLeft.className = elStatRight.className = 'text-xs text-slate-400';
  elSummary.innerHTML = '';
  elResult.innerHTML = `<div class="text-slate-400 text-center py-16">
    <i class="ri-search-eye-line text-5xl block mb-3 opacity-40"></i>
    进入此步骤将自动执行对比
  </div>`;
  saveState();
  goStep(2);
}

// ---------- 事件绑定 ----------
// 防御式绑定：元素不存在时静默跳过，避免 null.addEventListener 崩溃
function on(id, event, handler) {
  const el = $(id);
  if (el) el.addEventListener(event, handler);
}

on('btnSample', 'click', loadSample);
on('btnClear', 'click', clearAll);

// 步骤导航条点击跳转
document.querySelectorAll('.step-item').forEach(item => {
  item.addEventListener('click', () => goStep(Number(item.dataset.step)));
});

// 通用「上一步 / data-goto」按钮
document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => goStep(Number(btn.dataset.goto)));
});

// 第2步 -> 第3步（需校验输入）
on('btnToStep3', 'click', () => {
  if (validateInput()) goStep(3);
});
// 第3步 -> 第4步
on('btnToStep4', 'click', () => goStep(4));
// 第4步「重新对比」
on('btnRecompare', 'click', () => runCompare());

// 本地文件读取：将文件内容读入对应文本框
function readLocalFile(file, targetEl, statEl) {
  if (!file) return;
  const maxSize = 10 * 1024 * 1024; // 限制 10MB
  if (file.size > maxSize) {
    statEl.textContent = '✗ 文件过大(>10MB)';
    statEl.className = 'text-xs text-rose-500';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = String(e.target.result || '');
    try {
      targetEl.value = JSON.stringify(JSON.parse(text), null, 2);
    } catch (_) {
      targetEl.value = text;
    }
    parseSide(targetEl.value, statEl);
    saveState();
  };
  reader.onerror = () => {
    statEl.textContent = '✗ 文件读取失败';
    statEl.className = 'text-xs text-rose-500';
  };
  reader.readAsText(file, 'utf-8');
}

// 左侧文件选择
on('btnFileLeft', 'click', () => $('fileLeft') && $('fileLeft').click());
on('fileLeft', 'change', (e) => {
  readLocalFile(e.target.files[0], elLeft, elStatLeft);
  e.target.value = '';
});

// 右侧文件选择
on('btnFileRight', 'click', () => $('fileRight') && $('fileRight').click());
on('fileRight', 'change', (e) => {
  readLocalFile(e.target.files[0], elRight, elStatRight);
  e.target.value = '';
});

// 开关变化时保存状态；若当前正在第4步则实时重新对比
OPT_IDS.forEach(id => {
  on(id, 'change', () => {
    saveState();
    if (currentStep === 4) runCompare();
  });
});

// 输入时更新状态提示并持久化文本
if (elLeft) elLeft.addEventListener('input', () => { parseSide(elLeft.value, elStatLeft); saveState(); });
if (elRight) elRight.addEventListener('input', () => { parseSide(elRight.value, elStatRight); saveState(); });

// ---------- 初始化 ----------
if (restoreState()) {
  parseSide(elLeft.value, elStatLeft);
  parseSide(elRight.value, elStatRight);
} else {
  // 默认加载示例数据，便于直接体验
  elLeft.value = JSON.stringify(SAMPLE_LEFT, null, 2);
  elRight.value = JSON.stringify(SAMPLE_RIGHT, null, 2);
  parseSide(elLeft.value, elStatLeft);
  parseSide(elRight.value, elStatRight);
  saveState();
}
// 始终从第一步「对比规则」开始
goStep(1);
