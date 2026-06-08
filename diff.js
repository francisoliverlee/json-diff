// diff.js —— JSON 对比核心算法模块
// 严格按照需求规则实现：
//   1. 对象对比：先比 key 数量；数量相同再比 key 是否一致；相同 key 再比 value 差异
//   2. 数组对比：先比个数；简单类型按下标对比；对象数组按对象规则对比
//   3. 支持选项：忽略大小写 / 忽略时间格式差异 / （隐藏相同项由渲染层处理）

/**
 * 差异节点结构（统一抽象，供渲染层使用）
 * {
 *   key: string,            // 当前节点的 key 或数组下标
 *   type: 'object'|'array'|'value', // 节点种类
 *   status: 'same'|'added'|'removed'|'changed'|'parent', // 差异状态
 *   left:  any,             // 左侧原始值
 *   right: any,             // 右侧原始值
 *   children: DiffNode[],   // 子节点（object/array 才有）
 *   meta: {...}             // 附加信息，如 key 数量对比结果
 * }
 */

// ---------- 工具函数 ----------

// 判断值的基本类型类别
function kindOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v; // 'object' | 'string' | 'number' | 'boolean' | 'undefined'
}

// 是否为"对象"（普通对象，非数组非 null）
function isPlainObject(v) {
  return kindOf(v) === 'object';
}

// 是否为简单类型（数字、字符串、布尔、null）
function isPrimitive(v) {
  const k = kindOf(v);
  return k === 'number' || k === 'string' || k === 'boolean' || k === 'null' || k === 'undefined';
}

// 常见时间格式正则集合：ISO8601、yyyy-MM-dd、yyyy/MM/dd HH:mm:ss、时间戳(10/13位) 等
const TIME_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/, // ISO8601
  /^\d{4}[-/]\d{1,2}[-/]\d{1,2}([ T]\d{1,2}:\d{1,2}(:\d{1,2})?)?$/,     // 日期或日期时间
  /^\d{1,2}:\d{1,2}(:\d{1,2})?$/,                                       // 纯时间
];

// 判断一个字符串是否像时间
function looksLikeTime(s) {
  if (typeof s !== 'string') return false;
  const str = s.trim();
  if (TIME_PATTERNS.some(re => re.test(str))) return true;
  // 尝试用 Date 解析兜底（要求包含日期分隔符，避免把纯数字误判）
  if (/[-/:T]/.test(str) && str.length >= 8) {
    const t = Date.parse(str);
    if (!isNaN(t)) return true;
  }
  return false;
}

// 将两个时间字符串归一化为时间戳后比较，无法解析则退回原始比较
function timeEqual(a, b) {
  const ta = Date.parse(String(a).trim());
  const tb = Date.parse(String(b).trim());
  if (!isNaN(ta) && !isNaN(tb)) return ta === tb;
  return false;
}

/**
 * 比较两个简单值是否相等（考虑选项）
 * @param {*} a 左值
 * @param {*} b 右值
 * @param {object} opts { ignoreCase, ignoreTime }
 */
function primitiveEqual(a, b, opts) {
  // 忽略时间：只要任一侧的 value 是日期/时间类型，则跳过比较，直接视为相同
  if (opts.ignoreTime && (looksLikeTime(a) || looksLikeTime(b))) {
    return true;
  }

  // 类型不同：视为不相等
  if (kindOf(a) !== kindOf(b)) {
    return false;
  }

  if (typeof a === 'string') {
    let x = a;
    let y = b;
    if (opts.ignoreCase) {
      x = x.toLowerCase();
      y = y.toLowerCase();
    }
    return x === y;
  }

  return a === b;
}

// ---------- 核心对比 ----------

/**
 * 入口：对比任意两个 JSON 值
 * @returns {DiffNode}
 */
export function diffJSON(left, right, opts = {}) {
  const options = {
    ignoreCase: !!opts.ignoreCase,
    ignoreTime: !!opts.ignoreTime,
    arrayKeys: opts.arrayKeys || {}, // { path: 主键字段 }，空字符串表示按下标
  };
  return diffValue('root', left, right, options, '');
}

// 对比任意两个值，自动分流到 对象/数组/简单值
// path：当前节点在数据中的规范化路径（用于匹配 arrayKeys，数组层用 [] 占位）
function diffValue(key, left, right, opts, path) {
  const lk = kindOf(left);
  const rk = kindOf(right);

  // 一侧缺失（用于子节点判定 added/removed，由调用方处理；这里只处理类型）
  // 双方都是对象 -> 对象对比
  if (isPlainObject(left) && isPlainObject(right)) {
    return diffObject(key, left, right, opts, path);
  }
  // 双方都是数组 -> 数组对比
  if (lk === 'array' && rk === 'array') {
    return diffArray(key, left, right, opts, path);
  }

  // 类型不同（如对象 vs 数组、对象 vs 简单值）：视为 changed 的 value 节点
  if (lk !== rk) {
    return {
      key, type: 'value', status: 'changed',
      left, right, children: [], meta: { reason: 'type-mismatch', leftType: lk, rightType: rk }
    };
  }

  // 双方都是简单值
  const same = primitiveEqual(left, right, opts);
  return {
    key, type: 'value', status: same ? 'same' : 'changed',
    left, right, children: [], meta: {}
  };
}

/**
 * 对象对比规则：
 *   1.1 对比 key 数量
 *   1.2 数量相同 -> 对比 key 是否相同 -> 相同 key 对比 value
 * 展示需求：对象 key 按字母升序展示（此处即排序）
 */
function diffObject(key, left, right, opts, path) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  // 合并所有 key 并按字母升序（需求 3.2）
  const allKeys = Array.from(new Set([...leftKeys, ...rightKeys]))
    .sort((a, b) => a.localeCompare(b));

  const children = [];
  let changedCount = 0;

  for (const k of allKeys) {
    const hasL = Object.prototype.hasOwnProperty.call(left, k);
    const hasR = Object.prototype.hasOwnProperty.call(right, k);
    const childPath = path ? `${path}.${k}` : k;

    if (hasL && !hasR) {
      children.push({
        key: k, type: kindOf(left[k]) === 'array' ? 'array' : (isPlainObject(left[k]) ? 'object' : 'value'),
        status: 'removed', left: left[k], right: undefined, children: [], meta: {}
      });
      changedCount++;
    } else if (!hasL && hasR) {
      children.push({
        key: k, type: kindOf(right[k]) === 'array' ? 'array' : (isPlainObject(right[k]) ? 'object' : 'value'),
        status: 'added', left: undefined, right: right[k], children: [], meta: {}
      });
      changedCount++;
    } else {
      const child = diffValue(k, left[k], right[k], opts, childPath);
      if (child.status !== 'same') changedCount++;
      children.push(child);
    }
  }

  // 节点整体状态
  const status = children.every(c => c.status === 'same') ? 'same' : 'parent';

  return {
    key, type: 'object', status,
    left, right, children,
    meta: {
      leftKeyCount: leftKeys.length,
      rightKeyCount: rightKeys.length,
      keyCountEqual: leftKeys.length === rightKeys.length,
      sameKeys: leftKeys.length === rightKeys.length &&
        leftKeys.slice().sort().join(',') === rightKeys.slice().sort().join(','),
      changedCount,
    }
  };
}

/**
 * 数组对比规则：
 *   2. 主要对比数组个数
 *   2.1 简单类型元素：按下标顺序对比
 *   2.2 对象数组：按对象对比规则对比
 * 展示需求：按数组下标顺序输出（这里即保持下标顺序）
 */
function diffArray(key, left, right, opts, path) {
  const childPath = path; // 数组本身的路径即用于匹配 arrayKeys
  const arrayKeys = opts.arrayKeys || {};
  const pk = arrayKeys[childPath]; // 主键字段；undefined 或 '' 表示按下标

  // 元素子节点的递归路径：数组内层用 path[] 占位（与 arraykey.js 扫描一致）
  const elemPath = childPath ? `${childPath}[]` : '[]';

  // 判断是否为对象数组（任一侧元素含普通对象）
  const isObjArr = (arr) => arr.some(v => isPlainObject(v));

  // ---- 按主键对比对象数组 ----
  if (pk && (isObjArr(left) || isObjArr(right))) {
    return diffArrayByKey(key, left, right, opts, elemPath, pk);
  }

  // ---- 默认：按下标顺序对比 ----
  const maxLen = Math.max(left.length, right.length);
  const children = [];
  let changedCount = 0;

  for (let i = 0; i < maxLen; i++) {
    const hasL = i < left.length;
    const hasR = i < right.length;

    if (hasL && !hasR) {
      const v = left[i];
      children.push({
        key: i, type: kindOf(v) === 'array' ? 'array' : (isPlainObject(v) ? 'object' : 'value'),
        status: 'removed', left: v, right: undefined, children: [], meta: {}
      });
      changedCount++;
    } else if (!hasL && hasR) {
      const v = right[i];
      children.push({
        key: i, type: kindOf(v) === 'array' ? 'array' : (isPlainObject(v) ? 'object' : 'value'),
        status: 'added', left: undefined, right: v, children: [], meta: {}
      });
      changedCount++;
    } else {
      // 下标都存在：递归对比（对象数组会进入 diffObject，简单类型进入简单比较）
      const child = diffValue(i, left[i], right[i], opts, elemPath);
      if (child.status !== 'same') changedCount++;
      children.push(child);
    }
  }

  // 双方长度相同且所有子节点都相同（含双方均为空数组）视为相同
  const status = left.length === right.length && children.every(c => c.status === 'same')
    ? 'same' : 'parent';

  return {
    key, type: 'array', status,
    left, right, children,
    meta: {
      leftLength: left.length,
      rightLength: right.length,
      lengthEqual: left.length === right.length,
      changedCount,
    }
  };
}

/**
 * 按主键对比对象数组：以元素的 pk 字段值作为匹配键，
 * 同键的对象整体按对象规则对比；仅一侧存在的标记 added/removed。
 * 展示顺序：左侧顺序优先，右侧新增的追加在后。
 */
function diffArrayByKey(key, left, right, opts, elemPath, pk) {
  const keyOf = (item) => (isPlainObject(item) && item[pk] !== undefined) ? String(item[pk]) : undefined;

  const leftMap = new Map();
  const rightMap = new Map();
  left.forEach(item => { const k = keyOf(item); if (k !== undefined) leftMap.set(k, item); });
  right.forEach(item => { const k = keyOf(item); if (k !== undefined) rightMap.set(k, item); });

  // 主键展示顺序：左侧出现顺序 + 右侧独有
  const order = [];
  const seen = new Set();
  left.forEach(item => { const k = keyOf(item); if (k !== undefined && !seen.has(k)) { seen.add(k); order.push(k); } });
  right.forEach(item => { const k = keyOf(item); if (k !== undefined && !seen.has(k)) { seen.add(k); order.push(k); } });

  const children = [];
  let changedCount = 0;

  for (const k of order) {
    const hasL = leftMap.has(k);
    const hasR = rightMap.has(k);
    const childKey = `${pk}=${k}`; // 用主键标识替代下标展示

    if (hasL && !hasR) {
      children.push({
        key: childKey, type: 'object', status: 'removed',
        left: leftMap.get(k), right: undefined, children: [], meta: { byKey: true }
      });
      changedCount++;
    } else if (!hasL && hasR) {
      children.push({
        key: childKey, type: 'object', status: 'added',
        left: undefined, right: rightMap.get(k), children: [], meta: { byKey: true }
      });
      changedCount++;
    } else {
      const child = diffValue(childKey, leftMap.get(k), rightMap.get(k), opts, elemPath);
      child.meta = Object.assign({}, child.meta, { byKey: true });
      if (child.status !== 'same') changedCount++;
      children.push(child);
    }
  }

  const status = left.length === right.length && children.every(c => c.status === 'same')
    ? 'same' : 'parent';

  return {
    key, type: 'array', status,
    left, right, children,
    meta: {
      leftLength: left.length,
      rightLength: right.length,
      lengthEqual: left.length === right.length,
      changedCount,
      matchKey: pk, // 标记此数组按主键对比
    }
  };
}

// 导出工具供渲染层判断
export { kindOf, isPlainObject, isPrimitive };
