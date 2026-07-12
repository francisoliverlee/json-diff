# JSON 语义化对比工具

**不同于简单的文本 diff，本工具深入理解 JSON 结构，按语义进行逐层对比。**

- 对象按 **Key 匹配**（而非逐行文本），数组按 **主键对齐**（而非按下标），深层次值类型感知
- 五步式向导引导，零后端依赖，所有数据均在浏览器本地处理

📖 [功能详细说明 →](./FEATURES.md)

## 本地运行

```bash
npx serve .
# 或
python3 -m http.server 8000
```

启动后在浏览器访问对应地址，打开 `index.html` 即可使用。

> 说明：因使用了 ESModule（`<script type="module">`），请通过 HTTP 服务访问，而非直接以 `file://` 方式打开。

---

由 [tiger](https://github.com/AI-888/json-diff) 通过自然语言生成

