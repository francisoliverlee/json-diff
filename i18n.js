// i18n.js —— 中英双语语言包
// 用法：import { t, setLang, currentLang } from './i18n.js';
// HTML 中用 data-i18n="key" 标记需要动态翻译的元素，初始化时自动填充

const zh = {
  // ---------- 顶部标题 ----------
  'app.title': 'JSON 可视化对比',

  // ---------- 步骤导航 ----------
  'step.1.title': '对比规则',
  'step.1.subtitle': '了解对比逻辑',
  'step.2.title': '对比文件',
  'step.2.subtitle': '输入左右 JSON',
  'step.3.title': '对比主键',
  'step.3.subtitle': '对象/对象数组主键',
  'step.4.title': '对比结果',
  'step.4.subtitle': '差异可视化',
  'step.5.title': '对比回填',
  'step.5.subtitle': '用旧值覆盖新JSON',

  // ---------- 左侧工具栏 ----------
  'tool.title': '工具',
  'tool.clearCache': '清理缓存',
  'tool.clearCacheDesc': '清除本工具在本地存储的全部数据（Cookie、localStorage、sessionStorage 等）。',

  // ---------- 第1步：对比规则 ----------
  'rule.obj.title': '一、对象（Object）对比',
  'rule.obj.1': '先对比两侧对象的 <b>Key 数量</b>，数量不同会高亮提示。',
  'rule.obj.2': 'Key 数量相同时，进一步对比 <b>Key 是否完全一致</b>，不一致会提示「key不一致」。',
  'rule.obj.3': '对相同的 Key，再逐一对比其 <b>Value 差异</b>。',
  'rule.obj.4': '仅左侧（A）存在的 Key 标记为 <b>「仅A有」</b>；仅右侧（B）存在的标记为 <b>「仅B有」</b>。',
  'rule.arr.title': '二、数组（Array）对比',
  'rule.arr.1': '首先对比两侧数组的 <b>元素个数（长度）</b>，长度不同会高亮提示。',
  'rule.arr.2': '元素为<b>简单类型</b>（数字、字符串、布尔等）时，不需要设置主键，只按<b>元素个数（长度）</b>判断差异，不比较具体元素值。',
  'rule.arr.3': '元素为<b>对象</b>时，按上述「对象对比规则」递归对比，并可在第三步选择对比主键。',
  'rule.arr.4': '多出/缺失的元素分别标记为「仅B有」/「仅A有」。',
  'rule.opts.title': '三、可选开关',
  'rule.opts.ignoreCase': '<b>忽略大小写</b>：字符串 Value 比较时不区分大小写，如 <code class="bg-slate-100 px-1 rounded">"Alice"</code> 与 <code class="bg-slate-100 px-1 rounded">"alice"</code> 视为相同。',
  'rule.opts.ignoreTime': '<b>忽略时间/日期类型的 Value</b>：若 Value 是日期或时间类型，则<b>跳过比较</b>，直接视为相同（无论格式是否不同）。',
  'rule.opts.hideSame': '<b>隐藏相同的 Key/Value</b>：仅展示存在差异的节点，相同项不显示（默认开启）。',
  'rule.opts.expand': '<b>展开层级</b>：可选择「折叠全部」或仅展开前 N 层 JSON 节点，第一层以下节点会按所选层级自动折叠。',
  'rule.display.title': '四、差异展示规则',
  'rule.display.1': '数组元素按 <b>下标顺序</b>（或所选主键顺序）展示差异。',
  'rule.display.2': '对象的 Key 先按 <b>字母升序</b>排序后再展示。',
  'rule.display.3': '<b>值不同</b>时，展示形式为：<code class="bg-slate-100 px-1 rounded">左value &lt;------&gt; 右value</code>。',
  'rule.display.4': '<b>仅左侧（A）有</b>的 Key，提示标签写在 Key 的<b>左侧</b>；<b>仅右侧（B）有</b>的 Key，提示标签写在 Key 的<b>右侧</b>。',
  'rule.legend.a': '仅A有',
  'rule.legend.b': '仅B有',
  'rule.legend.changed': '值不同',
  'rule.legend.same': '相同',
  'rule.btn.next': '下一步：选择文件',

  // ---------- 第2步 ----------
  'step2.left.label': '左侧【旧】 JSON (A)',
  'step2.left.btn': '选择【旧JSON】本地文件',
  'step2.right.label': '右侧【新】 JSON (B)',
  'step2.right.btn': '选择【新JSON】本地文件',
  'step2.waiting': '等待输入…',
  'step2.btn.prev': '上一步',
  'step2.btn.next': '下一步：选择主键',

  // ---------- 第3步 ----------
  'step3.tip': '检测到 JSON 中包含对象或对象数组时，可为其选择<b>对比主键</b>：对象主键用于校验同层对象身份字段，对象数组主键用于让相同主键的数组元素整体对齐对比，而非按下标。<br/>支持选择多个字段组成<b>复合主键</b>；对象主键可选，对象数组主键必选。当前最多支持 <b>{depth} 层</b> JSON 层级，超过后会提示不支持。',
  'step3.prevTarget': '上一个目标',
  'step3.nextTarget': '下一个目标',
  'step3.targetCounter': '第 {cur} / {total} 个目标',
  'step3.empty': '请先在第二步填写有效的 JSON',
  'step3.noArrays': '两侧 JSON 中未检测到对象数组，<br/>简单数组和普通对象无需设置对比主键。',
  'step3.noSample': '无可预览样本',
  'step3.objArray': '对象数组',
  'step3.required': '必选',
  'step3.fieldsCount': '{n} 字段',
  'step3.choosePrompt': '点击下方字段作为{typeText}对比主键（可多选组成<b class="text-indigo-500 mx-0.5">复合主键</b>，按点击顺序联合匹配）',
  'step3.notSelected': '请为该对象数组选择至少一个主键字段（必选，不可使用下标对比）',
  'step3.selected': '已选{compound}主键：',
  'step3.compound': '复合',
  'step3.keyTag': '主键 {order}',
  'step3.btn.prev': '上一步',
  'step3.btn.next': '下一步：查看结果',
  'step3.alert.title': '请先为以下对象数组选择对比主键（对象主键可选；对象数组不允许使用数组下标 / 字段下标）：',

  // ---------- 第4步 ----------
  'step4.recompare': '重新对比',
  'step4.comparing': '对比中…',
  'step4.downloadStat': '下载对比明细',
  'step4.downloadStatTitle': '导出 4 个 Sheet 的表格：统计信息 + 仅A有 + 仅B有 + 值不同（含完整前缀路径）',
  'step4.stripPrefix': '去掉前缀（仅按最终 key 统计）',
  'step4.stripPrefixTitle': '打开：去掉路径前缀，仅按最终 key 名聚合统计；关闭：保留完整前缀路径',
  'step4.stripOn': '开',
  'step4.stripOff': '关',
  'step4.optionTitle': '对比选项',
  'step4.ignoreCase': '忽略大小写',
  'step4.ignoreTime': '忽略时间/日期类型的 value',
  'step4.ignoreTimeTitle': '若 value 是日期/时间类型，则跳过比较',
  'step4.hideSame': '隐藏相同的 Key/Value',
  'step4.expand': '展开层级',
  'step4.expand0': '折叠全部',
  'step4.expandN': '展开{level}层',
  'step4.fullscreen': '全屏查看',
  'step4.exitFullscreen': '退出全屏',
  'step4.fullscreenTitle': '全屏查看差异结果（ESC 退出）',
  'step4.loading': '进入此步骤将自动执行对比',
  'step4.loadingDetail': '正在加载对比数据…',
  'step4.loadingGen': '正在生成差异统计，请稍候…',
  'step4.loadingWait': '大文件解析和渲染可能需要几秒，请不要关闭页面',
  'step4.cantCompare': '无法对比，请返回第二步检查 JSON 输入',
  'step4.failed': '对比失败：',
  'step4.identical': '两侧 JSON 完全一致（无差异）',
  'step4.filteredEmpty': '当前筛选条件下没有可展示的内容<br/><span class="text-xs">请在上方勾选要展示的差异类型</span>',
  'step4.splitA': 'A / 旧 JSON',
  'step4.splitB': 'B / 新 JSON',
  'step4.btn.prev': '上一步',
  'step4.btn.edit': '修改输入',
  'step4.btn.next': '下一步：字段回填',

  // ---------- 第5步 ----------
  'step5.tip': '将<b>左侧（旧）JSON</b> 中指定字段的值，按<b>主键</b>回填到<b>右侧（新）JSON</b> 的同一对象：右侧该字段<b>不存在则新增</b>，<b>存在则用旧值覆盖</b>。<br/>下方仅列出对比结果中<b>值不同</b>且<b>非对象数组主键</b>的字段，可搜索、勾选后点击「执行替换」。',
  'step5.selected': '已选 {n} 项',
  'step5.execute': '执行替换',
  'step5.availTitle': '备选字段',
  'step5.availCount': '{n}',
  'step5.searchPlaceholder': '搜索字段路径，如 role / address.city / team[].role',
  'step5.availEmpty': '请先在第二步填写有效的 JSON',
  'step5.selTitle': '已选字段',
  'step5.clearAll': '全部移除',
  'step5.selPlaceholder': '从左侧选择字段加入此处',
  'step5.noDiff': '当前没有值不同且可回填的字段',
  'step5.allSelected': '全部字段均已加入右侧',
  'step5.noMatch': '没有匹配「{kw}」的字段路径',
  'step5.arrTag': '数组项·主键匹配',
  'step5.arrTagTitle': '位于对象数组「{path}」内，按主键匹配回填',
  'step5.matchN': '匹配 {n}',
  'step5.matchNTitle': '点击查看该字段全部匹配值的统计列表',
  'step5.noMatchTag': '无匹配',
  'step5.noMatchTagTitle': '右侧无主键匹配的对象，该字段回填不会生效',
  'step5.removeTitle': '点击移出已选',
  'step5.fillResult': '回填结果',
  'step5.copyResult': '复制结果 JSON',
  'step5.downloadResult': '下载 JSON',
  'step5.tabLeft': '与旧文件对比',
  'step5.tabRight': '与新文件对比',
  'step5.tabJson': '结果 JSON',
  'step5.tabLeftDesc': '回填结果（B\'）相对<b class="text-emerald-600 mx-1">旧文件 A</b>的差异',
  'step5.tabRightDesc': '回填结果（B\'）相对<b class="text-rose-600 mx-1">新文件 B</b>的差异',
  'step5.noFill': '未发生任何回填：可能右侧无主键匹配的对象，或所选字段在左侧不存在。',
  'step5.fillTotal': '共 {n} 处回填',
  'step5.fillAdded': '新增 {n}',
  'step5.fillReplaced': '覆盖 {n}',
  'step5.actionAdded': '新增',
  'step5.actionReplaced': '覆盖',
  'step5.btn.prev': '上一步',
  'step5.btn.edit': '修改输入',

  // ---------- 抽屉 ----------
  'drawer.title.removed': '仅 A 有的 Key',
  'drawer.title.added': '仅 B 有的 Key',
  'drawer.title.changed': '值不同的 Key',
  'drawer.total': '共 {n} 处差异，已按所在路径的差异数 <b>倒序</b>排列（全路径展示）',
  'drawer.prev': '上一页',
  'drawer.next': '下一页',
  'drawer.page': '第 {cur} / {total} 页',
  'drawer.empty': '该类别没有差异',
  'drawer.pathPrefix': '所在路径：',
  'drawer.pathCount': '该路径共 <b class="text-slate-600">{n}</b> 处差异',

  // ---------- 字段值统计弹窗 ----------
  'fieldStat.title': '字段值统计',
  'fieldStat.info': '字段 {path}，共匹配 {total} 处，{unique} 种不同取值（按数量倒序）',
  'fieldStat.prev': '上一页',
  'fieldStat.next': '下一页',
  'fieldStat.page': '第 {cur} / {total} 页',
  'fieldStat.empty': '该字段无匹配回填，暂无可统计的值',
  'fieldStat.unit': '个',
  'fieldStat.noMatch': '无匹配',

  // ---------- 图例 ----------
  'legend.removed': '仅A有',
  'legend.added': '仅B有',
  'legend.changed': '值不同',
  'legend.same': '相同',
  'legend.filterTitle.added': '勾选后在「根节点」差异树中展示「{label}」',
  'legend.filterTitle.removed': '勾选后在「根节点」差异树中展示「{label}」',
  'legend.filterTitle.changed': '勾选后在「根节点」差异树中展示「{label}」',
  'legend.filterTitle.same': '勾选后在「根节点」差异树中展示「{label}」',
  'legend.clickTitle': '点击查看「{label}」全部差异列表',
  'legend.none': '无',
  'legend.sameCount': '共 {n} 处相同',

  // ---------- 通用 ----------
  'common.loading': '正在加载并对比 JSON 数据…',
  'common.missing': '（缺失）',
  'common.copied': '已复制',
  'common.copyFailed': '复制失败，请手动选择文本复制。',
  'common.fullscreen_blocked': '当前浏览器不支持全屏，或被安全策略阻止。',
  'common.depthExceed': '当前 JSON 层级为 {maxDepth} 层，已超过最多支持的 {maxJsonDepth} 层，暂不支持对比。\n\n左侧层级：{leftDepth}\n右侧层级：{rightDepth}',
  'common.empty': '空',
  'common.parseError': '✗ JSON 解析错误',
  'common.readError': '✗ 文件读取失败',
  'common.oversize': '✗ 文件过大(>10MB)',
  'common.reading': '读取中…',
  'common.cantProceed': '无法进入下一步：',
  'common.left': '左侧',
  'common.right': '右侧',
  'common.isEmpty': '为空',
  'common.cache.clearConfirm': '确定要清理本地全部缓存吗？\n\n将清除：\n· localStorage（已保存的对比规则、主键、回填字段等）\n· sessionStorage\n· 当前页面可访问的 Cookie\n\n清理后页面将自动刷新。',
  'common.cache.done': '本地缓存已清理完成，页面将刷新。',
  'common.sample.label': '示例数据（内置）',
  'common.noExport': '当前没有可导出的差异统计，请先在第四步执行对比。',
  'common.exportFail': '表格导出组件尚未加载完成，请稍后重试。',
  'common.pleaseSelectFields': '请先勾选要回填的字段。',

  // ---------- 初始化错误 ----------
  'init.error': '初始化失败，请刷新页面重试。',

  // ---------- 页脚 ----------
  'footer.text': '由 <a href="https://with.woa.com/" style="color: #8A2BE2;" target="_blank">With</a> 通过自然语言生成',

  // ---------- 统计明细导出的表格标题 ----------
  'export.title': 'JSON 差异详细统计报告',
  'export.timestamp': '生成时间',
  'export.leftSource': '左侧来源(A)',
  'export.rightSource': '右侧来源(B)',
  'export.manualInput': '（手动输入）',
  'export.scope': '统计口径',
  'export.scopeVal': '完整前缀路径（未去掉前缀）',
  'export.category': '差异类别',
  'export.count': '数量',
  'export.total': '合计',
  'export.aggregated': '按完整路径聚合',
  'export.fullPath': '完整路径',
  'export.occurrences': '出现次数',
  'export.rowNum': '序号',
  'export.aValue': 'A值',
  'export.bValue': 'B值',
  'export.sheetSummary': '统计信息',
  'export.sheetRemoved': '仅A有',
  'export.sheetAdded': '仅B有',
  'export.sheetChanged': '值不同',

  // ---------- 解析状态 ----------
  'parse.valid.object': '对象({n} keys)',
  'parse.valid.array': '数组({n})',

  // ---------- render.js 差异树渲染 ----------
  'render.status.same': '相同',
  'render.status.added': '仅B有',
  'render.status.removed': '仅A有',
  'render.status.changed': '值不同',
  'render.rootNode': '根节点',
  'render.missingLeft': '左侧缺失',
  'render.missingRight': '右侧缺失',
  'render.keyMismatch': 'key不一致 ⚠',
  'render.primaryKey': '主键',
  'render.compositeKey': '复合主键',
  'render.objectCheckBy': '对象按{keyTitle}「{keyLabel}」校验',
  'render.compareBy': '按{keyTitle}「{keyLabel}」对比',
  'render.primaryKeyChanged': '主键值不同',
  'render.arrayLengthChanged': '值不同(个数)',
  'render.changedCount': '{n} 处差异',
  'render.typeMismatch': '类型不同({leftType} vs {rightType})',
  'render.keyCount': 'key数量 A:{left} / B:{right}',
  'render.length': '长度 A:{left} / B:{right}',
  'render.dedupLength': '去重长度 A:{left} / B:{right}',

  // ---------- arraykey.js 主键选择 ----------
  'arraykey.noArrays': '两侧 JSON 中未检测到对象数组，<br/>简单数组和普通对象无需设置对比主键。',
  'arraykey.noSample': '无可预览样本',
  'arraykey.objArray': '对象数组',
  'arraykey.required': '必选',
  'arraykey.fieldsCount': '{n} 字段',
  'arraykey.choosePrompt': '点击下方字段作为{typeText}对比主键（可多选组成<b class="text-indigo-500 mx-0.5">复合主键</b>，按点击顺序联合匹配）',
  'arraykey.notSelected': '请为该对象数组选择至少一个主键字段（必选，不可使用下标对比）',
  'arraykey.selected': '已选{compound}主键：',
  'arraykey.selectedKeys': '已选主键',
  'arraykey.compound': '复合',
  'arraykey.keyTag': '主键 {order}',

  // ---------- diff.js ----------
  'diff.noArrayKey': '对象数组「{path}」未设置对比主键，无法对比。请回到第 3 步为该数组选择主键。',
  'diff.rootArray': '根数组',

  // ---------- fieldfill.js ----------
  'fieldfill.noDiffFields': '当前没有值不同且可回填的字段',
  'fieldfill.allSelected': '全部字段均已加入右侧',
  'fieldfill.noMatch': '没有匹配「{kw}」的字段路径',
  'fieldfill.arrTag': '数组项·主键匹配',
  'fieldfill.arrTagTitle': '位于对象数组「{arrayPath}」内，按主键匹配回填',
  'fieldfill.matchN': '匹配 {n}',
  'fieldfill.matchNTitle': '点击查看该字段全部匹配值的统计列表',
  'fieldfill.noMatchTag': '无匹配',
  'fieldfill.noMatchTagTitle': '右侧无主键匹配的对象，该字段回填不会生效',
  'fieldfill.removeTitle': '点击移出已选',
  'fieldfill.noFill': '未发生任何回填：可能右侧无主键匹配的对象，或所选字段在左侧不存在。',
  'fieldfill.fillTotal': '共 {n} 处回填',
  'fieldfill.fillAdded': '新增 {n}',
  'fieldfill.fillReplaced': '覆盖 {n}',
  'fieldfill.actionAdded': '新增',
  'fieldfill.actionReplaced': '覆盖',
  'fieldfill.selPlaceholder': '从左侧选择字段加入此处',
  'fieldfill.genFailed': '生成值不同字段列表失败：{msg}',
  'fieldfill.statNoData': '该字段无匹配回填，暂无可统计的值',
  'fieldfill.unit': '个',
  'fieldfill.arrayLength': '数组长度 {len}',
};

const en = {
  'app.title': 'JSON Visual Diff',

  'step.1.title': 'Rules',
  'step.1.subtitle': 'Diff logic overview',
  'step.2.title': 'Input',
  'step.2.subtitle': 'Enter left / right JSON',
  'step.3.title': 'Keys',
  'step.3.subtitle': 'Object/array primary keys',
  'step.4.title': 'Results',
  'step.4.subtitle': 'Diff visualization',
  'step.5.title': 'Fill',
  'step.5.subtitle': 'Overwrite new JSON with old values',

  'tool.title': 'Tools',
  'tool.clearCache': 'Clear Cache',
  'tool.clearCacheDesc': 'Remove all locally stored data (Cookies, localStorage, sessionStorage, etc.).',

  'rule.obj.title': '1. Object Comparison',
  'rule.obj.1': 'First compare the <b>number of keys</b>; a mismatch is highlighted.',
  'rule.obj.2': 'If key counts match, check whether <b>all keys are identical</b>; flagged as "inconsistent" if not.',
  'rule.obj.3': 'For shared keys, compare <b>value differences</b> one by one.',
  'rule.obj.4': 'Keys only in left (A) are marked <b>"Only in A"</b>; keys only in right (B) are marked <b>"Only in B"</b>.',
  'rule.arr.title': '2. Array Comparison',
  'rule.arr.1': 'First compare <b>element count (length)</b>; a length mismatch is highlighted.',
  'rule.arr.2': 'For <b>primitive type</b> elements (numbers, strings, booleans, etc.), no primary key is needed — only <b>length</b> is compared, not specific element values.',
  'rule.arr.3': 'For <b>object</b> elements, recursively apply "Object Comparison Rules" above, and select a primary key in Step 3.',
  'rule.arr.4': 'Extra/missing elements are marked "Only in B" / "Only in A" respectively.',
  'rule.opts.title': '3. Options',
  'rule.opts.ignoreCase': '<b>Ignore Case</b>: string value comparison is case-insensitive, e.g. <code class="bg-slate-100 px-1 rounded">"Alice"</code> equals <code class="bg-slate-100 px-1 rounded">"alice"</code>.',
  'rule.opts.ignoreTime': '<b>Ignore Date/Time Values</b>: if a value is date or time typed, <b>skip comparison</b> and treat as identical (regardless of format differences).',
  'rule.opts.hideSame': '<b>Hide Identical Key/Value</b>: show only differing nodes; identical items are hidden (enabled by default).',
  'rule.opts.expand': '<b>Expand Depth</b>: choose "Collapse All" or expand only the first N levels of JSON nodes; nodes beyond the selected depth are auto-collapsed.',
  'rule.display.title': '4. Display Rules',
  'rule.display.1': 'Array elements are displayed in <b>index order</b> (or by selected primary key order).',
  'rule.display.2': 'Object keys are sorted in <b>ascending alphabetical order</b> before display.',
  'rule.display.3': 'For <b>changed values</b>, displayed as: <code class="bg-slate-100 px-1 rounded">left_value &lt;------&gt; right_value</code>.',
  'rule.display.4': '<b>"Only in A"</b> key label is placed on the <b>left</b> of the key; <b>"Only in B"</b> label is placed on the <b>right</b> of the key.',
  'rule.legend.a': 'Only in A',
  'rule.legend.b': 'Only in B',
  'rule.legend.changed': 'Changed',
  'rule.legend.same': 'Same',
  'rule.btn.next': 'Next: Select Files',

  'step2.left.label': 'Left [Old] JSON (A)',
  'step2.left.btn': 'Select [Old JSON] File',
  'step2.right.label': 'Right [New] JSON (B)',
  'step2.right.btn': 'Select [New JSON] File',
  'step2.waiting': 'Waiting…',
  'step2.btn.prev': 'Previous',
  'step2.btn.next': 'Next: Select Keys',

  'step3.tip': 'When the JSON contains objects or object arrays, you can assign <b>comparison keys</b>: object keys verify identity fields at the same level; array primary keys align elements with matching keys for comparison instead of by index.<br/>Multiple fields can be combined as a <b>composite key</b>; object keys are optional, array primary keys are mandatory. Currently supports up to <b>{depth} levels</b> of JSON nesting; deeper structures are not supported.',
  'step3.prevTarget': 'Previous',
  'step3.nextTarget': 'Next',
  'step3.targetCounter': 'Target {cur} / {total}',
  'step3.empty': 'Please enter valid JSON in Step 2 first.',
  'step3.noArrays': 'No object arrays detected.<br/>Simple arrays and plain objects do not require comparison keys.',
  'step3.noSample': 'No sample data available',
  'step3.objArray': 'Object Array',
  'step3.required': 'Required',
  'step3.fieldsCount': '{n} fields',
  'step3.choosePrompt': 'Click a field below to use as {typeText} comparison key (multi-select for a <b class="text-indigo-500 mx-0.5">composite key</b>, matched in click order)',
  'step3.notSelected': 'Please select at least one primary key field for this object array (required; index-based comparison is not allowed)',
  'step3.selected': 'Selected{compound} key: ',
  'step3.compound': ' composite',
  'step3.keyTag': 'Key {order}',
  'step3.btn.prev': 'Previous',
  'step3.btn.next': 'Next: View Results',
  'step3.alert.title': 'Please select comparison keys for the following object arrays (object keys are optional; array primary keys must be selected — index-based comparison is not allowed):',

  'step4.recompare': 'Re-compare',
  'step4.comparing': 'Comparing…',
  'step4.downloadStat': 'Download Detail',
  'step4.downloadStatTitle': 'Export a 4-sheet Excel report: Summary + Only in A + Only in B + Changed (with full prefix paths)',
  'step4.stripPrefix': 'Strip Prefix (aggregate by final key only)',
  'step4.stripPrefixTitle': 'ON: strip path prefix, aggregate by final key name; OFF: keep full prefix path',
  'step4.stripOn': 'ON',
  'step4.stripOff': 'OFF',
  'step4.optionTitle': 'Options',
  'step4.ignoreCase': 'Ignore Case',
  'step4.ignoreTime': 'Ignore Date/Time Values',
  'step4.ignoreTimeTitle': 'If the value is date/time typed, skip comparison',
  'step4.hideSame': 'Hide Identical Key/Value',
  'step4.expand': 'Expand Depth',
  'step4.expand0': 'Collapse All',
  'step4.expandN': 'Expand {level} Level(s)',
  'step4.fullscreen': 'Fullscreen',
  'step4.exitFullscreen': 'Exit Fullscreen',
  'step4.fullscreenTitle': 'View diff result in fullscreen (ESC to exit)',
  'step4.loading': 'Diff will run automatically after entering this step',
  'step4.loadingDetail': 'Loading diff data…',
  'step4.loadingGen': 'Generating diff summary, please wait…',
  'step4.loadingWait': 'Parsing and rendering large files may take a few seconds. Please do not close the page.',
  'step4.cantCompare': 'Cannot compare. Please check your JSON input in Step 2.',
  'step4.failed': 'Comparison failed: ',
  'step4.identical': 'The two JSON documents are identical (no differences)',
  'step4.filteredEmpty': 'No content to display under the current filter<br/><span class="text-xs">Please toggle diff types above</span>',
  'step4.splitA': 'A / Old JSON',
  'step4.splitB': 'B / New JSON',
  'step4.btn.prev': 'Previous',
  'step4.btn.edit': 'Edit Input',
  'step4.btn.next': 'Next: Field Fill',

  'step5.tip': 'Fill selected field values from <b>Left (Old) JSON</b> into matching objects in <b>Right (New) JSON</b> by <b>primary key</b>: fields <b>not present are added</b>; <b>existing fields are overwritten</b> with old values.<br/>Only <b>changed</b> fields that are <b>not primary keys</b> of object arrays are listed below. Search, select, then click "Execute".',
  'step5.selected': '{n} selected',
  'step5.execute': 'Execute',
  'step5.availTitle': 'Available Fields',
  'step5.availCount': '{n}',
  'step5.searchPlaceholder': 'Search field path, e.g. role / address.city / team[].role',
  'step5.availEmpty': 'Please enter valid JSON in Step 2 first.',
  'step5.selTitle': 'Selected Fields',
  'step5.clearAll': 'Remove All',
  'step5.selPlaceholder': 'Select fields from the left panel',
  'step5.noDiff': 'No changed fields available for filling.',
  'step5.allSelected': 'All fields have been added to the right panel.',
  'step5.noMatch': 'No fields matching "{kw}"',
  'step5.arrTag': 'Array Item · Key Matched',
  'step5.arrTagTitle': 'Inside object array "{path}", matched by primary key',
  'step5.matchN': '{n} match(es)',
  'step5.matchNTitle': 'Click to view value distribution statistics for this field',
  'step5.noMatchTag': 'No Match',
  'step5.noMatchTagTitle': 'No object matched by primary key in the right JSON; this field fill will have no effect',
  'step5.removeTitle': 'Click to remove from selection',
  'step5.fillResult': 'Fill Result',
  'step5.copyResult': 'Copy Result JSON',
  'step5.downloadResult': 'Download JSON',
  'step5.tabLeft': 'vs Old File',
  'step5.tabRight': 'vs New File',
  'step5.tabJson': 'Result JSON',
  'step5.tabLeftDesc': 'Diff of fill result (B\') vs <b class="text-emerald-600 mx-1">Old File A</b>',
  'step5.tabRightDesc': 'Diff of fill result (B\') vs <b class="text-rose-600 mx-1">New File B</b>',
  'step5.noFill': 'No fill occurred: the right JSON may have no objects matching by primary key, or the selected fields do not exist in the left JSON.',
  'step5.fillTotal': '{n} total fill(s)',
  'step5.fillAdded': '{n} added',
  'step5.fillReplaced': '{n} replaced',
  'step5.actionAdded': 'Added',
  'step5.actionReplaced': 'Replaced',
  'step5.btn.prev': 'Previous',
  'step5.btn.edit': 'Edit Input',

  'drawer.title.removed': 'Keys Only in A',
  'drawer.title.added': 'Keys Only in B',
  'drawer.title.changed': 'Keys with Different Values',
  'drawer.total': '{n} differences, sorted <b>descending</b> by occurrence count per path group (full path displayed)',
  'drawer.prev': 'Previous',
  'drawer.next': 'Next',
  'drawer.page': 'Page {cur} / {total}',
  'drawer.empty': 'No differences in this category',
  'drawer.pathPrefix': 'Group path: ',
  'drawer.pathCount': 'This group has <b class="text-slate-600">{n}</b> difference(s)',

  'fieldStat.title': 'Field Value Distribution',
  'fieldStat.info': 'Field {path}, {total} total match(es), {unique} distinct value(s) (sorted by count descending)',
  'fieldStat.prev': 'Previous',
  'fieldStat.next': 'Next',
  'fieldStat.page': 'Page {cur} / {total}',
  'fieldStat.empty': 'No matching fill for this field; no statistics available.',
  'fieldStat.unit': '',
  'fieldStat.noMatch': 'No Match',

  'legend.removed': 'Only in A',
  'legend.added': 'Only in B',
  'legend.changed': 'Changed',
  'legend.same': 'Same',
  'legend.filterTitle.added': 'Show "{label}" in the root diff tree when checked',
  'legend.filterTitle.removed': 'Show "{label}" in the root diff tree when checked',
  'legend.filterTitle.changed': 'Show "{label}" in the root diff tree when checked',
  'legend.filterTitle.same': 'Show "{label}" in the root diff tree when checked',
  'legend.clickTitle': 'Click to view all "{label}" differences',
  'legend.none': 'None',
  'legend.sameCount': '{n} identical',

  'common.loading': 'Loading and comparing JSON data…',
  'common.missing': '(missing)',
  'common.copied': 'Copied',
  'common.copyFailed': 'Copy failed. Please select and copy the text manually.',
  'common.fullscreen_blocked': 'Your browser does not support fullscreen, or it was blocked by security policy.',
  'common.depthExceed': 'The JSON has {maxDepth} levels, which exceeds the maximum supported {maxJsonDepth} levels. Comparison is not possible.\n\nLeft depth: {leftDepth}\nRight depth: {rightDepth}',
  'common.empty': 'Empty',
  'common.parseError': '✗ JSON Parse Error',
  'common.readError': '✗ File Read Error',
  'common.oversize': '✗ File too large (>10MB)',
  'common.reading': 'Reading…',
  'common.cantProceed': 'Cannot proceed:',
  'common.left': 'Left',
  'common.right': 'Right',
  'common.isEmpty': 'is empty',
  'common.cache.clearConfirm': 'Are you sure you want to clear all local cache?\n\nThe following will be removed:\n· localStorage (saved rules, keys, fill fields, etc.)\n· sessionStorage\n· Cookies accessible from this page\n\nThe page will refresh afterward.',
  'common.cache.done': 'Local cache cleared. The page will now refresh.',
  'common.sample.label': 'Sample Data (built-in)',
  'common.noExport': 'No diff statistics available for export. Please run the comparison in Step 4 first.',
  'common.exportFail': 'The Excel export component has not finished loading. Please try again shortly.',
  'common.pleaseSelectFields': 'Please select at least one field to fill.',

  'init.error': 'Initialization failed. Please refresh the page.',

  'footer.text': 'Powered by <a href="https://with.woa.com/" style="color: #8A2BE2;" target="_blank">With</a> — Generated via Natural Language',

  'export.title': 'JSON Diff Detailed Report',
  'export.timestamp': 'Generated At',
  'export.leftSource': 'Left Source (A)',
  'export.rightSource': 'Right Source (B)',
  'export.manualInput': '(Manual Input)',
  'export.scope': 'Aggregation Scope',
  'export.scopeVal': 'Full prefix path (without stripping)',
  'export.category': 'Diff Category',
  'export.count': 'Count',
  'export.total': 'Total',
  'export.aggregated': 'Aggregated by Full Path',
  'export.fullPath': 'Full Path',
  'export.occurrences': 'Occurrences',
  'export.rowNum': '#',
  'export.aValue': 'Value A',
  'export.bValue': 'Value B',
  'export.sheetSummary': 'Summary',
  'export.sheetRemoved': 'Only in A',
  'export.sheetAdded': 'Only in B',
  'export.sheetChanged': 'Changed',

  'parse.valid.object': 'Object({n} keys)',
  'parse.valid.array': 'Array({n})',

  // ---------- render.js ----------
  'render.status.same': 'Same',
  'render.status.added': 'Only in B',
  'render.status.removed': 'Only in A',
  'render.status.changed': 'Changed',
  'render.rootNode': 'Root',
  'render.missingLeft': 'Missing in Left',
  'render.missingRight': 'Missing in Right',
  'render.keyMismatch': 'Key mismatch ⚠',
  'render.primaryKey': 'Primary Key',
  'render.compositeKey': 'Composite Key',
  'render.objectCheckBy': 'Object check by {keyTitle} "{keyLabel}"',
  'render.compareBy': 'Compare by {keyTitle} "{keyLabel}"',
  'render.primaryKeyChanged': 'Primary key changed',
  'render.arrayLengthChanged': 'Length changed',
  'render.changedCount': '{n} difference(s)',
  'render.typeMismatch': 'Type mismatch ({leftType} vs {rightType})',
  'render.keyCount': 'Key count A:{left} / B:{right}',
  'render.length': 'Length A:{left} / B:{right}',
  'render.dedupLength': 'Dedup length A:{left} / B:{right}',

  // ---------- arraykey.js ----------
  'arraykey.noArrays': 'No object arrays detected.<br/>Simple arrays and plain objects do not require comparison keys.',
  'arraykey.noSample': 'No sample available',
  'arraykey.objArray': 'Object Array',
  'arraykey.required': 'Required',
  'arraykey.fieldsCount': '{n} fields',
  'arraykey.choosePrompt': 'Click a field below to use as {typeText} comparison key (multi-select for a <b class="text-indigo-500 mx-0.5">composite key</b>, matched in click order)',
  'arraykey.notSelected': 'Please select at least one primary key field for this object array (required; index-based comparison is not allowed)',
  'arraykey.selected': 'Selected{compound} key: ',
  'arraykey.selectedKeys': 'Selected Key',
  'arraykey.compound': ' composite',
  'arraykey.keyTag': 'Key {order}',

  // ---------- diff.js ----------
  'diff.noArrayKey': 'Object array "{path}" has no comparison key set, cannot compare. Please go to Step 3 to select a key.',
  'diff.rootArray': 'Root Array',

  // ---------- fieldfill.js ----------
  'fieldfill.noDiffFields': 'No changed fields available for filling.',
  'fieldfill.allSelected': 'All fields have been added to the right panel.',
  'fieldfill.noMatch': 'No fields matching "{kw}"',
  'fieldfill.arrTag': 'Array Item · Key Matched',
  'fieldfill.arrTagTitle': 'Inside object array "{arrayPath}", matched by primary key',
  'fieldfill.matchN': '{n} match(es)',
  'fieldfill.matchNTitle': 'Click to view value distribution for this field',
  'fieldfill.noMatchTag': 'No Match',
  'fieldfill.noMatchTagTitle': 'No object matched by primary key in right JSON; fill will have no effect',
  'fieldfill.removeTitle': 'Click to remove from selection',
  'fieldfill.noFill': 'No fill occurred: the right JSON may have no objects matching by primary key, or the selected fields do not exist in the left JSON.',
  'fieldfill.fillTotal': '{n} total fill(s)',
  'fieldfill.fillAdded': '{n} added',
  'fieldfill.fillReplaced': '{n} replaced',
  'fieldfill.actionAdded': 'Added',
  'fieldfill.actionReplaced': 'Replaced',
  'fieldfill.selPlaceholder': 'Select fields from the left panel',
  'fieldfill.genFailed': 'Failed to generate changed field list: {msg}',
  'fieldfill.statNoData': 'No matching fill for this field; no statistics available.',
  'fieldfill.unit': '',
  'fieldfill.arrayLength': 'Array length {len}',
};

const messages = { zh, en };
let _lang = (() => {
  try { return localStorage.getItem('json-diff-lang') || 'zh'; } catch (_) { return 'zh'; }
})();

export function currentLang() { return _lang; }

export function setLang(lang) {
  if (lang !== 'zh' && lang !== 'en') lang = 'zh';
  _lang = lang;
  try { localStorage.setItem('json-diff-lang', lang); } catch (_) {}
  applyI18nHTML();
}

export function t(key, vars) {
  const dict = messages[_lang] || messages.zh;
  let val = dict[key];
  if (val === undefined) {
    // fallback to zh
    val = (messages.zh[key]);
    if (val === undefined) return key;
  }
  if (vars) {
    Object.keys(vars).forEach(k => {
      val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
    });
  }
  return val;
}

// 将页面中所有带 data-i18n 属性的元素的 innerHTML 设为翻译值
export function applyI18nHTML() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const varsStr = el.getAttribute('data-i18n-vars');
    let vars = undefined;
    if (varsStr) {
      try { vars = JSON.parse(varsStr); } catch (_) {}
    }
    el.innerHTML = t(key, vars);
  });
}

// 渲染语言切换按钮
export function renderLangToggle(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <button id="langToggleBtn" class="text-xs px-2.5 py-1.5 rounded-lg border border-white/30 text-white hover:bg-white/10 transition flex items-center gap-1">
      <i class="ri-translate-2"></i>
      <span id="langToggleLabel">${_lang === 'zh' ? 'EN' : '中'}</span>
    </button>`;
  const btn = document.getElementById('langToggleBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      setLang(_lang === 'zh' ? 'en' : 'zh');
      const label = document.getElementById('langToggleLabel');
      if (label) label.textContent = _lang === 'zh' ? 'EN' : '中';
      // 触发自定义事件，让 main.js 感知语言切换
      window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: _lang } }));
    });
  }
}
