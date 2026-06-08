// main.js —— 主入口：分步骤向导 + 对比与渲染
import { diffJSON } from './diff.js';
import { renderDiff, summarize, collectDiffPaths, aggregateByKey } from './render.js';
import { scanArrayKeys, resolveKeyMap, renderKeyChooser } from './arraykey.js';
import { scanLeftPaths, applyFieldFill, previewValue, collectFieldValueStats } from './fieldfill.js';

const $ = (id) => document.getElementById(id);

const elLeft = $('jsonLeft');
const elRight = $('jsonRight');
const elResult = $('diffResult');
const elStatLeft = $('statLeft');
const elStatRight = $('statRight');
const elLegend = $('legendBar');

// 左右两侧选择的文件名（路径/来源），用于展示与持久化
let fileNames = { left: '', right: '' };

// ---------- 本地持久化（localStorage） ----------
const LS_KEY = 'json-diff-state-v1';
// 按「文件内容指纹」分桶存储主键映射：{ 指纹: { 数组路径: 主键 } }
const LS_KEYSTORE = 'json-diff-arraykeys-v1';
// 按「左侧文件名」分桶存储第5步已选回填字段：{ 左侧文件名: [字段路径...] }
const LS_FILLSTORE = 'json-diff-fillfields-v1';
const OPT_IDS = ['optIgnoreCase', 'optIgnoreTime', 'optHideSame', 'optCollapseAll', 'optStripPrefix'];

// 各对象数组路径 -> 选中的对比主键
let arrayKeyMap = {};
// 最近一次扫描到的对象数组列表
let detectedArrays = [];

// 计算字符串的简易哈希（djb2），用作文件内容指纹
function hashText(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// 基于左右两侧 JSON 文本生成「这组文件」的唯一指纹
// 规范化：解析成对象后再 stringify，忽略缩进/空白差异，确保内容相同即指纹相同
function currentFileFingerprint() {
  const norm = (text) => {
    try { return JSON.stringify(JSON.parse(text)); }
    catch (_) { return (text || '').trim(); }
  };
  return hashText(norm(elLeft.value) + '\u0000' + norm(elRight.value));
}

// 读取整个主键存储桶 { 指纹: {路径:主键} }
function loadKeyStore() {
  try {
    const raw = localStorage.getItem(LS_KEYSTORE);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch (_) { return {}; }
}

// 写回整个主键存储桶
function saveKeyStore(store) {
  try { localStorage.setItem(LS_KEYSTORE, JSON.stringify(store)); } catch (_) {}
}

// 取出「当前这组文件」此前保存过的主键映射
function getSavedKeysForCurrentFiles() {
  const store = loadKeyStore();
  const fp = currentFileFingerprint();
  return (store[fp] && typeof store[fp] === 'object') ? store[fp] : {};
}

// 将当前主键映射按「当前这组文件」的指纹持久化
function persistKeysForCurrentFiles() {
  const store = loadKeyStore();
  store[currentFileFingerprint()] = Object.assign({}, arrayKeyMap);
  saveKeyStore(store);
}

// ---- 第5步：按「左侧文件名」持久化已选回填字段 ----
// 桶键：优先用左侧文件名；无文件名（手动输入/示例）时回退为左侧内容指纹，保证仍可缓存
function fillBucketKey() {
  if (fileNames.left && fileNames.left.trim()) return 'name:' + fileNames.left.trim();
  const norm = (() => {
    try { return JSON.stringify(JSON.parse(elLeft.value)); }
    catch (_) { return (elLeft.value || '').trim(); }
  })();
  return 'fp:' + hashText(norm);
}

// 读取整个已选字段存储桶 { 桶键: [字段路径...] }
function loadFillStore() {
  try {
    const raw = localStorage.getItem(LS_FILLSTORE);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch (_) { return {}; }
}

// 取出「当前左侧文件」此前保存过的已选字段路径数组
function getSavedFillForLeftFile() {
  const store = loadFillStore();
  const arr = store[fillBucketKey()];
  return Array.isArray(arr) ? arr : [];
}

// 将当前 fillSelected 按「当前左侧文件」持久化
function persistFillForLeftFile() {
  try {
    const store = loadFillStore();
    store[fillBucketKey()] = Array.from(fillSelected);
    localStorage.setItem(LS_FILLSTORE, JSON.stringify(store));
  } catch (_) { /* 忽略存储异常 */ }
}

// 最近一次对比收集到的差异全路径列表 { added:[], removed:[], changed:[] }
let diffPaths = { added: [], removed: [], changed: [] };
// 抽屉分页状态
const PAGE_SIZE = 12;
let drawerState = { type: null, list: [], page: 1 };

// 当前步骤
let currentStep = 1;
const TOTAL_STEPS = 5;

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
      fileNames,
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
    if (state.fileNames && typeof state.fileNames === 'object') {
      fileNames = { left: state.fileNames.left || '', right: state.fileNames.right || '' };
      renderFileNames();
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

// 渲染左右两侧选择的文件名/路径（无则手动输入提示）
function renderFileNames() {
  const conf = [
    { side: 'left', boxId: 'fileNameLeft' },
    { side: 'right', boxId: 'fileNameRight' },
  ];
  conf.forEach(({ side, boxId }) => {
    const box = $(boxId);
    if (!box) return;
    const span = box.querySelector('span');
    const name = fileNames[side];
    if (name) {
      if (span) { span.textContent = name; span.title = name; }
      box.classList.remove('hidden');
      box.classList.add('flex');
    } else {
      if (span) { span.textContent = ''; span.title = ''; }
      box.classList.add('hidden');
      box.classList.remove('flex');
    }
  });
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
  // 第5步：准备字段回填（扫描左侧字段路径）
  if (step === 5) prepareStep5();

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
  // 优先用「当前这组文件」此前保存的主键映射来恢复（相同文件、相同数组刷新后自动套用）
  const savedForFiles = getSavedKeysForCurrentFiles();
  const baseMap = Object.assign({}, savedForFiles, arrayKeyMap);
  arrayKeyMap = resolveKeyMap(detectedArrays, baseMap);
  // 恢复后立即按文件指纹回写一次，保证后续刷新可命中
  persistKeysForCurrentFiles();
  renderKeyChooser(list, detectedArrays, arrayKeyMap, (path, value) => {
    arrayKeyMap[path] = value;
    saveState();
    persistKeysForCurrentFiles();
    // renderKeyChooser 内部点击会重渲染列表，恢复当前数组高亮
    if (detectedArrays.length > 1) {
      // 将「当前数组」定位到刚选择的这个数组（用户可能点的不是当前高亮项）
      const selIdx = detectedArrays.findIndex(a => a.path === path);
      if (selIdx >= 0) curArrIndex = selIdx;
      // 选定主键后，若还有后续数组则自动前进到下一个待选数组
      if (curArrIndex < detectedArrays.length - 1) {
        curArrIndex += 1;
      }
      // onChange 触发后 renderKeyChooser 会立即重渲染列表（重建 DOM），
      // 故延迟到下一帧再更新导航高亮与滚动定位，避免被覆盖
      requestAnimationFrame(() => updateArrNav());
    }
  });
  setupArrNav();
}

// ---------- 第3步：多数组快速切换导航 ----------
let curArrIndex = 0;

function setupArrNav() {
  const nav = $('arrNav');
  const total = detectedArrays.length;
  if (!nav) return;
  // 仅当存在 1 个以上对象数组时才显示导航
  if (total <= 1) {
    nav.classList.add('hidden');
    nav.classList.remove('flex');
    return;
  }
  nav.classList.remove('hidden');
  nav.classList.add('flex');
  curArrIndex = 0;
  updateArrNav();
}

// 高亮当前数组卡片并更新计数 / 按钮可用状态
function updateArrNav() {
  const total = detectedArrays.length;
  const curEl = $('arrCur'); if (curEl) curEl.textContent = curArrIndex + 1;
  const totEl = $('arrTotal'); if (totEl) totEl.textContent = total;
  const prev = $('btnPrevArr'); if (prev) prev.disabled = curArrIndex <= 0;
  const next = $('btnNextArr'); if (next) next.disabled = curArrIndex >= total - 1;

  // 卡片高亮
  document.querySelectorAll('#keyList .key-array-block').forEach(card => {
    const isCur = Number(card.dataset.arrIndex) === curArrIndex;
    card.classList.toggle('ring-2', isCur);
    card.classList.toggle('ring-indigo-400', isCur);
    card.classList.toggle('shadow-md', isCur);
  });

  // 滚动定位到当前卡片
  const target = $('arrCard' + curArrIndex);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function gotoArr(delta) {
  const total = detectedArrays.length;
  if (!total) return;
  curArrIndex = Math.max(0, Math.min(total - 1, curArrIndex + delta));
  updateArrNav();
}

// 真正执行对比与渲染（第4步进入时调用）
function runCompare() {
  const parsed = validateInput();
  if (!parsed) {
    elResult.innerHTML = `<div class="text-center text-rose-500 py-12">
      <i class="ri-error-warning-line text-4xl block mb-2"></i>
      无法对比，请返回第二步检查 JSON 输入
    </div>`;
    if (elLegend) elLegend.innerHTML = '';
    return;
  }

  // 确保主键映射已就绪（用户可能跳过第3步直接点导航）
  detectedArrays = scanArrayKeys(parsed.left, parsed.right);
  const savedForFiles = getSavedKeysForCurrentFiles();
  arrayKeyMap = resolveKeyMap(detectedArrays, Object.assign({}, savedForFiles, arrayKeyMap));
  persistKeysForCurrentFiles();

  const opts = getOptions();
  const tree = diffJSON(parsed.left, parsed.right, opts);
  renderDiff(elResult, tree, opts);
  saveState();

  // 收集差异全路径，供抽屉列表与 key 维度统计使用
  diffPaths = collectDiffPaths(tree);

  const s = summarize(tree);
  renderLegend(s);
}

// ---------- 第5步：字段回填 ----------
// 左侧扫描到的全部字段路径（含主键标记）
let fillPaths = [];
// 已选中的字段路径集合
let fillSelected = new Set();
// 最近一次回填结果文本（供复制/下载）
let lastFillResultText = '';
// 两个对比 tab 各自的差异路径缓存（与第3/4步 diffPaths 同结构），用于图例点击抽屉
let fillDiffPaths = { left: { added: [], removed: [], changed: [] }, right: { added: [], removed: [], changed: [] } };
// 字段值统计弹窗状态
let fieldStatState = { path: '', stats: [], total: 0, page: 1, pageSize: 10 };

// 进入第5步：扫描左侧字段并渲染列表
function prepareStep5() {
  const wrap = $('fillAvailList');
  const parsed = validateInput();
  if (!parsed) {
    fillPaths = [];
    fillSelected.clear();
    if (wrap) wrap.innerHTML = `<div class="text-center text-rose-500 py-10"><i class="ri-error-warning-line text-3xl block mb-2"></i>请先在第二步填写有效的 JSON</div>`;
    hideFillResult();
    updateFillSelCount();
    return;
  }

  // 确保主键映射已就绪（用户可能跳过第3步）
  detectedArrays = scanArrayKeys(parsed.left, parsed.right);
  const savedForFiles = getSavedKeysForCurrentFiles();
  arrayKeyMap = resolveKeyMap(detectedArrays, Object.assign({}, savedForFiles, arrayKeyMap));
  persistKeysForCurrentFiles();

  // 扫描左侧全部字段路径，排除主键字段
  fillPaths = scanLeftPaths(parsed.left, arrayKeyMap).filter(p => !p.isPrimaryKey);

  // 为每个字段计算「匹配总数」：即该字段单独回填到右侧时实际命中的处数
  // （复用 applyFieldFill 的回填逻辑，与执行替换时的真实结果完全一致）
  fillPaths.forEach(p => {
    try {
      const { logs } = applyFieldFill(parsed.left, parsed.right, [p.path], arrayKeyMap);
      p.matchCount = logs.length;
    } catch (e) {
      p.matchCount = 0;
    }
  });

  // 移除已不存在的选中项
  const validSet = new Set(fillPaths.map(p => p.path));

  // 恢复「当前左侧文件」此前缓存的已选字段：自动并入选中集合
  // （刷新后 fillSelected 为空，这里据文件名缓存重建，避免重复勾选）
  getSavedFillForLeftFile().forEach(p => fillSelected.add(p));

  // 仅保留左侧 JSON 中仍存在的字段（缓存中已失效的字段自动剔除）
  fillSelected.forEach(p => { if (!validSet.has(p)) fillSelected.delete(p); });

  // 回写一次，剔除失效字段后的结果同步到缓存
  persistFillForLeftFile();

  hideFillResult();
  renderFillList();
  updateFillSelCount();
}

// 字段项 HTML（备选/已选共用），dir 标识移动方向图标
function fillItemHtml(p, dir) {
  const arrTag = p.isArrayItemField
    ? `<span class="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded shrink-0" title="位于对象数组「${escHtml(p.arrayPath)}」内，按主键匹配回填">数组项·主键匹配</span>`
    : '';
  // 匹配总数徽章：该字段回填到右侧实际命中的处数；匹配>0 时可点击查看值统计
  const mc = (typeof p.matchCount === 'number') ? p.matchCount : 0;
  const matchTag = mc > 0
    ? `<span class="fill-stat-btn text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-1.5 py-0.5 rounded shrink-0 cursor-pointer transition" data-stat-path="${escHtml(p.path)}" title="点击查看该字段全部匹配值的统计列表"><i class="ri-links-line"></i> 匹配 ${mc}</span>`
    : `<span class="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded shrink-0" title="右侧无主键匹配的对象，该字段回填不会生效"><i class="ri-link-unlink-m"></i> 无匹配</span>`;
  // dir='add'：备选项（点击整行加入，加号图标）；dir='remove'：已选项（仅点击删除图标移除）
  const icon = dir === 'add'
    ? '<i class="ri-add-circle-line text-slate-300 group-hover:text-indigo-500 text-lg shrink-0"></i>'
    : '<i class="fill-remove-btn ri-close-circle-line text-indigo-300 hover:text-rose-500 text-lg shrink-0 cursor-pointer" title="点击移出已选"></i>';
  // 备选项整行可点击加入；已选项整行不可点击，仅删除图标可点击
  const rowCls = dir === 'add'
    ? 'fill-item group flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer transition'
    : 'fill-item group flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition';
  return `
    <div class="${rowCls}" data-path="${escHtml(p.path)}" data-dir="${dir}">
      ${icon}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono text-sm text-indigo-700 break-all">${escHtml(p.path)}</span>
          ${arrTag}
          ${matchTag}
          <span class="text-[10px] text-slate-400 shrink-0">${p.type}</span>
        </div>
      </div>
    </div>`;
}

// 渲染字段路径双列表：左=备选（未选，带搜索过滤），右=已选
function renderFillList() {
  const availWrap = $('fillAvailList');
  const selWrap = $('fillSelList');

  // ---- 左侧：备选字段（仅显示未被选中的） ----
  if (availWrap) {
    const kw = ($('fillSearch') ? $('fillSearch').value : '').trim().toLowerCase();
    const avail = fillPaths.filter(p => !fillSelected.has(p.path));
    const list = kw ? avail.filter(p => p.path.toLowerCase().includes(kw)) : avail;

    if (!fillPaths.length) {
      availWrap.innerHTML = `<div class="text-center text-slate-400 py-10"><i class="ri-inbox-line text-3xl block mb-2"></i>左侧 JSON 中没有可回填的字段</div>`;
    } else if (!avail.length) {
      availWrap.innerHTML = `<div class="text-center text-emerald-500 py-10"><i class="ri-checkbox-circle-line text-3xl block mb-2"></i>全部字段均已加入右侧</div>`;
    } else if (!list.length) {
      availWrap.innerHTML = `<div class="text-center text-slate-400 py-10"><i class="ri-search-line text-3xl block mb-2"></i>没有匹配「${escHtml(kw)}」的字段路径</div>`;
    } else {
      availWrap.innerHTML = list.map(p => fillItemHtml(p, 'add')).join('');
    }

    // 点击备选项整行 -> 加入已选
    availWrap.querySelectorAll('.fill-item').forEach(el => {
      el.addEventListener('click', () => {
        fillSelected.add(el.dataset.path);
        persistFillForLeftFile();
        renderFillList();
        updateFillSelCount();
      });
    });
    // 点击「匹配 N」徽章 -> 打开值统计弹窗（阻止冒泡，避免触发整行加入）
    availWrap.querySelectorAll('.fill-stat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openFieldStatModal(btn.dataset.statPath);
      });
    });
  }

  // ---- 右侧：已选字段 ----
  if (selWrap) {
    const selList = fillPaths.filter(p => fillSelected.has(p.path));
    if (!selList.length) {
      selWrap.innerHTML = `<div class="text-center text-slate-400 py-10"><i class="ri-arrow-left-double-line text-3xl block mb-2"></i>从左侧选择字段加入此处</div>`;
    } else {
      selWrap.innerHTML = selList.map(p => fillItemHtml(p, 'remove')).join('');
    }

    // 仅点击「删除图标」-> 移回备选（不再绑定整行）
    selWrap.querySelectorAll('.fill-remove-btn').forEach(icon => {
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = icon.closest('.fill-item');
        if (!row) return;
        fillSelected.delete(row.dataset.path);
        persistFillForLeftFile();
        renderFillList();
        updateFillSelCount();
      });
    });
    // 点击「匹配 N」徽章 -> 打开值统计弹窗
    selWrap.querySelectorAll('.fill-stat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openFieldStatModal(btn.dataset.statPath);
      });
    });
  }
}

// 更新两栏计数与执行按钮可用状态
function updateFillSelCount() {
  const availCount = fillPaths.filter(p => !fillSelected.has(p.path)).length;
  const a = $('fillAvailCount'); if (a) a.textContent = availCount;
  const c = $('fillSelCount'); if (c) c.textContent = fillSelected.size;
  const c2 = $('fillSelCount2'); if (c2) c2.textContent = fillSelected.size;
  const btn = $('btnDoFill'); if (btn) btn.disabled = fillSelected.size === 0;
}

// 隐藏回填结果区
function hideFillResult() {
  const w = $('fillResultWrap'); if (w) w.classList.add('hidden');
  lastFillResultText = '';
}

// 打开字段值统计弹窗：统计该字段全部匹配回填值的分布并分页展示
function openFieldStatModal(path) {
  const parsed = validateInput();
  if (!parsed) return;
  const { total, stats } = collectFieldValueStats(parsed.left, parsed.right, path, arrayKeyMap);
  fieldStatState = { path, stats, total, page: 1, pageSize: 10 };

  const pathEl = $('fieldStatPath'); if (pathEl) pathEl.textContent = path;
  const totalEl = $('fieldStatTotal'); if (totalEl) totalEl.textContent = total;
  const uniqEl = $('fieldStatUnique'); if (uniqEl) uniqEl.textContent = stats.length;

  renderFieldStatPage();

  const mask = $('fieldStatMask');
  const modal = $('fieldStatModal');
  if (mask) {
    mask.classList.remove('hidden');
    mask.classList.add('flex');
    requestAnimationFrame(() => {
      mask.classList.remove('opacity-0');
      if (modal) modal.classList.remove('scale-95');
    });
  }
}

// 渲染值统计弹窗当前页
function renderFieldStatPage() {
  const listEl = $('fieldStatList');
  if (!listEl) return;
  const { stats, page, pageSize } = fieldStatState;
  const totalPage = Math.max(1, Math.ceil(stats.length / pageSize));
  const cur = Math.min(page, totalPage);
  fieldStatState.page = cur;

  if (!stats.length) {
    listEl.innerHTML = `<div class="text-center text-slate-400 py-10"><i class="ri-inbox-line text-3xl block mb-2"></i>该字段无匹配回填，暂无可统计的值</div>`;
  } else {
    const start = (cur - 1) * pageSize;
    const pageItems = stats.slice(start, start + pageSize);
    const maxCount = stats[0] ? stats[0].count : 1; // 已按 count 倒序，首项最大
    listEl.innerHTML = pageItems.map((it, i) => {
      const rank = start + i + 1;
      const pct = Math.max(4, Math.round((it.count / maxCount) * 100));
      return `
        <div class="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition">
          <span class="text-[11px] text-slate-400 w-5 text-right shrink-0">${rank}</span>
          <div class="min-w-0 flex-1">
            <div class="font-mono text-sm text-slate-700 break-all" title="${escHtml(it.valueText)}">${escHtml(it.valueText)}</div>
            <div class="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-emerald-400 rounded-full" style="width:${pct}%"></div>
            </div>
          </div>
          <span class="shrink-0 text-sm font-semibold text-emerald-600 whitespace-nowrap">${it.count} 个</span>
        </div>`;
    }).join('');
  }

  const curEl = $('fieldStatCurPage'); if (curEl) curEl.textContent = cur;
  const totEl = $('fieldStatTotalPage'); if (totEl) totEl.textContent = totalPage;
  const prev = $('fieldStatPrev'); if (prev) prev.disabled = cur <= 1;
  const next = $('fieldStatNext'); if (next) next.disabled = cur >= totalPage;
}

// 关闭字段值统计弹窗
function closeFieldStatModal() {
  const mask = $('fieldStatMask');
  const modal = $('fieldStatModal');
  if (!mask) return;
  mask.classList.add('opacity-0');
  if (modal) modal.classList.add('scale-95');
  setTimeout(() => {
    mask.classList.add('hidden');
    mask.classList.remove('flex');
  }, 200);
}

// 切换回填结果的对比 tab：left=与旧文件 / right=与新文件 / json=结果JSON
function switchFillTab(name) {
  document.querySelectorAll('.fill-tab').forEach(btn => {
    const active = btn.dataset.filltab === name;
    btn.classList.toggle('border-indigo-500', active);
    btn.classList.toggle('text-indigo-600', active);
    btn.classList.toggle('border-transparent', !active);
    btn.classList.toggle('text-slate-500', !active);
  });
  const map = { left: 'fillTabLeft', right: 'fillTabRight', json: 'fillTabJson' };
  Object.entries(map).forEach(([k, id]) => {
    const el = $(id);
    if (el) el.classList.toggle('hidden', k !== name);
  });
  // 同步全局 diffPaths 为当前对比 tab 的数据，使图例点击抽屉等行为与第3/4步一致
  if (name === 'left') diffPaths = fillDiffPaths.left;
  else if (name === 'right') diffPaths = fillDiffPaths.right;
}

// 执行回填替换
// silent=true 表示由选项变化等触发的重渲染：不滚动、保持当前 tab
function doFieldFill(silent) {
  const parsed = validateInput();
  if (!parsed) return;
  if (!fillSelected.size) {
    if (!silent) alert('请先勾选要回填的字段。');
    return;
  }

  const { result, logs } = applyFieldFill(parsed.left, parsed.right, Array.from(fillSelected), arrayKeyMap);
  lastFillResultText = JSON.stringify(result, null, 2);

  // 渲染结果 JSON 文本与操作日志
  const wrap = $('fillResultWrap');
  const out = $('fillOutput');
  const logEl = $('fillLog');
  if (out) out.textContent = lastFillResultText;

  // 分别与「旧文件 A」「新文件 B」对比，渲染到两个 tab
  // 对比过程与第3/4步 runCompare 完全一致：diffJSON → renderDiff → collectDiffPaths → summarize+renderLegend
  const opts = getOptions();
  const diffLeftEl = $('fillDiffLeft');
  const diffRightEl = $('fillDiffRight');
  if (diffLeftEl) {
    const treeLeft = diffJSON(parsed.left, result, opts);   // 回填结果 vs 旧文件
    renderDiff(diffLeftEl, treeLeft, opts);
    fillDiffPaths.left = collectDiffPaths(treeLeft);
    renderLegend(summarize(treeLeft), $('fillLegendLeft'), fillDiffPaths.left);
  }
  if (diffRightEl) {
    const treeRight = diffJSON(parsed.right, result, opts);  // 回填结果 vs 新文件
    renderDiff(diffRightEl, treeRight, opts);
    fillDiffPaths.right = collectDiffPaths(treeRight);
    renderLegend(summarize(treeRight), $('fillLegendRight'), fillDiffPaths.right);
  }
  // 默认切回「与旧文件对比」tab；silent 重渲染时保持当前激活 tab
  if (!silent) {
    switchFillTab('left');
  } else {
    const cur = document.querySelector('.fill-tab.border-indigo-500');
    switchFillTab(cur ? cur.dataset.filltab : 'left');
  }

  if (logEl) {
    const added = logs.filter(l => l.action === 'added').length;
    const replaced = logs.filter(l => l.action === 'replaced').length;
    if (!logs.length) {
      logEl.innerHTML = `<div class="text-amber-600 flex items-center gap-1"><i class="ri-error-warning-line"></i> 未发生任何回填：可能右侧无主键匹配的对象，或所选字段在左侧不存在。</div>`;
    } else {
      logEl.innerHTML = `
        <div class="text-slate-600 flex items-center gap-3 flex-wrap">
          <span class="flex items-center gap-1"><i class="ri-checkbox-circle-line text-emerald-500"></i> 共 ${logs.length} 处回填</span>
          <span class="text-rose-600">新增 ${added}</span>
          <span class="text-amber-600">覆盖 ${replaced}</span>
        </div>
        <div class="mt-1 max-h-32 overflow-auto border border-slate-100 rounded p-2 space-y-0.5">
          ${logs.map(l => `
            <div class="flex items-center gap-2">
              <span class="text-[10px] px-1.5 rounded ${l.action === 'added' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}">${l.action === 'added' ? '新增' : '覆盖'}</span>
              <span class="font-mono text-slate-600 break-all">${escHtml(l.path)}</span>
              <span class="text-slate-400">=</span>
              <span class="font-mono text-emerald-600">${escHtml(previewValue(l.newValue))}</span>
            </div>`).join('')}
        </div>`;
    }
  }

  if (wrap) {
    wrap.classList.remove('hidden');
    if (!silent) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// 渲染 legendBar：按 key 维度统计仅A有/仅B有/值不同的明细，并附相同数量
const LEGEND_META = [
  { type: 'removed', label: '仅A有', icon: 'ri-indeterminate-circle-line', dot: 'bg-emerald-200', head: 'text-emerald-700', hover: 'hover:bg-emerald-50', border: 'border-emerald-200', clickable: true },
  { type: 'added',   label: '仅B有', icon: 'ri-add-circle-line',          dot: 'bg-rose-200',    head: 'text-rose-700',    hover: 'hover:bg-rose-50',    border: 'border-rose-200',    clickable: true },
  { type: 'changed', label: '值不同', icon: 'ri-error-warning-line',       dot: 'bg-amber-200',   head: 'text-amber-700',   hover: 'hover:bg-amber-50',   border: 'border-amber-200',   clickable: true },
  { type: 'same',    label: '相同',   icon: 'ri-equal-line',               dot: 'bg-slate-200',   head: 'text-slate-600',   hover: '',                    border: 'border-slate-200',   clickable: false },
];

// legendEl：图例容器（默认第4步 elLegend）；pathsData：差异路径数据源（默认全局 diffPaths）
// 二者可由调用方传入，使第5步两个对比 tab 复用与第3/4步完全一致的图例渲染与点击交互
function renderLegend(summary, legendEl, pathsData) {
  const container = legendEl || elLegend;
  const paths = pathsData || diffPaths;
  if (!container) return;
  const stripPrefix = (() => { const el = $('optStripPrefix'); return el ? el.checked : true; })();

  // 开关关闭（按完整路径统计）时，路径较长，卡片改为一行一个；打开时维持多列网格
  container.className = stripPrefix
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'
    : 'grid grid-cols-1 gap-3';

  container.innerHTML = LEGEND_META.map(m => {
    const total = m.type === 'same' ? (summary.same || 0) : (paths[m.type] ? paths[m.type].length : 0);

    // 标题栏
    const headClick = m.clickable ? `data-stat="${m.type}"` : '';
    const cursor = m.clickable ? 'cursor-pointer ' + m.hover : '';
    const head = `
      <div class="legend-head flex items-center justify-between gap-1 px-2.5 py-1.5 ${cursor} transition" ${headClick} ${m.clickable ? `title="点击查看「${m.label}」全部差异列表"` : ''}>
        <span class="flex items-center gap-1.5 font-semibold ${m.head}">
          <span class="w-3 h-3 rounded-sm ${m.dot} inline-block"></span>
          <i class="${m.icon}"></i> ${m.label}
        </span>
        <span class="flex items-center gap-1 text-xs ${m.head}">
          <span class="font-bold">${total}</span>
          ${m.clickable ? '<i class="ri-external-link-line opacity-60"></i>' : ''}
        </span>
      </div>`;

    // 明细：相同类别不展开 key 明细（只显示总数）
    let body = '';
    if (m.type !== 'same') {
      const rows = aggregateByKey(paths[m.type] || [], stripPrefix);
      if (!rows.length) {
        body = `<div class="px-2.5 py-2 text-[11px] text-slate-300">无</div>`;
      } else {
        body = `<div class="max-h-44 overflow-auto px-1.5 py-1 space-y-0.5">` + rows.map(r => `
          <div class="flex items-center justify-between gap-2 px-1.5 py-0.5 rounded hover:bg-white text-xs">
            <span class="font-mono text-slate-600 truncate" title="${escHtml(r.key)}">${escHtml(r.key)}</span>
            <span class="font-semibold text-slate-700 shrink-0">${r.count}</span>
          </div>`).join('') + `</div>`;
      }
    } else {
      body = `<div class="px-2.5 py-2 text-[11px] text-slate-400">共 ${total} 处相同</div>`;
    }

    return `<div class="border ${m.border} rounded-lg bg-white overflow-hidden">${head}${body}</div>`;
  }).join('');

  // 绑定标题点击 -> 打开抽屉（点击前把全局 diffPaths 指向当前图例数据源，确保抽屉明细一致）
  container.querySelectorAll('.legend-head[data-stat]').forEach(el => {
    el.addEventListener('click', () => {
      diffPaths = paths;
      openStatDrawer(el.dataset.stat);
    });
  });
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

// ---------- 差异结果全屏查看 ----------
// 使用原生 Fullscreen API：进入全屏后调整内边距与最大高度以铺满屏幕；ESC 由浏览器原生支持退出
function toggleResultFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else if (elResult && elResult.requestFullscreen) {
    elResult.requestFullscreen().catch(() => {
      alert('当前浏览器不支持全屏，或被安全策略阻止。');
    });
  }
}

// 同步全屏按钮文案/图标，并在全屏态下调整 #diffResult 的样式
function updateFullscreenBtn() {
  const btn = $('btnFullscreen');
  const isFs = document.fullscreenElement === elResult;
  if (elResult) {
    if (isFs) {
      // 全屏时铺满，去掉高度限制并加大内边距、白底
      elResult.classList.add('fs-active', 'bg-white');
      elResult.classList.remove('max-h-[520px]');
      elResult.style.maxHeight = '100vh';
      elResult.style.height = '100vh';
      elResult.style.padding = '24px';
    } else {
      elResult.classList.remove('fs-active', 'bg-white');
      elResult.classList.add('max-h-[520px]');
      elResult.style.maxHeight = '';
      elResult.style.height = '';
      elResult.style.padding = '';
    }
  }
  if (btn) {
    btn.innerHTML = isFs
      ? '<i class="ri-fullscreen-exit-line"></i> 退出全屏'
      : '<i class="ri-fullscreen-line"></i> 全屏查看';
  }
}

// ---------- 差异统计抽屉 ----------
const STAT_META = {
  removed: { title: '仅 A 有的 Key', icon: 'ri-indeterminate-circle-line', head: 'bg-emerald-600' },
  added:   { title: '仅 B 有的 Key', icon: 'ri-add-circle-line',          head: 'bg-rose-600' },
  changed: { title: '值不同的 Key',  icon: 'ri-error-warning-line',        head: 'bg-amber-600' },
};

// HTML 转义
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 简单值预览
function previewVal(v) {
  if (v === undefined) return '（缺失）';
  if (v === null) return 'null';
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 60) + '…' : s;
  }
  if (typeof v === 'string') return `"${v.length > 50 ? v.slice(0, 50) + '…' : v}"`;
  return String(v);
}

// 按「所在路径(group)的差异数」倒序排序，组内保持原顺序
function sortByGroupCount(list) {
  const counts = {};
  list.forEach(it => { counts[it.group] = (counts[it.group] || 0) + 1; });
  return list
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const d = (counts[b.it.group] || 0) - (counts[a.it.group] || 0);
      if (d !== 0) return d;
      // 同一分组数量时，按分组名聚合在一起，再按原顺序
      if (a.it.group !== b.it.group) return a.it.group.localeCompare(b.it.group);
      return a.i - b.i;
    })
    .map(x => Object.assign({}, x.it, { _groupCount: counts[x.it.group] || 0 }));
}

// 打开抽屉
function openStatDrawer(type) {
  const meta = STAT_META[type];
  if (!meta) return;
  drawerState.type = type;
  drawerState.list = sortByGroupCount((diffPaths[type] || []).slice());
  drawerState.page = 1;

  const header = $('statDrawerHeader');
  if (header) header.className = `flex items-center justify-between px-5 py-4 text-white shrink-0 ${meta.head}`;
  const titleEl = $('statDrawerTitle'); if (titleEl) titleEl.textContent = meta.title;
  const iconEl = $('statDrawerIcon'); if (iconEl) iconEl.className = meta.icon;
  const totalEl = $('statDrawerTotal'); if (totalEl) totalEl.textContent = drawerState.list.length;

  renderDrawerPage();

  const mask = $('statDrawerMask');
  const drawer = $('statDrawer');
  if (mask) { mask.classList.remove('hidden'); requestAnimationFrame(() => mask.classList.remove('opacity-0')); }
  if (drawer) requestAnimationFrame(() => drawer.classList.remove('translate-x-full'));
}

// 关闭抽屉
function closeStatDrawer() {
  const mask = $('statDrawerMask');
  const drawer = $('statDrawer');
  if (drawer) drawer.classList.add('translate-x-full');
  if (mask) {
    mask.classList.add('opacity-0');
    setTimeout(() => mask.classList.add('hidden'), 200);
  }
}

// 渲染当前页
function renderDrawerPage() {
  const list = drawerState.list;
  const totalPage = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (drawerState.page > totalPage) drawerState.page = totalPage;
  const start = (drawerState.page - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  const listEl = $('statDrawerList');
  if (listEl) {
    if (!pageItems.length) {
      listEl.innerHTML = `<div class="text-center text-slate-400 py-16"><i class="ri-inbox-line text-4xl block mb-2"></i>该类别没有差异</div>`;
    } else {
      listEl.innerHTML = pageItems.map((it, idx) => {
        const seq = start + idx + 1;
        let valHtml = '';
        if (it.status === 'changed') {
          valHtml = `<div class="mt-1 text-xs flex items-center gap-1 flex-wrap">
            <span class="bg-emerald-100 text-emerald-800 px-1.5 rounded">${escHtml(previewVal(it.left))}</span>
            <span class="text-slate-400">&rarr;</span>
            <span class="bg-rose-100 text-rose-800 px-1.5 rounded">${escHtml(previewVal(it.right))}</span>
          </div>`;
        } else {
          const v = it.status === 'added' ? it.right : it.left;
          valHtml = `<div class="mt-1 text-xs text-slate-500">值：<span class="bg-slate-100 px-1.5 rounded">${escHtml(previewVal(v))}</span></div>`;
        }
        return `
          <div class="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition">
            <div class="flex items-start gap-2">
              <span class="text-[11px] text-slate-400 font-mono mt-0.5 shrink-0">#${seq}</span>
              <div class="min-w-0 flex-1">
                <div class="font-mono text-sm text-indigo-700 break-all">${escHtml(it.path)}</div>
                <div class="text-[11px] text-slate-400 mt-0.5">所在路径：<span class="font-mono">${escHtml(it.group)}</span> · 该路径共 <b class="text-slate-600">${it._groupCount}</b> 处差异</div>
                ${valHtml}
              </div>
            </div>
          </div>`;
      }).join('');
    }
  }

  const cur = $('statCurPage'); if (cur) cur.textContent = drawerState.page;
  const tot = $('statTotalPage'); if (tot) tot.textContent = totalPage;
  const prev = $('statPrevPage'); if (prev) prev.disabled = drawerState.page <= 1;
  const next = $('statNextPage'); if (next) next.disabled = drawerState.page >= totalPage;
  const listScroll = $('statDrawerList'); if (listScroll) listScroll.scrollTop = 0;
}

// ---------- 事件绑定 ----------
// 防御式绑定：元素不存在时静默跳过，避免 null.addEventListener 崩溃
function on(id, event, handler) {
  const el = $(id);
  if (el) el.addEventListener(event, handler);
}

// 更新「去掉前缀」开关右侧的 开/关 文字
function updateStripPrefixLabel() {
  const el = $('optStripPrefix');
  const txt = $('stripPrefixState');
  if (el && txt) txt.textContent = el.checked ? '开' : '关';
}

// 触发浏览器下载文本文件
function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 将单个差异值转为纯文本（不截断，保留完整内容）—— 用作表格单元格值
function valToPlain(v) {
  if (v === undefined) return '（缺失）';
  if (v === null) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'string') return v;
  return String(v);
}

// 构建「统计信息」sheet 的二维数组（AOA）
function buildSummaryAOA() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const cntRemoved = diffPaths.removed.length;
  const cntAdded = diffPaths.added.length;
  const cntChanged = diffPaths.changed.length;

  const aoa = [];
  aoa.push(['JSON 差异详细统计报告']);
  aoa.push([]);
  aoa.push(['生成时间', ts]);
  aoa.push(['左侧来源(A)', fileNames.left || '（手动输入）']);
  aoa.push(['右侧来源(B)', fileNames.right || '（手动输入）']);
  aoa.push(['统计口径', '完整前缀路径（未去掉前缀）']);
  aoa.push([]);
  aoa.push(['差异类别', '数量']);
  aoa.push(['仅A有', cntRemoved]);
  aoa.push(['仅B有', cntAdded]);
  aoa.push(['值不同', cntChanged]);
  aoa.push(['合计', cntRemoved + cntAdded + cntChanged]);
  aoa.push([]);

  // 各类别「按完整路径聚合」明细
  const CAT = [
    { type: 'removed', label: '仅A有' },
    { type: 'added', label: '仅B有' },
    { type: 'changed', label: '值不同' },
  ];
  CAT.forEach(c => {
    aoa.push([`【${c.label}】按完整路径聚合`]);
    aoa.push(['完整路径', '出现次数']);
    const agg = aggregateByKey(diffPaths[c.type] || [], false);
    if (!agg.length) {
      aoa.push(['（无）', 0]);
    } else {
      agg.forEach(r => aoa.push([r.key, r.count]));
    }
    aoa.push([]);
  });

  return aoa;
}

// 构建某一类别明细 sheet 的二维数组（AOA）
// removed/added：序号 | 完整路径 | 所在路径 | 值
// changed：序号 | 完整路径 | 所在路径 | A值 | B值
function buildCategoryAOA(type) {
  const list = diffPaths[type] || [];
  const aoa = [];
  if (type === 'changed') {
    aoa.push(['序号', '完整路径', '所在路径', 'A值', 'B值']);
    list.forEach((it, i) => {
      aoa.push([i + 1, it.path, it.group, valToPlain(it.left), valToPlain(it.right)]);
    });
  } else {
    aoa.push(['序号', '完整路径', '所在路径', '值']);
    list.forEach((it, i) => {
      const v = type === 'added' ? it.right : it.left;
      aoa.push([i + 1, it.path, it.group, valToPlain(v)]);
    });
  }
  if (list.length === 0) aoa.push(['（无数据）']);
  return aoa;
}

// 下载详细统计：生成含 4 个 Sheet 的工作簿（统计信息 + 仅A有 + 仅B有 + 值不同）
function downloadDetailStat() {
  const total = diffPaths.removed.length + diffPaths.added.length + diffPaths.changed.length;
  if (!total) {
    alert('当前没有可导出的差异统计，请先在第四步执行对比。');
    return;
  }
  if (typeof XLSX === 'undefined') {
    alert('表格导出组件尚未加载完成，请稍后重试。');
    return;
  }

  const wb = XLSX.utils.book_new();

  // Sheet1：统计信息
  const wsSummary = XLSX.utils.aoa_to_sheet(buildSummaryAOA());
  wsSummary['!cols'] = [{ wch: 40 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, '统计信息');

  // Sheet2：仅A有（removed）
  const wsRemoved = XLSX.utils.aoa_to_sheet(buildCategoryAOA('removed'));
  wsRemoved['!cols'] = [{ wch: 6 }, { wch: 48 }, { wch: 32 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsRemoved, '仅A有');

  // Sheet3：仅B有（added）
  const wsAdded = XLSX.utils.aoa_to_sheet(buildCategoryAOA('added'));
  wsAdded['!cols'] = [{ wch: 6 }, { wch: 48 }, { wch: 32 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsAdded, '仅B有');

  // Sheet4：值不同（changed）
  const wsChanged = XLSX.utils.aoa_to_sheet(buildCategoryAOA('changed'));
  wsChanged['!cols'] = [{ wch: 6 }, { wch: 48 }, { wch: 32 }, { wch: 40 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsChanged, '值不同');

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  XLSX.writeFile(wb, `json-diff-${stamp}.xlsx`);
}

// 全屏查看差异结果（ESC 退出）
on('btnFullscreen', 'click', toggleResultFullscreen);
document.addEventListener('fullscreenchange', updateFullscreenBtn);

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
// 第4步 -> 第5步
on('btnToStep5', 'click', () => goStep(5));
// 第5步：搜索过滤
on('fillSearch', 'input', () => renderFillList());
// 第5步：清空选择
on('fillClearSel', 'click', () => {
  fillSelected.clear();
  renderFillList();
  updateFillSelCount();
});
// 第5步：执行替换
on('btnDoFill', 'click', () => doFieldFill());
// 第5步：回填结果对比 tab 切换
document.querySelectorAll('.fill-tab').forEach(btn => {
  btn.addEventListener('click', () => switchFillTab(btn.dataset.filltab));
});
// 第5步：字段值统计弹窗 —— 关闭 / 分页 / 遮罩点击 / ESC
on('fieldStatClose', 'click', closeFieldStatModal);
on('fieldStatPrev', 'click', () => { fieldStatState.page--; renderFieldStatPage(); });
on('fieldStatNext', 'click', () => { fieldStatState.page++; renderFieldStatPage(); });
{
  const mask = $('fieldStatMask');
  if (mask) mask.addEventListener('click', (e) => { if (e.target === mask) closeFieldStatModal(); });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const mask = $('fieldStatMask');
    if (mask && !mask.classList.contains('hidden')) closeFieldStatModal();
  }
});
// 第5步：复制结果
on('btnCopyFill', 'click', () => {
  if (!lastFillResultText) return;
  navigator.clipboard.writeText(lastFillResultText).then(() => {
    const btn = $('btnCopyFill');
    if (btn) { const old = btn.innerHTML; btn.innerHTML = '<i class="ri-check-line"></i> 已复制'; setTimeout(() => btn.innerHTML = old, 1500); }
  }).catch(() => alert('复制失败，请手动选择文本复制。'));
});
// 第5步：下载结果 JSON
on('btnDownloadFill', 'click', () => {
  if (!lastFillResultText) return;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  downloadText(`json-filled-${stamp}.json`, lastFillResultText, 'application/json;charset=utf-8');
});
// 第3步：上一个 / 下一个数组快速切换
on('btnPrevArr', 'click', () => gotoArr(-1));
on('btnNextArr', 'click', () => gotoArr(1));
// 第4步「重新对比」
on('btnRecompare', 'click', () => runCompare());
// 第4步「下载详细统计」
on('btnDownloadStat', 'click', downloadDetailStat);

// 差异统计抽屉：关闭、遮罩、分页
on('statDrawerClose', 'click', closeStatDrawer);
on('statDrawerMask', 'click', closeStatDrawer);
on('statPrevPage', 'click', () => { if (drawerState.page > 1) { drawerState.page--; renderDrawerPage(); } });
on('statNextPage', 'click', () => {
  const totalPage = Math.max(1, Math.ceil(drawerState.list.length / PAGE_SIZE));
  if (drawerState.page < totalPage) { drawerState.page++; renderDrawerPage(); }
});
// ESC 关闭抽屉
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeStatDrawer(); });

// 本地文件读取：将文件内容读入对应文本框
function readLocalFile(file, targetEl, statEl, side) {
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
    // 记录并展示文件名/路径（浏览器出于安全只暴露文件名）
    if (side) {
      fileNames[side] = file.webkitRelativePath || file.name || '';
      renderFileNames();
    }
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
  readLocalFile(e.target.files[0], elLeft, elStatLeft, 'left');
  e.target.value = '';
});

// 右侧文件选择
on('btnFileRight', 'click', () => $('fileRight') && $('fileRight').click());
on('fileRight', 'change', (e) => {
  readLocalFile(e.target.files[0], elRight, elStatRight, 'right');
  e.target.value = '';
});

// 开关变化时保存状态；若当前正在第4步则实时重新对比
OPT_IDS.forEach(id => {
  on(id, 'change', () => {
    saveState();
    updateStripPrefixLabel();
    if (currentStep === 4) runCompare();
    // 第5步：结果区可见时同步重新对比（保持与第3/4步一致的实时刷新）
    if (currentStep === 5) {
      const w = $('fillResultWrap');
      if (w && !w.classList.contains('hidden') && fillSelected.size) doFieldFill(true);
    }
  });
});

// 输入时更新状态提示并持久化文本；手动编辑则清除文件来源标记
if (elLeft) elLeft.addEventListener('input', () => {
  parseSide(elLeft.value, elStatLeft);
  if (fileNames.left) { fileNames.left = ''; renderFileNames(); }
  saveState();
});
if (elRight) elRight.addEventListener('input', () => {
  parseSide(elRight.value, elStatRight);
  if (fileNames.right) { fileNames.right = ''; renderFileNames(); }
  saveState();
});

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
  fileNames = { left: '示例数据（内置）', right: '示例数据（内置）' };
  renderFileNames();
  saveState();
}
// 始终从第一步「对比规则」开始
goStep(1);
// 同步「去掉前缀」开关的 开/关 文字
updateStripPrefixLabel();
