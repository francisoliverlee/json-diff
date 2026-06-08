// render.js —— 差异结果可视化渲染模块
import { kindOf } from './diff.js';

// 状态对应的样式配置
const STATUS_STYLE = {
  same:    { bg: 'bg-slate-50',    badge: 'bg-slate-200 text-slate-600',   icon: 'ri-equal-line',        label: '相同' },
  added:   { bg: 'bg-rose-50',     badge: 'bg-rose-200 text-rose-700',     icon: 'ri-add-circle-line',   label: '仅B有' },
  removed: { bg: 'bg-emerald-50',  badge: 'bg-emerald-200 text-emerald-700',icon: 'ri-indeterminate-circle-line', label: '仅A有' },
  changed: { bg: 'bg-amber-50',    badge: 'bg-amber-200 text-amber-700',   icon: 'ri-error-warning-line',label: '值不同' },
  parent:  { bg: '',               badge: 'bg-indigo-100 text-indigo-700',  icon: 'ri-folder-line',       label: '' },
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
    // 主键模式：key 是字符串 "字段=值"，高亮主键值
    if (typeof node.key === 'string' && node.key.includes('=')) {
      const eq = node.key.indexOf('=');
      const field = node.key.slice(0, eq);
      const val = node.key.slice(eq + 1);
      return `<span class="text-slate-400">[</span><span class="text-indigo-500">${esc(field)}</span><span class="text-slate-400">=</span><span class="text-indigo-700 font-semibold">${esc(val)}</span><span class="text-slate-400">]</span>`;
    }
    return `<span class="text-slate-400">[${node.key}]</span>`;
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
 * 渲染单个节点
 * @param {DiffNode} node
 * @param {object} opts { hideSame }
 * @param {boolean} isArrayItem 父节点是否数组
 * @param {number} depth 缩进深度
 */
function renderNode(node, opts, isArrayItem, depth) {
  // 隐藏相同项
  if (opts.hideSame && isAllSame(node)) return '';

  const style = STATUS_STYLE[node.status] || STATUS_STYLE.parent;
  const pad = depth * 18;

  // 容器类节点（object / array）
  if (node.type === 'object' || node.type === 'array') {
    // 若是 added/removed 的整块对象/数组，作为整体值展示
    if (node.status === 'added' || node.status === 'removed') {
      return renderLeafLikeContainer(node, opts, isArrayItem, depth, style);
    }

    const childrenHtml = node.children
      .map(c => renderNode(c, opts, node.type === 'array', depth + 1))
      .join('');

    // 子节点全被隐藏则不显示该父节点
    if (opts.hideSame && childrenHtml.trim() === '' && node.status === 'same') return '';

    const meta = node.meta || {};
    let metaTag = '';
    if (node.type === 'object') {
      const cntCls = meta.keyCountEqual ? 'text-slate-400' : 'text-amber-600 font-semibold';
      metaTag = `<span class="ml-2 text-xs ${cntCls}">key数量 A:${meta.leftKeyCount} / B:${meta.rightKeyCount}${meta.keyCountEqual ? '' : ' ⚠'}</span>`;
      if (meta.keyCountEqual && meta.sameKeys === false) {
        metaTag += `<span class="ml-2 text-xs text-amber-600">key不一致 ⚠</span>`;
      }
    } else {
      const cntCls = meta.lengthEqual ? 'text-slate-400' : 'text-amber-600 font-semibold';
      metaTag = `<span class="ml-2 text-xs ${cntCls}">长度 A:${meta.leftLength} / B:${meta.rightLength}${meta.lengthEqual ? '' : ' ⚠'}</span>`;
      if (meta.matchKey) {
        metaTag += `<span class="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 rounded">按主键「${esc(meta.matchKey)}」对比</span>`;
      }
    }

    const bracket = node.type === 'array' ? '[ ]' : '{ }';
    const keyLabel = node.key === 'root'
      ? `<span class="text-indigo-600 font-bold">根节点</span>`
      : fmtKey(node, isArrayItem);

    return `
      <div class="diff-node" style="padding-left:${pad}px">
        <div class="flex items-center gap-1 py-1 group">
          <i class="ri-arrow-down-s-line text-slate-400 toggle-icon cursor-pointer"></i>
          ${keyLabel}
          <span class="text-slate-400">: ${bracket}</span>
          ${metaTag}
          ${node.meta && node.meta.changedCount ? `<span class="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 rounded">${node.meta.changedCount} 处差异</span>` : ''}
        </div>
        <div class="node-children border-l border-slate-200 ml-1">
          ${childrenHtml}
        </div>
      </div>`;
  }

  // 叶子（value）节点
  return renderValueNode(node, opts, isArrayItem, depth, style);
}

// 渲染整块新增/删除的对象或数组
function renderLeafLikeContainer(node, opts, isArrayItem, depth, style) {
  const pad = depth * 18;
  const val = node.status === 'added' ? node.right : node.left;
  const preview = JSON.stringify(val, null, 2);
  const badge = `<span class="text-[10px] px-1.5 py-0.5 rounded ${style.badge} whitespace-nowrap mt-0.5"><i class="${style.icon}"></i> ${style.label}</span>`;
  // 仅左边有(removed)：提示在 key 左侧；仅右边有(added)：提示在 key 右侧
  const keyArea = node.status === 'removed'
    ? `${badge} ${fmtKey(node, isArrayItem)}`
    : `${fmtKey(node, isArrayItem)} ${badge}`;
  return `
    <div class="diff-node ${style.bg} rounded my-0.5" style="padding-left:${pad}px">
      <div class="flex items-start gap-2 py-1 px-2">
        ${keyArea}
        <span class="text-slate-400">:</span>
        <pre class="text-xs text-slate-600 whitespace-pre-wrap flex-1">${esc(preview)}</pre>
      </div>
    </div>`;
}

// 渲染简单值差异节点
function renderValueNode(node, opts, isArrayItem, depth, style) {
  const pad = depth * 18;

  if (node.status === 'same') {
    return `
      <div class="diff-node rounded my-0.5" style="padding-left:${pad}px">
        <div class="flex items-center gap-2 py-1 px-2">
          ${fmtKey(node, isArrayItem)}
          <span class="text-slate-400">:</span>
          <span>${fmtValue(node.left)}</span>
        </div>
      </div>`;
  }

  if (node.status === 'added' || node.status === 'removed') {
    const val = node.status === 'added' ? node.right : node.left;
    const badge = `<span class="text-[10px] px-1.5 py-0.5 rounded ${style.badge} whitespace-nowrap"><i class="${style.icon}"></i> ${style.label}</span>`;
    // 仅左边有(removed)：提示在 key 左侧；仅右边有(added)：提示在 key 右侧
    const keyArea = node.status === 'removed'
      ? `${badge} ${fmtKey(node, isArrayItem)}`
      : `${fmtKey(node, isArrayItem)} ${badge}`;
    return `
      <div class="diff-node ${style.bg} rounded my-0.5" style="padding-left:${pad}px">
        <div class="flex items-center gap-2 py-1 px-2">
          ${keyArea}
          <span class="text-slate-400">:</span>
          <span>${fmtValue(val)}</span>
        </div>
      </div>`;
  }

  // changed：以 “左value <------> 右value” 形式展示
  return `
    <div class="diff-node ${style.bg} rounded my-0.5" style="padding-left:${pad}px">
      <div class="flex items-center gap-2 py-1 px-2 flex-wrap">
        <span class="text-[10px] px-1.5 py-0.5 rounded ${style.badge} whitespace-nowrap"><i class="${style.icon}"></i> ${style.label}</span>
        ${fmtKey(node, isArrayItem)}
        <span class="text-slate-400">:</span>
        <span class="bg-emerald-100 text-emerald-800 px-1.5 rounded">${fmtValue(node.left)}</span>
        <span class="text-slate-500 font-mono select-none">&lt;------&gt;</span>
        <span class="bg-rose-100 text-rose-800 px-1.5 rounded">${fmtValue(node.right)}</span>
        ${node.meta && node.meta.reason === 'type-mismatch' ? `<span class="text-xs text-amber-600 ml-1">类型不同(${node.meta.leftType} vs ${node.meta.rightType})</span>` : ''}
      </div>
    </div>`;
}

/**
 * 渲染整棵差异树到容器
 */
export function renderDiff(container, rootNode, opts) {
  const html = renderNode(rootNode, opts, false, 0);
  if (opts.hideSame && html.trim() === '') {
    container.innerHTML = `<div class="text-center text-emerald-500 py-12"><i class="ri-checkbox-circle-line text-4xl block mb-2"></i>两侧 JSON 完全一致（无差异）</div>`;
    return;
  }
  container.innerHTML = html;
  bindToggle(container);
  // 根据"折叠所有节点"开关应用初始折叠状态
  applyCollapseAll(container, !!opts.collapseAll);
}

// 折叠/展开全部节点
function applyCollapseAll(container, collapsed) {
  container.querySelectorAll('.diff-node').forEach(node => {
    const children = node.querySelector(':scope > .node-children');
    const icon = node.querySelector(':scope > div > .toggle-icon');
    if (!children || !icon) return;
    children.classList.toggle('hidden', collapsed);
    icon.classList.toggle('ri-arrow-down-s-line', !collapsed);
    icon.classList.toggle('ri-arrow-right-s-line', collapsed);
  });
}

// 折叠/展开交互
function bindToggle(container) {
  container.querySelectorAll('.toggle-icon').forEach(icon => {
    icon.addEventListener('click', () => {
      const node = icon.closest('.diff-node');
      const children = node.querySelector('.node-children');
      if (!children) return;
      const collapsed = children.classList.toggle('hidden');
      icon.classList.toggle('ri-arrow-down-s-line', !collapsed);
      icon.classList.toggle('ri-arrow-right-s-line', collapsed);
    });
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

  // 拼接子节点路径段
  function joinPath(base, node, parentIsArray) {
    const key = node.key;
    if (parentIsArray) {
      // 主键模式 key 形如 "pk=value"
      if (typeof key === 'string' && key.includes('=')) return `${base}[${key}]`;
      return `${base}[${key}]`;
    }
    return base ? `${base}.${key}` : String(key);
  }

  // group：用于按「父路径」聚合倒排展示，取去掉最后一段后的路径（无则为根）
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

    // 容器节点继续向下递归
    (node.children || []).forEach(c => {
      const childPath = joinPath(path, c, node.type === 'array');
      walk(c, childPath, node.type === 'array');
    });
  }

  // 根节点本身不计入路径前缀
  (rootNode.children || []).forEach(c => {
    const p = joinPath('', c, rootNode.type === 'array');
    walk(c, p, rootNode.type === 'array');
  });

  return result;
}

/**
 * 提取一条全路径的「最终 key」名（去掉前缀）。
 * 规则：
 *   - 取最后一段；若最后一段是数组下标 [i] 或主键 [pk=v]，则回退到其前面的字段名。
 *   - 例：a.b.c -> c ; team[id=1].role -> role ; scores[3] -> scores ;
 *        [0] -> (根数组项) ; obj.list[2] -> list
 */
export function finalKeyOf(path) {
  if (!path || path === '(根)') return '(根)';
  // 去掉末尾的若干个 [..] 片段，定位到最后的字段名
  let p = path;
  // 若以 [..] 结尾（数组下标/主键），去掉它们
  let stripped = p.replace(/(\[[^\]]*\])+$/,'');
  if (stripped === '') {
    // 整条都是 [..]（如 "[0]" 或 "[id=1]"），属于根数组项
    return '(根数组项)';
  }
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
