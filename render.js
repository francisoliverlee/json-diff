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
    // 主键模式：key 是字符串 "字段=值"（复合主键为 "字段1=值1, 字段2=值2"），高亮每段主键
    if (typeof node.key === 'string' && node.key.includes('=')) {
      // 复合主键按 ", " 拆分为多段，逐段渲染 字段=值
      const segs = node.key.split(', ').map(seg => {
        const eq = seg.indexOf('=');
        if (eq < 0) return `<span class="text-indigo-700 font-semibold">${esc(seg)}</span>`;
        const field = seg.slice(0, eq);
        const val = seg.slice(eq + 1);
        return `<span class="text-indigo-500">${esc(field)}</span><span class="text-slate-400">=</span><span class="text-indigo-700 font-semibold">${esc(val)}</span>`;
      });
      return `<span class="text-slate-400">[</span>${segs.join('<span class="text-slate-400">, </span>')}<span class="text-slate-400">]</span>`;
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
 * statusFilter 过滤：判断某棵子树在当前状态过滤下是否「完全没有可展示内容」。
 * filter 为一个集合（Set），包含当前勾选要展示的状态：'added' | 'removed' | 'changed' | 'same'。
 * - 叶子 value 节点：其 status 不在 filter 中即应被过滤（无内容）。
 * - 整块 added/removed 的对象/数组：同理按自身 status 判断。
 * - 普通容器节点：当其所有子节点都被过滤时，自身也无内容可展示。
 * @returns true 表示该节点在当前过滤下应被隐藏（无任何可展示内容）
 */
function isFilteredOut(node, filter) {
  if (!filter) return false; // 无过滤集合 = 全部展示

  const isLeaf = node.type === 'value';
  const isWholeContainer = (node.type === 'object' || node.type === 'array')
    && (node.status === 'added' || node.status === 'removed');

  if (isLeaf || isWholeContainer) {
    return !filter.has(node.status);
  }

  // 普通容器：若所有子节点都被过滤，则该容器也无内容
  const children = node.children || [];
  if (children.length === 0) {
    return !filter.has(node.status);
  }
  return children.every(c => isFilteredOut(c, filter));
}

/**
 * 渲染单个节点
 * @param {DiffNode} node
 * @param {object} opts { hideSame }
 * @param {boolean} isArrayItem 父节点是否数组
 * @param {number} depth 缩进深度
 */
// 容器节点自增 id，保证折叠/展开能精确定位到「本节点自己的直接子级」
let __nodeSeq = 0;

function renderNode(node, opts, isArrayItem, depth) {
  // 隐藏相同项
  if (opts.hideSame && isAllSame(node)) return '';

  // 状态过滤（图例复选框）：当前节点在过滤下完全无可展示内容则跳过
  if (opts.statusFilter && isFilteredOut(node, opts.statusFilter)) return '';

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

    // 子节点全被隐藏（隐藏相同 / 状态过滤）则不显示该父节点（根节点除外，根始终保留容器）
    if (childrenHtml.trim() === '' && node.key !== 'root') return '';

    const meta = node.meta || {};
    let metaTag = '';
    if (node.type === 'object') {
      const cntCls = meta.keyCountEqual ? 'text-slate-400' : 'text-amber-600 font-semibold';
      metaTag = `<span class="ml-2 text-xs ${cntCls}">key数量 A:${meta.leftKeyCount} / B:${meta.rightKeyCount}${meta.keyCountEqual ? '' : ' ⚠'}</span>`;
      if (meta.keyCountEqual && meta.sameKeys === false) {
        metaTag += `<span class="ml-2 text-xs text-amber-600">key不一致 ⚠</span>`;
      }
      if (meta.objectMatchKey) {
        const keyFields = Array.isArray(meta.objectMatchKey) ? meta.objectMatchKey : [meta.objectMatchKey];
        const keyLabel = keyFields.map(f => esc(f)).join(' + ');
        const keyTitle = keyFields.length > 1 ? '复合主键' : '主键';
        metaTag += `<span class="ml-2 text-xs bg-violet-100 text-violet-700 px-1.5 rounded">对象按${keyTitle}「${keyLabel}」校验</span>`;
        if (meta.objectKeyChanged) {
          metaTag += `<span class="ml-2 text-xs bg-amber-200 text-amber-700 px-1.5 rounded"><i class="ri-error-warning-line"></i> 主键值不同</span>`;
        }
      }
    } else {
      const cntCls = meta.lengthEqual ? 'text-slate-400' : 'text-amber-600 font-semibold';
      metaTag = `<span class="ml-2 text-xs ${cntCls}">长度 A:${meta.leftLength} / B:${meta.rightLength}${meta.lengthEqual ? '' : ' ⚠'}</span>`;
      if (meta.matchKey) {
        // matchKey 单主键为字符串，复合主键为数组：统一为字段数组后用「+」连接展示
        const keyFields = Array.isArray(meta.matchKey) ? meta.matchKey : [meta.matchKey];
        const keyLabel = keyFields.map(f => esc(f)).join(' + ');
        const keyTitle = keyFields.length > 1 ? '复合主键' : '主键';
        metaTag += `<span class="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 rounded">按${keyTitle}「${keyLabel}」对比</span>`;
        // 按主键去重后的长度（同一主键值的重复元素只计一次），与原始长度并列展示
        if (meta.leftUniqueCount !== undefined && meta.rightUniqueCount !== undefined) {
          const uCls = meta.uniqueCountEqual ? 'text-slate-400' : 'text-amber-600 font-semibold';
          metaTag += `<span class="ml-2 text-xs ${uCls}" title="按主键去重后的元素数量">去重长度 A:${meta.leftUniqueCount} / B:${meta.rightUniqueCount}${meta.uniqueCountEqual ? '' : ' ⚠'}</span>`;
        }
      }
      // 需求：数组元素个数不同 → 归为「值不同」，加徽章明确提示
      if (meta.lengthChanged) {
        metaTag += `<span class="ml-2 text-xs bg-amber-200 text-amber-700 px-1.5 rounded"><i class="ri-error-warning-line"></i> 值不同(个数)</span>`;
      }
    }

    const bracket = node.type === 'array' ? '[ ]' : '{ }';
    const keyLabel = node.key === 'root'
      ? `<span class="text-indigo-600 font-bold">根节点</span>`
      : fmtKey(node, isArrayItem);

    const hasDiff = node.status !== 'same';
    const nid = ++__nodeSeq;
    // 初始折叠态：由「展开层级」控制。
    // depth=0 为根节点；展开 N 层表示根节点下前 N 层 JSON 节点展开，N 层以下折叠。
    // expandLevel=0 即「折叠全部」：根节点可见，所有子级 JSON 节点先折叠。
    const expandLevel = Number.isFinite(Number(opts.expandLevel)) ? Number(opts.expandLevel) : 0;
    const collapsed = node.key !== 'root' && depth >= expandLevel;
    const childHidden = collapsed ? ' hidden' : '';
    const iconCls = collapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line';
    return `
      <div class="diff-node" data-has-diff="${hasDiff ? '1' : '0'}" style="padding-left:${pad}px">
        <div class="flex items-center gap-1 py-1 group">
          <i class="${iconCls} text-slate-400 toggle-icon cursor-pointer" data-toggle="${nid}"></i>
          ${keyLabel}
          <span class="text-slate-400">: ${bracket}</span>
          ${metaTag}
          ${node.meta && node.meta.changedCount ? `<span class="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 rounded">${node.meta.changedCount} 处差异</span>` : ''}
        </div>
        <div class="node-children border-l border-slate-200 ml-1${childHidden}" data-children="${nid}">
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
  __nodeSeq = 0; // 每次渲染重置节点计数
  const html = renderNode(rootNode, opts, false, 0);
  if (html.trim() === '') {
    // 区分「无差异」与「被筛选/隐藏后无内容」
    const filtered = opts.statusFilter && opts.statusFilter.size < 4;
    if (filtered) {
      container.innerHTML = `<div class="text-center text-slate-400 py-12"><i class="ri-filter-off-line text-4xl block mb-2"></i>当前筛选条件下没有可展示的内容<br/><span class="text-xs">请在上方勾选要展示的差异类型</span></div>`;
    } else {
      container.innerHTML = `<div class="text-center text-emerald-500 py-12"><i class="ri-checkbox-circle-line text-4xl block mb-2"></i>两侧 JSON 完全一致（无差异）</div>`;
    }
    return;
  }
  container.innerHTML = html;
  // 初始折叠态已在渲染期通过 class 写好（含差异分支展开 / 纯相同分支折叠）
  bindToggle(container);
}

// 折叠/展开交互：采用「事件委托」绑定到容器本身，
// 这样无论差异树如何重渲染、图标内部结构如何，点击 .toggle-icon 都能稳定触发，
// 不会出现重复绑定或绑定丢失导致的「点击无效」。
function bindToggle(container) {
  // 防止重复绑定：同一容器只委托一次
  if (container.__toggleBound) return;
  container.__toggleBound = true;

  container.addEventListener('click', (e) => {
    const icon = e.target.closest('.toggle-icon[data-toggle]');
    if (!icon || !container.contains(icon)) return;
    e.stopPropagation();
    const id = icon.getAttribute('data-toggle');
    const children = container.querySelector(`.node-children[data-children="${id}"]`);
    if (!children) return;
    const collapsed = children.classList.toggle('hidden');
    icon.classList.toggle('ri-arrow-down-s-line', !collapsed);
    icon.classList.toggle('ri-arrow-right-s-line', collapsed);
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
    // 需求：数组元素个数不同，归为「值不同」——为该数组本身记一条 changed
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
