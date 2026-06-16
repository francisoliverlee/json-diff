// arraykey.js —— 对象数组主键选择模块
// 职责：
//   1. 扫描两侧 JSON，找出所有「对象数组」及其路径，并提取候选主键字段
//   2. 渲染主键选择列表，让用户为对象数组选择对比主键（支持多选 = 复合主键）
//   3. 不做任何默认主键推断，所有主键均由用户在第三步手动选择
//
// 主键值统一抽象：每个目标路径的主键为「字段名数组」keyFields:string[]
//   - 空数组 [] 表示尚未选择
//   - 含一个字段 = 单主键；含多个字段 = 复合主键（按字段顺序联合作为匹配键）
//   - 对象数组主键必选，避免对象数组退化为下标对比
//   - 为向后兼容历史持久化数据，下方 toKeyFields 同时接受旧的字符串格式

function isPlainObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// 判断一个数组是否为「对象数组」（元素中至少有一个是普通对象）
function isObjectArray(arr) {
  return Array.isArray(arr) && arr.some(isPlainObj);
}

/**
 * 将任意形式的主键值归一化为「字段名数组」。
 * 兼容：undefined / '' / 'field' / ['f1','f2'] 等多种历史与当前格式。
 * @returns string[] 去重、去空后的字段数组
 */
export function toKeyFields(v) {
  if (v === undefined || v === null) return [];
  let arr;
  if (Array.isArray(v)) arr = v.slice();
  else if (typeof v === 'string') arr = v === '' ? [] : [v];
  else return [];
  // 去空、去重，保持原有顺序
  const seen = new Set();
  const out = [];
  arr.forEach(f => {
    if (typeof f === 'string' && f !== '' && !seen.has(f)) { seen.add(f); out.push(f); }
  });
  return out;
}

/**
 * 递归扫描，收集所有可设置主键的目标：仅对象数组。
 * @returns Map<path, { path, label, type:'object'|'array', fields:Set, sample, count }>
 */
function collectKeyTargets(node, path, acc) {
  if (Array.isArray(node)) {
    if (isObjectArray(node)) {
      const fields = acc.has(path) ? acc.get(path).fields : new Set();
      node.forEach(item => {
        if (isPlainObj(item)) Object.keys(item).forEach(k => fields.add(k));
      });
      const prev = acc.get(path);
      // 记录第一个普通对象作为预览样本（左侧优先，已有则保留）
      let sample = prev && prev.sample ? prev.sample : null;
      if (!sample) sample = node.find(isPlainObj) || null;
      acc.set(path, {
        path,
        type: 'array',
        label: path === '' ? '(根数组)' : path,
        fields,
        sample,
        count: Math.max(prev ? prev.count : 0, node.length),
      });
    }
    // 继续向数组元素内部递归（支持多层对象 / 多层对象数组）
    const elemPath = path ? `${path}[]` : '[]';
    node.forEach((item) => collectKeyTargets(item, elemPath, acc));
  } else if (isPlainObj(node)) {
    Object.keys(node).forEach(k => {
      const childPath = path ? `${path}.${k}` : k;
      collectKeyTargets(node[k], childPath, acc);
    });
  }
  return acc;
}

/**
 * 扫描左右两侧 JSON，合并得到所有对象数组的路径与候选字段。
 * 保留函数名 scanArrayKeys 以兼容 main.js 现有调用。
 * @returns Array<{ path, label, type:'object'|'array', fields:string[], defaultKey, sample, required }>
 */
export function scanArrayKeys(left, right) {
  const acc = new Map();
  collectKeyTargets(left, '', acc);
  collectKeyTargets(right, '', acc);

  return Array.from(acc.values())
    .sort((a, b) => {
      if (a.path === b.path) return a.type.localeCompare(b.type);
      return a.path.localeCompare(b.path);
    })
    .map(item => {
      const fields = Array.from(item.fields);
      const defaultKey = [];
      return {
        path: item.path,
        label: item.label,
        type: item.type,
        fields,
        defaultKey,
        sample: item.sample,
        required: item.type === 'array',
      };
    });
}

/**
 * 计算最终生效的主键映射：
 *   已有用户选择则沿用（仅保留仍存在的字段），否则用默认主键。
 *   返回值统一为「字段数组」格式。
 */
export function resolveKeyMap(arrays, savedMap = {}) {
  const map = {};
  arrays.forEach(a => {
    const savedFields = toKeyFields(savedMap[a.path]);
    // 仅保留在当前目标字段中仍存在的主键字段
    const valid = savedFields.filter(f => a.fields.includes(f));
    map[a.path] = valid.length ? valid : toKeyFields(a.defaultKey);
  });
  return map;
}

/**
 * 渲染主键选择列表
 * 每个对象数组格式化展示样本，字段行可点击「切换选中」作为复合主键的一部分。
 * @param {HTMLElement} listEl 容器
 * @param {Array} arrays scanArrayKeys 结果
 * @param {Object} keyMap 当前主键映射 { path: string[] }
 * @param {Function} onChange (path, fields:string[]) => void  传出更新后的完整字段数组
 */
export function renderKeyChooser(listEl, arrays, keyMap, onChange) {
  if (!arrays.length) {
    listEl.innerHTML = `<div class="text-center text-slate-400 py-10">
      <i class="ri-information-line text-3xl block mb-2"></i>
      两侧 JSON 中未检测到对象数组，<br/>简单数组和普通对象无需设置对比主键。
    </div>`;
    return;
  }

  // 将字段值格式化为简短预览
  function fmtVal(v) {
    if (v === null) return '<span class="text-slate-400">null</span>';
    if (Array.isArray(v)) return `<span class="text-slate-400">[Array(${v.length})]</span>`;
    if (typeof v === 'object') return `<span class="text-slate-400">{Object}</span>`;
    if (typeof v === 'string') return `<span class="text-emerald-600">"${escapeHtml(v)}"</span>`;
    if (typeof v === 'number') return `<span class="text-blue-600">${escapeHtml(v)}</span>`;
    if (typeof v === 'boolean') return `<span class="text-purple-600">${v}</span>`;
    return escapeHtml(String(v));
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  listEl.innerHTML = arrays.map((a, idx) => {
    const current = toKeyFields(keyMap[a.path] !== undefined ? keyMap[a.path] : a.defaultKey);
    const sample = a.sample || {};
    const icon = 'ri-brackets-line';
    const typeText = '对象数组';
    const requiredText = '<span class="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">必选</span>';

    // 仅顶层简单字段可作为主键（对象/数组字段不适合作主键，仅展示不可选）
    const rows = a.fields.map(f => {
      const v = sample[f];
      const selectable = v === null || (typeof v !== 'object');
      const order = current.indexOf(f);     // 在复合主键中的序号（-1 表示未选）
      const active = order >= 0;
      const base = 'flex items-center gap-2 px-2.5 py-1.5 rounded-md transition border';
      const cls = active
        ? `${base} bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300`
        : (selectable
            ? `${base} border-transparent hover:bg-slate-100 cursor-pointer`
            : `${base} border-transparent opacity-60`);
      // 复选样式图标（多选）：选中显示带序号的方块，未选显示空心方块
      const checkbox = selectable
        ? (active
            ? `<span class="shrink-0 w-4 h-4 rounded bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">${order + 1}</span>`
            : `<i class="ri-checkbox-blank-line text-slate-300 text-base shrink-0"></i>`)
        : `<i class="ri-forbid-2-line text-slate-300 text-base shrink-0" title="对象/数组字段不可作为主键"></i>`;
      return `
        <div class="key-field-row ${cls}" ${selectable ? `data-path="${a.path}" data-field="${escapeHtml(f)}"` : ''}>
          ${checkbox}
          <span class="font-mono text-xs ${active ? 'text-indigo-700 font-semibold' : 'text-slate-600'} shrink-0">${escapeHtml(f)}</span>
          <span class="text-slate-400 text-xs">:</span>
          <span class="font-mono text-xs truncate flex-1">${fmtVal(v)}</span>
          ${active ? `<span class="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded shrink-0">主键 ${order + 1}</span>` : ''}
        </div>`;
    }).join('');

    const hasSample = a.fields.length && a.sample;
    const keyText = current.map(escapeHtml).join('<span class="text-slate-400"> + </span>');
    const emptyTip = `<div class="text-xs text-rose-500 flex items-center gap-1"><i class="ri-error-warning-line"></i> 请为该对象数组选择至少一个主键字段（必选，不可使用下标对比）</div>`;
    return `
      <div class="key-array-block border border-slate-200 rounded-lg overflow-hidden transition-all duration-300" data-path="${a.path}" data-arr-index="${idx}" id="arrCard${idx}">
        <div class="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <i class="${icon} text-indigo-500"></i>
          <span class="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">${typeText}</span>
          ${requiredText}
          <span class="font-mono text-sm text-slate-700 break-all">${a.label}</span>
          <span class="ml-auto text-[10px] text-slate-400">${a.fields.length} 字段</span>
        </div>
        <div class="px-3 py-2">
          <div class="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1 flex-wrap">
            <i class="ri-cursor-line"></i> 点击下方字段作为${typeText}对比主键（可多选组成<b class="text-indigo-500 mx-0.5">复合主键</b>，按点击顺序联合匹配）
          </div>
          <div class="space-y-1">
            ${hasSample ? rows : '<div class="text-xs text-slate-400 py-2">无可预览样本</div>'}
          </div>
          <div class="mt-2 pt-2 border-t border-dashed border-slate-200">
            ${current.length === 0
              ? emptyTip
              : `<div class="text-xs text-emerald-600 flex items-center gap-1 flex-wrap"><i class="ri-checkbox-circle-line"></i> 已选${current.length > 1 ? '复合' : ''}主键：<span class="font-mono font-semibold">${keyText}</span></div>`}
          </div>
        </div>
      </div>`;
  }).join('');

  // 点击字段行：切换该字段在复合主键中的「选中/取消」状态
  listEl.querySelectorAll('.key-field-row[data-field]').forEach(row => {
    row.addEventListener('click', () => {
      const path = row.dataset.path;
      const field = row.dataset.field;
      const cur = toKeyFields(keyMap[path] !== undefined ? keyMap[path] : (arrays.find(a => a.path === path) || {}).defaultKey);
      let next;
      if (cur.includes(field)) {
        next = cur.filter(f => f !== field);  // 已选 -> 取消
      } else {
        next = cur.concat(field);             // 未选 -> 追加（保持点击顺序）
      }
      onChange(path, next);
      renderKeyChooser(listEl, arrays, keyMap, onChange); // 重渲染以刷新高亮
    });
  });
}
