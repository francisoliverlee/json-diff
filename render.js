// render.js —— 差异结果可视化渲染模块
import { kindOf } from './diff.js';

// 状态对应的样式配置
const STATUS_STYLE = {
  same:    { bg: 'bg-slate-50',    badge: 'bg-slate-200 text-slate-600',    icon: 'ri-equal-line',                  label: '相同' },
  added:   { bg: 'bg-rose-50',     badge: 'bg-rose-200 text-rose-700',      icon: 'ri-add-circle-line',             label: '仅B有' },
  removed: { bg: 'bg-emerald-50',  badge: 'bg-emerald-200 text-emerald-700', icon: 'ri-indeterminate-circle-line',   label: '仅A有' },
  changed: { bg: 'bg-amber-50',    badge: 'bg-amber-200 text-amber-700',    icon: 'ri-error-warning-line',          label: '值不同' },
  parent:  { bg: '',               badge: 'bg-indigo-100 text-indigo-700',  icon: 'ri-folder-line',                 label: '' },
};

// HTML 转义
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 将简单值渲染为带类型色彩的字符串
function fmtValue(v) {
  const k = kindOf(v);
  if (v === undefined) return '<span class="text-slate-300 italic">（缺失）</span>';
  if (k === 'null') return '<span class="text-slate-400">null</span>';
  if (k === 'string') return `<span class="text-emerald-600">"${esc(v)}"</span>`;
  if (k === 'number') return `<span class="text-blue-600">${esc(v)}</span>`;
  if (k === 'boolean') return `<span class="text-purple-600">${esc(v)}</span>`;
  if (k === 'array') return `<span class="text-slate-500">[Array(${v.length})]</span>`;
  if (k === 'object') return `<span class="text-slate-500">{Object}</span>`;
  return esc(v);
}

// key 展示：数组下标用 [i]，对象用 key；主键模式下数组项 key 形如 "pk=value"
function fmtKey(node, isArrayItem) {
  if (isArrayItem) {
    // 主键模式：key 是字符串 "字段=值"（复合主键为 "字段1=值1, 字段2=值2"），高亮每段主键
    if (typeof node.key === 'string' && node.key.includes('=')) {
      const segs = node.key.split(', ').map(seg => {
        const eq = seg.indexOf('=');
        if (eq < 0) return `<span class="text-indigo-700 font-semibold">${esc(seg)}</span>`;
        const field = seg.slice(0, eq);
        const val = seg.slice(eq + 1);
        return `<span class="text-indigo-500">${esc(field)}</span><span class="text-slate-400">=</span><span class="text-indigo-700 font-semibold">${esc(val)}</span>`;
      });
      return `<span class="text-slate-400">[</span>${segs.join('<span class="text-slate-400">, </span>')}<span class="text-slate-400">]</span>`;
    }
    return `<span class="text-slate-400">[${esc(node.key)}]</span>`;
  }
  return `<span class="text-slate-700 font-semibold">${esc(node.key)}</span>`;
}

/**
 * 判断在"隐藏相同"模式下，该节点是否应被隐藏
 * 仅当整棵子树都相同时才隐藏
 */
function isAllSame(node) {
  if (node.status === 'same') {
    if (!node.children || node.children.length === 0) return true;
    return node.children.every(isAllSame);
  }
  return false;
}

/**
 * statusFilter 过滤：判断某棵子树在当前状态过滤下是否「完全没有可展示内容」。
 * filter 为一个集合（Set），包含当前勾选要展示的状态：'added' | 'removed' | 'changed' | 'same'。
 * @returns true 表示该节点在当前过滤下应被隐藏（无任何可展示内容）
 */
function isFilteredOut(node, filter) {
  if (!filter) return false;

  const isLeaf = node.type === 'value';
  const isWholeContainer = (node.type === 'object' || node.type === 'array')
    && (node.status === 'added' || node.status === 'removed');

  if (isLeaf || isWholeContainer) {
    return !filter.has(node.status);
  }

  const children = node.children || [];
  if (children.length === 0) {
    return !filter.has(node.status);
  }
  return children.every(c => isFilteredOut(c, filter));
}

let __rowSeq = 0;

function normalizedExpandLevel(opts) {
  const n = Number(opts && opts.expandLevel);
  return Number.isFinite(n) ? n : 0;
}

function statusClass(status) {
  if (status === 'added') return 'split-diff-row-added';
  if (status === 'removed') return 'split-diff-row-removed';
  if (status === 'changed') return 'split-diff-row-changed';
  if (status === 'same') return 'split-diff-row-same';
  return 'split-diff-row-parent';
}

function cellStatusClass(status, side) {
  if (status === 'added') return side === 'right' ? 'split-diff-cell-added' : 'split-diff-cell-empty';
  if (status === 'removed') return side === 'left' ? 'split-diff-cell-removed' : 'split-diff-cell-empty';
  if (status === 'changed') return side === 'left' ? 'split-diff-cell-old' : 'split-diff-cell-new';
  if (status === 'same') return 'split-diff-cell-same';
  return 'split-diff-cell-parent';
}

function badgeHtml(status) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.parent;
  if (!style.label) return '';
  return `<span class="split-diff-badge ${style.badge}"><i class="${style.icon}"></i> ${style.label}</span>`;
}

function metaHtml(node) {
  const meta = node.meta || {};
  let out = '';

  if (node.type === 'object') {
    const cntCls = meta.keyCountEqual ? 'text-slate-400' : 'text-amber-600 font-semibold';
    out += `<span class="split-diff-meta ${cntCls}">key数量 A:${meta.leftKeyCount} / B:${meta.rightKeyCount}${meta.keyCountEqual ? '' : ' ⚠'}</span>`;
    if (meta.keyCountEqual && meta.sameKeys === false) {
      out += `<span class="split-diff-meta text-amber-600">key不一致 ⚠</span>`;
    }
    if (meta.objectMatchKey) {
      const keyFields = Array.isArray(meta.objectMatchKey) ? meta.objectMatchKey : [meta.objectMatchKey];
      const keyLabel = keyFields.map(f => esc(f)).join(' + ');
      const keyTitle = keyFields.length > 1 ? '复合主键' : '主键';
      out += `<span class="split-diff-meta bg-violet-100 text-violet-700 px-1.5 rounded">对象按${keyTitle}「${keyLabel}」校验</span>`;
      if (meta.objectKeyChanged) {
        out += `<span class="split-diff-meta bg-amber-200 text-amber-700 px-1.5 rounded"><i class="ri-error-warning-line"></i> 主键值不同</span>`;
      }
    }
  } else if (node.type === 'array') {
    const cntCls = meta.lengthEqual ? 'text-slate-400' : 'text-amber-600 font-semibold';
    out += `<span class="split-diff-meta ${cntCls}">长度 A:${meta.leftLength} / B:${meta.rightLength}${meta.lengthEqual ? '' : ' ⚠'}</span>`;
    if (meta.matchKey) {
      const keyFields = Array.isArray(meta.matchKey) ? meta.matchKey : [meta.matchKey];
      const keyLabel = keyFields.map(f => esc(f)).join(' + ');
      const keyTitle = keyFields.length > 1 ? '复合主键' : '主键';
      out += `<span class="split-diff-meta bg-indigo-100 text-indigo-700 px-1.5 rounded">按${keyTitle}「${keyLabel}」对比</span>`;
      if (meta.leftUniqueCount !== undefined && meta.rightUniqueCount !== undefined) {
        const uCls = meta.uniqueCountEqual ? 'text-slate-400' : 'text-amber-600 font-semibold';
        out += `<span class="split-diff-meta ${uCls}" title="按主键去重后的元素数量">去重长度 A:${meta.leftUniqueCount} / B:${meta.rightUniqueCount}${meta.uniqueCountEqual ? '' : ' ⚠'}</span>`;
      }
    }
    if (meta.lengthChanged) {
      out += `<span class="split-diff-meta bg-amber-200 text-amber-700 px-1.5 rounded"><i class="ri-error-warning-line"></i> 值不同(个数)</span>`;
    }
  }

  if (node.meta && node.meta.changedCount) {
    out += `<span class="split-diff-meta bg-amber-100 text-amber-700 px-1.5 rounded">${node.meta.changedCount} 处差异</span>`;
  }
  return out;
}

function containerMark(node) {
  return node.type === 'array' ? '[ ]' : '{ }';
}

function previewBlock(v) {
  let text;
  try { text = JSON.stringify(v, null, 2); }
  catch (_) { text = String(v); }
  return `<pre class="split-diff-pre">${esc(text)}</pre>`;
}

function emptyCell(reason) {
  return `<span class="split-diff-empty-text">${reason}</span>`;
}

function renderCellContent(row, side) {
  const { node, isArrayItem, hasChildren, collapsed } = row;
  const sideHasValue = side === 'left' ? node.left !== undefined : node.right !== undefined;
  const toggle = hasChildren
    ? `<i class="${collapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line'} split-diff-toggle toggle-icon" data-toggle="${row.id}"></i>`
    : '<span class="split-diff-toggle-placeholder"></span>';
  const key = node.key === 'root'
    ? '<span class="text-indigo-600 font-bold">根节点</span>'
    : fmtKey(node, isArrayItem);

  if (!sideHasValue && (node.status === 'added' || node.status === 'removed')) {
    return `
      <div class="split-diff-line" style="padding-left:${row.pad}px">
        ${toggle}
        ${emptyCell(node.status === 'added' ? '左侧缺失' : '右侧缺失')}
      </div>`;
  }

  if (node.type === 'object' || node.type === 'array') {
    const isWhole = node.status === 'added' || node.status === 'removed';
    return `
      <div class="split-diff-line" style="padding-left:${row.pad}px">
        ${toggle}
        <div class="split-diff-content">
          <div class="split-diff-main">
            ${node.status === 'removed' && side === 'left' ? badgeHtml(node.status) : ''}
            <span>${key}</span>
            ${node.status === 'added' && side === 'right' ? badgeHtml(node.status) : ''}
            <span class="text-slate-400">: ${containerMark(node)}</span>
            ${!isWhole ? metaHtml(node) : ''}
          </div>
          ${isWhole ? previewBlock(side === 'left' ? node.left : node.right) : ''}
        </div>
      </div>`;
  }

  if (node.status === 'same') {
    return `
      <div class="split-diff-line" style="padding-left:${row.pad}px">
        ${toggle}
        <div class="split-diff-main"><span>${key}</span><span class="text-slate-400">:</span><span>${fmtValue(node.left)}</span></div>
      </div>`;
  }

  if (node.status === 'added' || node.status === 'removed') {
    const val = node.status === 'added' ? node.right : node.left;
    return `
      <div class="split-diff-line" style="padding-left:${row.pad}px">
        ${toggle}
        <div class="split-diff-main">
          ${node.status === 'removed' && side === 'left' ? badgeHtml(node.status) : ''}
          <span>${key}</span>
          ${node.status === 'added' && side === 'right' ? badgeHtml(node.status) : ''}
          <span class="text-slate-400">:</span>
          <span>${fmtValue(val)}</span>
        </div>
      </div>`;
  }

  return `
    <div class="split-diff-line" style="padding-left:${row.pad}px">
      ${toggle}
      <div class="split-diff-content">
        <div class="split-diff-main">
          ${side === 'left' ? badgeHtml(node.status) : ''}
          <span>${key}</span>
          <span class="text-slate-400">:</span>
          <span>${fmtValue(side === 'left' ? node.left : node.right)}</span>
          ${node.meta && node.meta.reason === 'type-mismatch' && side === 'right' ? `<span class="text-xs text-amber-600 ml-1">类型不同(${node.meta.leftType} vs ${node.meta.rightType})</span>` : ''}
        </div>
      </div>
    </div>`;
}

function rowHtml(row) {
  const node = row.node;
  return `
    <div class="split-diff-row ${statusClass(node.status)}${row.initialHidden ? ' hidden' : ''}"
      data-row-id="${row.id}"
      data-parent-id="${row.parentId || ''}"
      data-depth="${row.depth}"
      data-collapsed="${row.collapsed ? '1' : '0'}">
      <div class="split-diff-cell split-diff-left ${cellStatusClass(node.status, 'left')}">${renderCellContent(row, 'left')}</div>
      <div class="split-diff-cell split-diff-right ${cellStatusClass(node.status, 'right')}">${renderCellContent(row, 'right')}</div>
    </div>`;
}

function buildRows(node, opts, isArrayItem, depth, parentId) {
  if (opts.hideSame && isAllSame(node)) return [];
  if (opts.statusFilter && isFilteredOut(node, opts.statusFilter)) return [];

  const isContainer = node.type === 'object' || node.type === 'array';
  const isWholeContainer = isContainer && (node.status === 'added' || node.status === 'removed');
  const id = `row-${++__rowSeq}`;
  const childRows = [];

  if (isContainer && !isWholeContainer) {
    (node.children || []).forEach(child => {
      childRows.push(...buildRows(child, opts, node.type === 'array', depth + 1, id));
    });
    if (childRows.length === 0 && node.key !== 'root') return [];
  }

  const expandLevel = normalizedExpandLevel(opts);
  const hasChildren = childRows.length > 0;
  const collapsed = hasChildren && (node.key === 'root' ? expandLevel === 0 : depth >= expandLevel);
  const row = {
    id,
    parentId,
    node,
    isArrayItem,
    depth,
    pad: depth * 18,
    hasChildren,
    collapsed,
    initialHidden: false,
  };

  return [row, ...childRows];
}

function applyInitialVisibility(rows) {
  const byId = new Map(rows.map(row => [row.id, row]));
  rows.forEach(row => {
    let parent = byId.get(row.parentId);
    row.initialHidden = false;
    while (parent) {
      if (parent.collapsed || parent.initialHidden) {
        row.initialHidden = true;
        break;
      }
      parent = byId.get(parent.parentId);
    }
  });
}

/**
 * 渲染整棵差异树到容器
 */
export function renderDiff(container, rootNode, opts = {}) {
  __rowSeq = 0;
  const rows = buildRows(rootNode, opts, false, 0, '');

  if (rows.length <= 1) {
    const filtered = opts.statusFilter && opts.statusFilter.size < 4;
    if (filtered) {
      container.innerHTML = `<div class="text-center text-slate-400 py-12"><i class="ri-filter-off-line text-4xl block mb-2"></i>当前筛选条件下没有可展示的内容<br/><span class="text-xs">请在上方勾选要展示的差异类型</span></div>`;
    } else {
      container.innerHTML = `<div class="text-center text-emerald-500 py-12"><i class="ri-checkbox-circle-line text-4xl block mb-2"></i>两侧 JSON 完全一致（无差异）</div>`;
    }
    return;
  }

  applyInitialVisibility(rows);
  container.innerHTML = `
    <div class="split-diff" data-split-diff="1">
      <div class="split-diff-header">
        <div class="split-diff-header-cell split-diff-left-title"><i class="ri-file-list-2-line"></i> A / 旧 JSON</div>
        <div class="split-diff-header-cell split-diff-right-title"><i class="ri-file-list-3-line"></i> B / 新 JSON</div>
      </div>
      <div class="split-diff-body">
        ${rows.map(rowHtml).join('')}
      </div>
    </div>`;
  bindToggle(container);
}

function bindToggle(container) {
  if (container.__splitToggleBound) return;
  container.__splitToggleBound = true;

  container.addEventListener('click', (e) => {
    const icon = e.target.closest('.toggle-icon[data-toggle]');
    if (!icon || !container.contains(icon)) return;
    e.stopPropagation();

    const id = icon.getAttribute('data-toggle');
    const row = container.querySelector(`.split-diff-row[data-row-id="${id}"]`);
    if (!row) return;

    const collapsed = row.getAttribute('data-collapsed') !== '1';
    row.setAttribute('data-collapsed', collapsed ? '1' : '0');
    row.querySelectorAll(`.toggle-icon[data-toggle="${id}"]`).forEach(item => {
      item.classList.toggle('ri-arrow-down-s-line', !collapsed);
      item.classList.toggle('ri-arrow-right-s-line', collapsed);
    });
    refreshRowVisibility(container);
  });
}

function refreshRowVisibility(container) {
  const rows = Array.from(container.querySelectorAll('.split-diff-row[data-row-id]'));
  const byId = new Map(rows.map(row => [row.dataset.rowId, row]));

  rows.forEach(row => {
    let hidden = false;
    let parent = byId.get(row.dataset.parentId || '');
    while (parent) {
      if (parent.getAttribute('data-collapsed') === '1' || parent.classList.contains('hidden')) {
        hidden = true;
        break;
      }
      parent = byId.get(parent.dataset.parentId || '');
    }
    row.classList.toggle('hidden', hidden);
  });
}

/**
 * 统计差异概要
 */
export function summarize(rootNode) {
  let added = 0, removed = 0, changed = 0, same = 0;
  function walk(n) {
    if (n.type === 'value' || ((n.type === 'object' || n.type === 'array') && (n.status === 'added' || n.status === 'removed'))) {
      if (n.status === 'added') added++;
      else if (n.status === 'removed') removed++;
      else if (n.status === 'changed') changed++;
      else if (n.status === 'same') same++;
      return;
    }
    (n.children || []).forEach(walk);
  }
  walk(rootNode);
  return { added, removed, changed, same };
}

/**
 * 收集差异 key 的全路径列表，按状态分类。
 * 全路径规则：对象 key 用 ".key"，数组下标用 "[i]"，主键模式用 "[pk=value]"。
 * 每个最终 value 差异（含整块 added/removed 的对象/数组）算 1 处。
 * @returns { added:[], removed:[], changed:[] }
 *   每项为 { path, depth, group, status, left, right }
 */
export function collectDiffPaths(rootNode) {
  const result = { added: [], removed: [], changed: [] };

  function joinPath(base, node, parentIsArray) {
    const key = node.key;
    if (parentIsArray) {
      if (typeof key === 'string' && key.includes('=')) return `${base}[${key}]`;
      return `${base}[${key}]`;
    }
    return base ? `${base}.${key}` : String(key);
  }

  function groupOf(path) {
    const m = path.match(/^(.*)(\.[^.\[\]]+|\[[^\]]*\])$/);
    return m && m[1] ? m[1] : '(根)';
  }

  function walk(node, path, parentIsArray) {
    const isLeafValue = node.type === 'value';
    const isWholeContainer = (node.type === 'object' || node.type === 'array')
      && (node.status === 'added' || node.status === 'removed');

    if (isLeafValue || isWholeContainer) {
      const fullPath = path || '(根)';
      const item = {
        path: fullPath,
        depth: (fullPath.match(/[.\[]/g) || []).length,
        group: groupOf(fullPath),
        status: node.status,
        left: node.left,
        right: node.right,
      };
      if (node.status === 'added') result.added.push(item);
      else if (node.status === 'removed') result.removed.push(item);
      else if (node.status === 'changed') result.changed.push(item);
      return;
    }

    if (node.type === 'array' && node.meta && node.meta.lengthChanged) {
      const fullPath = path || '(根)';
      result.changed.push({
        path: fullPath,
        depth: (fullPath.match(/[.\[]/g) || []).length,
        group: groupOf(fullPath),
        status: 'changed',
        left: `数组长度 ${node.meta.leftLength}`,
        right: `数组长度 ${node.meta.rightLength}`,
        reason: 'array-length',
      });
    }

    (node.children || []).forEach(c => {
      const childPath = joinPath(path, c, node.type === 'array');
      walk(c, childPath, node.type === 'array');
    });
  }

  (rootNode.children || []).forEach(c => {
    const p = joinPath('', c, rootNode.type === 'array');
    walk(c, p, rootNode.type === 'array');
  });

  return result;
}

/**
 * 提取一条全路径的「最终 key」名（去掉前缀）。
 */
export function finalKeyOf(path) {
  if (!path || path === '(根)') return '(根)';
  const stripped = path.replace(/(\[[^\]]*\])+$/,'');
  if (stripped === '') return '(根数组项)';
  const seg = stripped.split('.');
  return seg[seg.length - 1] || stripped;
}

/**
 * 将 collectDiffPaths 的某一类别列表，按 key 维度聚合计数。
 * @param {Array} list  diffPaths[type]
 * @param {boolean} stripPrefix true=按最终 key 聚合；false=按完整路径聚合
 * @returns Array<{ key, count }>  按 count 倒序、key 升序
 */
export function aggregateByKey(list, stripPrefix = true) {
  const map = new Map();
  (list || []).forEach(it => {
    const k = stripPrefix ? finalKeyOf(it.path) : it.path;
    map.set(k, (map.get(k) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => (b.count - a.count) || a.key.localeCompare(b.key));
}
