// fieldfill.js —— 第五步「字段回填」核心模块
// 职责：
//   1. 扫描左侧（旧）JSON，列出所有可选字段路径（排除作为主键的字段）
//   2. 提供路径渲染与搜索过滤
//   3. 基于「对象数组主键」对齐左右两侧同一对象，将左侧指定字段的 value 回填到右侧
//      —— 右侧该字段不存在则新增，存在则用左侧 value 覆盖
//
// 路径规范化规则（与 arraykey.js / diff.js 保持一致）：
//   - 对象 key 用 ".key"（根层无前缀点）
//   - 对象数组下层统一用 "path[]" 占位（不区分具体下标），以便复用 arrayKeyMap 主键映射

function isPlainObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isObjectArray(arr) {
  return Array.isArray(arr) && arr.some(isPlainObj);
}

// ---------- 主键归一化（支持单主键 / 复合主键，与 diff.js 保持一致） ----------
// 主键值可能是：'' / undefined（未选）、字符串（单主键）、字符串数组（复合主键）。
// 统一转为「字段名数组」，空数组表示未选主键。
function toKeyFields(v) {
  if (Array.isArray(v)) return v.filter(s => typeof s === 'string' && s !== '');
  if (typeof v === 'string' && v !== '') return [v];
  return [];
}

// 由一个对象元素 + 主键字段数组，生成用于匹配的复合键值。
// 任一主键字段缺失则返回 undefined（不可匹配）。
function compositeKeyOf(item, fields) {
  if (!isPlainObj(item) || !fields.length) return undefined;
  const parts = [];
  for (const f of fields) {
    if (item[f] === undefined) return undefined;
    parts.push(String(item[f]));
  }
  return parts.join('\u0001');
}

// 值的简短预览
export function previewValue(v) {
  if (v === undefined) return '（缺失）';
  if (v === null) return 'null';
  if (Array.isArray(v)) {
    const s = JSON.stringify(v);
    return s.length > 50 ? `[Array(${v.length})] ${s.slice(0, 50)}…` : s;
  }
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 50 ? s.slice(0, 50) + '…' : s;
  }
  if (typeof v === 'string') return `"${v.length > 40 ? v.slice(0, 40) + '…' : v}"`;
  return String(v);
}

/**
 * 扫描左侧 JSON，收集所有「字段路径」。
 * 每个对象数组下层的元素字段以 path[] 占位聚合，避免按下标爆炸。
 * @param {*} left 左侧 JSON 对象
 * @param {Object} arrayKeyMap { 数组路径: 主键字段 }，用于标记/排除主键
 * @returns Array<{ path, fieldName, arrayPath, isArrayItemField, isPrimaryKey, type, sampleValue }>
 *   - path：规范化路径（可读 + 用于回填匹配）
 *   - arrayPath：该字段所属的对象数组路径（若该字段位于对象数组元素内），否则 ''
 *   - isArrayItemField：是否为对象数组元素内的字段
 *   - isPrimaryKey：是否为其所属对象数组当前选定的主键字段
 */
export function scanLeftPaths(left, arrayKeyMap = {}) {
  const acc = new Map(); // path -> meta（去重，对象数组层多个元素只记一次）

  function add(path, meta) {
    if (!acc.has(path)) acc.set(path, Object.assign({ path }, meta));
  }

  // node：当前值；path：当前规范化路径；arrayCtx：所属对象数组路径（无则 ''）
  function walk(node, path, arrayCtx) {
    if (isPlainObj(node)) {
      Object.keys(node).forEach(k => {
        const childPath = path ? `${path}.${k}` : k;
        const v = node[k];
        const isArrItemField = !!arrayCtx;
        const pkFields = arrayCtx ? toKeyFields(arrayKeyMap[arrayCtx]) : [];
        const isPk = isArrItemField && pkFields.includes(k);
        add(childPath, {
          fieldName: k,
          arrayPath: arrayCtx || '',
          isArrayItemField: isArrItemField,
          isPrimaryKey: isPk,
          type: valType(v),
          sampleValue: v,
        });
        // 继续向下递归（嵌套对象 / 数组）
        walk(v, childPath, arrayCtx);
      });
    } else if (Array.isArray(node)) {
      if (isObjectArray(node)) {
        // 进入对象数组：元素层路径统一加 [] 占位，并将该数组路径作为新的 arrayCtx
        const elemPath = `${path}[]`;
        const elemArrayCtx = path; // 数组本身路径用于匹配 arrayKeyMap
        // 取第一个对象样本递归（字段层去重即可）
        node.forEach(item => {
          if (isPlainObj(item)) walk(item, elemPath, elemArrayCtx);
        });
      }
      // 简单类型数组不展开下标（其本身作为一个字段已在父层登记）
    }
  }

  walk(left, '', '');
  return Array.from(acc.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function valType(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * 执行回填：把左侧选中字段的 value 应用到右侧（按主键匹配同一对象）。
 * @param {*} left 左侧 JSON（旧）
 * @param {*} right 右侧 JSON（新，将被修改的深拷贝目标）
 * @param {string[]} selectedPaths 选中的字段规范化路径列表
 * @param {Object} arrayKeyMap { 数组路径: 主键字段 }
 * @returns { result, logs } result=回填后的新 JSON；logs=每条操作记录
 */
export function applyFieldFill(left, right, selectedPaths, arrayKeyMap = {}) {
  // 深拷贝右侧，避免污染原对象
  const result = JSON.parse(JSON.stringify(right));
  const logs = [];

  selectedPaths.forEach(path => {
    fillOnePath(left, result, path, arrayKeyMap, logs);
  });

  return { result, logs };
}

/**
 * 处理单个字段路径的回填。
 * 思路：把规范化路径按段解析，沿左右两侧同步下钻；
 *   - 遇到普通对象 key：左右各进入该 key
 *   - 遇到 "[]"（对象数组）：用该数组的主键，把左侧每个元素匹配到右侧同主键元素，再对齐后续路径
 * 到达最后一段时执行赋值（不存在新增 / 存在覆盖）。
 */
function fillOnePath(leftRoot, rightRoot, path, arrayKeyMap, logs) {
  // 将路径拆成 token 序列：{ kind:'key', name } | { kind:'arr', arrayPath }
  const tokens = parsePath(path);

  // 递归对齐：leftNode/rightNode 为当前同一层级的左右节点
  function recurse(leftNode, rightNode, idx, displayPath) {
    if (idx >= tokens.length) return;
    const tk = tokens[idx];
    const isLast = idx === tokens.length - 1;

    if (tk.kind === 'key') {
      if (!isPlainObj(leftNode)) return; // 左侧无此对象，跳过
      if (!Object.prototype.hasOwnProperty.call(leftNode, tk.name)) return; // 左侧无此字段
      if (!isPlainObj(rightNode)) return; // 右侧不是对象，无法写入

      if (isLast) {
        const leftVal = leftNode[tk.name];
        const existed = Object.prototype.hasOwnProperty.call(rightNode, tk.name);
        const oldVal = existed ? rightNode[tk.name] : undefined;
        rightNode[tk.name] = JSON.parse(JSON.stringify(leftVal));
        logs.push({
          path: displayPath + tk.name,
          action: existed ? 'replaced' : 'added',
          oldValue: oldVal,
          newValue: leftVal,
        });
      } else {
        recurse(leftNode[tk.name], rightNode[tk.name], idx + 1, displayPath + tk.name);
      }
    } else if (tk.kind === 'arr') {
      // 当前 leftNode/rightNode 应为「对象数组」字段值（数组）
      if (!Array.isArray(leftNode) || !Array.isArray(rightNode)) return;
      const pkFields = toKeyFields(arrayKeyMap[tk.arrayPath]);
      if (!pkFields.length) {
        // 无主键：按下标对齐
        const len = Math.min(leftNode.length, rightNode.length);
        for (let i = 0; i < len; i++) {
          recurse(leftNode[i], rightNode[i], idx + 1, displayPath + `[${i}]`);
        }
        return;
      }
      // 有（复合）主键：构建右侧复合键索引
      const rightIndex = new Map();
      rightNode.forEach(item => {
        const k = compositeKeyOf(item, pkFields);
        if (k !== undefined) rightIndex.set(k, item);
      });
      leftNode.forEach(litem => {
        const keyVal = compositeKeyOf(litem, pkFields);
        if (keyVal === undefined) return;
        const ritem = rightIndex.get(keyVal);
        if (ritem) {
          const label = pkFields.map(f => `${f}=${litem[f]}`).join(',');
          recurse(litem, ritem, idx + 1, displayPath + `[${label}]`);
        }
        // 右侧无同主键对象：不创建新对象（仅回填字段，不改变对象数量）
      });
    }
  }

  // tokens 的第一段如果是 arr，则当前层就是数组，需要先定位到该数组本身。
  // 但 parsePath 已把 "a[]" 拆为 key:a + arr。根层直接从 root 开始。
  recurse(leftRoot, rightRoot, 0, '');
}

/**
 * 解析规范化路径为 token 序列。
 * 例："team[].role" -> [ {kind:'key',name:'team'}, {kind:'arr',arrayPath:'team'}, {kind:'key',name:'role'} ]
 *     "a.b" -> [ {key a}, {key b} ]
 *     "list[].sub[].x" -> [ key list, arr list, key sub, arr 'list[].sub', key x ]
 */
function parsePath(path) {
  const tokens = [];
  // accFull：已走过路径的「含 [] 占位」完整前缀，用于拼接下一段（与 scanLeftPaths 一致）
  let accFull = '';
  const segs = path.split('.');
  segs.forEach((seg) => {
    // seg 形如 "team" 或 "team[]" 或 "sub[][]"
    const m = seg.match(/^([^\[]+)((?:\[\])*)$/);
    const name = m ? m[1] : seg;
    const brackets = m ? m[2] : '';
    tokens.push({ kind: 'key', name });

    // 该字段（数组本身）的规范路径 = accFull + name
    let arrPath = accFull ? `${accFull}.${name}` : name;
    const bracketCount = brackets.length / 2; // 每两个字符 "[]" 为一层
    for (let b = 0; b < bracketCount; b++) {
      // arrPath 即该层对象数组在 arrayKeyMap 中的键
      tokens.push({ kind: 'arr', arrayPath: arrPath });
      arrPath = `${arrPath}[]`;
    }
    // 更新累积前缀（含 [] 占位），供后续段拼接
    accFull = (accFull ? `${accFull}.${name}` : name) + brackets;
  });
  return tokens;
}

/**
 * 统计某字段「匹配回填」的值分布。
 * 口径与字段项「匹配 N」徽章完全一致：对该单字段执行回填，统计实际命中（logs）的 newValue 出现次数。
 * @param {*} left 左侧 JSON（旧）
 * @param {*} right 右侧 JSON（新）
 * @param {string} path 字段规范化路径
 * @param {Object} arrayKeyMap { 数组路径: 主键字段 }
 * @returns { total, stats } total=匹配总数；stats=Array<{ valueText, rawValue, count }>，按 count 倒序
 */
export function collectFieldValueStats(left, right, path, arrayKeyMap = {}) {
  let logs = [];
  try {
    const r = applyFieldFill(left, right, [path], arrayKeyMap);
    logs = r.logs || [];
  } catch (e) {
    logs = [];
  }

  const map = new Map(); // 规范化值文本 -> { valueText, rawValue, count }
  logs.forEach(l => {
    // 用 JSON 序列化作为聚合键，保证对象/数组也能精确归并
    let keyStr;
    try { keyStr = JSON.stringify(l.newValue); } catch (e) { keyStr = String(l.newValue); }
    if (keyStr === undefined) keyStr = 'undefined';
    if (map.has(keyStr)) {
      map.get(keyStr).count++;
    } else {
      map.set(keyStr, { valueText: fullValueText(l.newValue), rawValue: l.newValue, count: 1 });
    }
  });

  const stats = Array.from(map.values()).sort((a, b) => (b.count - a.count) || a.valueText.localeCompare(b.valueText));
  return { total: logs.length, stats };
}

// 值的完整文本（弹窗展示用，不截断；对象/数组用紧凑 JSON）
function fullValueText(v) {
  if (v === undefined) return '（缺失）';
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }
  return String(v);
}
