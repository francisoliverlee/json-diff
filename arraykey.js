// arraykey.js —— 对象数组主键选择模块
// 职责：
//   1. 扫描两侧 JSON，找出所有「对象数组」及其路径，并提取候选主键字段
//   2. 渲染右侧抽屉，让用户为每个对象数组选择对比主键
//   3. 不做任何默认主键推断，所有主键均由用户在第三步手动选择

function isPlainObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// 判断一个数组是否为「对象数组」（元素中至少有一个是普通对象）
function isObjectArray(arr) {
  return Array.isArray(arr) && arr.some(isPlainObj);
}

/**
 * 递归扫描，收集所有对象数组。
 * @returns Map<path, { path, label, fields:Set, sampleCount }>
 */
function collectObjectArrays(node, path, acc) {
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
        label: path === '' ? '(根数组)' : path,
        fields,
        sample,
        count: Math.max(prev ? prev.count : 0, node.length),
      });
    }
    // 继续向数组元素内部递归（支持嵌套对象数组）
    node.forEach((item, i) => collectObjectArrays(item, `${path}[${i}]`.replace(/\[\d+\]$/, '[]'), acc));
  } else if (isPlainObj(node)) {
    Object.keys(node).forEach(k => {
      const childPath = path ? `${path}.${k}` : k;
      collectObjectArrays(node[k], childPath, acc);
    });
  }
  return acc;
}

/**
 * 扫描左右两侧 JSON，合并得到所有对象数组的路径与候选字段。
 * @returns Array<{ path, label, fields:string[], defaultKey }>
 */
export function scanArrayKeys(left, right) {
  const acc = new Map();
  collectObjectArrays(left, '', acc);
  collectObjectArrays(right, '', acc);

  return Array.from(acc.values())
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(item => {
      const fields = Array.from(item.fields);
      // 不自动推断主键，也不允许按下标对比：每个对象数组都必须由用户在第三步手动选择主键。
      // defaultKey 为空字符串仅表示「尚未选择」，进入下一步前会被强制校验。
      const defaultKey = '';
      return { path: item.path, label: item.label, fields, defaultKey, sample: item.sample };
    });
}

/**
 * 计算最终生效的主键映射：
 *   已有用户选择则沿用，否则用默认主键。
 */
export function resolveKeyMap(arrays, savedMap = {}) {
  const map = {};
  arrays.forEach(a => {
    const saved = savedMap[a.path];
    // 校验保存的字段仍然存在
    if (saved !== undefined && (saved === '' || a.fields.includes(saved))) {
      map[a.path] = saved;
    } else {
      map[a.path] = a.defaultKey;
    }
  });
  return map;
}

/**
 * 渲染抽屉中的主键选择列表
 * 每个对象数组格式化展示第一个元素，字段行可点击选为对比主键（既预览又可选）。
 * @param {HTMLElement} listEl 容器
 * @param {Array} arrays scanArrayKeys 结果
 * @param {Object} keyMap 当前主键映射
 * @param {Function} onChange (path, value) => void
 */
export function renderKeyChooser(listEl, arrays, keyMap, onChange) {
  if (!arrays.length) {
    listEl.innerHTML = `<div class="text-center text-slate-400 py-10">
      <i class="ri-information-line text-3xl block mb-2"></i>
      两侧 JSON 中未检测到对象数组，<br/>无需设置对比主键。
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
    const current = keyMap[a.path] !== undefined ? keyMap[a.path] : a.defaultKey;
    const sample = a.sample || {};

    // 仅顶层简单字段可作为主键（对象/数组字段不适合作主键，仅展示不可选）
    const rows = a.fields.map(f => {
      const v = sample[f];
      const selectable = v === null || (typeof v !== 'object');
      const active = f === current;
      const base = 'flex items-center gap-2 px-2.5 py-1.5 rounded-md transition border';
      const cls = active
        ? `${base} bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300`
        : (selectable
            ? `${base} border-transparent hover:bg-slate-100 cursor-pointer`
            : `${base} border-transparent opacity-60`);
      const radio = selectable
        ? `<i class="ri-${active ? 'checkbox-circle-fill text-indigo-600' : 'circle-line text-slate-300'} text-base shrink-0"></i>`
        : `<i class="ri-forbid-2-line text-slate-300 text-base shrink-0" title="对象/数组字段不可作为主键"></i>`;
      return `
        <div class="key-field-row ${cls}" ${selectable ? `data-path="${a.path}" data-field="${escapeHtml(f)}"` : ''}>
          ${radio}
          <span class="font-mono text-xs ${active ? 'text-indigo-700 font-semibold' : 'text-slate-600'} shrink-0">${escapeHtml(f)}</span>
          <span class="text-slate-400 text-xs">:</span>
          <span class="font-mono text-xs truncate flex-1">${fmtVal(v)}</span>
          ${active ? '<span class="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded shrink-0">主键</span>' : ''}
        </div>`;
    }).join('');

    const hasSample = a.fields.length && a.sample;
    return `
      <div class="key-array-block border border-slate-200 rounded-lg overflow-hidden transition-all duration-300" data-path="${a.path}" data-arr-index="${idx}" id="arrCard${idx}">
        <div class="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <i class="ri-brackets-line text-indigo-500"></i>
          <span class="font-mono text-sm text-slate-700 break-all">${a.label}</span>
          <span class="ml-auto text-[10px] text-slate-400">${a.fields.length} 字段</span>
        </div>
        <div class="px-3 py-2">
          <div class="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1">
            <i class="ri-cursor-line"></i> 点击下方字段作为对比主键（展示第一个元素）
          </div>
          <div class="space-y-1">
            ${hasSample ? rows : '<div class="text-xs text-slate-400 py-2">无可预览样本</div>'}
          </div>
          <div class="mt-2 pt-2 border-t border-dashed border-slate-200">
            ${current === ''
              ? `<div class="text-xs text-rose-500 flex items-center gap-1"><i class="ri-error-warning-line"></i> 请为该对象数组选择一个主键（必选，不可使用下标对比）</div>`
              : `<div class="text-xs text-emerald-600 flex items-center gap-1"><i class="ri-checkbox-circle-line"></i> 已选主键：<span class="font-mono font-semibold">${escapeHtml(current)}</span></div>`}
          </div>
        </div>
      </div>`;
  }).join('');

  // 点击字段行选为主键
  listEl.querySelectorAll('.key-field-row[data-field]').forEach(row => {
    row.addEventListener('click', () => {
      onChange(row.dataset.path, row.dataset.field);
      renderKeyChooser(listEl, arrays, keyMap, onChange); // 重渲染以刷新高亮
    });
  });
}
