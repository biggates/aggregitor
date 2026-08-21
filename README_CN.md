# aggregitor

[![npm version](https://img.shields.io/npm/v/aggregitor.svg)](https://www.npmjs.com/package/aggregitor)

从多个 git 仓库中生成聚合的 commit 日志。

[English](./README.md)

## 这是什么

### 环境要求

- 本地已安装 `git` 且在 PATH 中
- 已为 git 配置好所需的权限

### 主要使用目的

- 类似日报 / 周报等场景，需要从多个 git 仓库汇总某一时间段内的主要工作内容
- 尤其适用于**智能体（AI Agent）的定时任务**：配置一次即可周期性自动产出汇总报告，无需逐个查看 `git log`；只把精简的汇总结果交给 LLM，而不是全部原始日志，**可以显著节约 token**

### 限制

- 报告**基于 git commit message 汇总**，本身不做内容语义理解
- 因此如果 commit message 写得不够详细，报告质量会大打折扣 —— 建议使用规范的提交信息（如 [Conventional Commits](https://www.conventionalcommits.org/)，配合 `git.filter-unconventional` 过滤不规范的提交）

## 用法

```
# 创建 .aggregitor.yml 配置文件
npx aggregitor init

# 收集并输出聚合的 git 日志
npx aggregitor

# 按日期范围过滤（支持 git 兼容的日期格式）
npx aggregitor --since "2024-01-01" --until "2024-12-31"
npx aggregitor --since "1 week ago"

# 显示详细日志
npx aggregitor --verbose

# 查看版本
npx aggregitor --version
```

### CLI 参数

| 参数 | 说明 |
|------|------|
| `--since <date>` | 仅收集指定日期之后的 commit（包含边界）。格式示例：`"2024-01-01"`、`"1 week ago"`、`"2024-06-01 00:00:00"` |
| `--until <date>` | 仅收集指定日期之前的 commit（包含边界）。格式同上 |
| `--verbose` | 输出详细处理日志（写入 stderr） |

## 配置

所有配置在 `.aggregitor.yml` 中（单文件，包含 Markdown 模板）。
完整参考见 [示例](./docs/.aggregitor.yml.example)。

### 输出格式

- **json** — 固定 schema 输出（见 [示例](./docs/example-output.json)）
- **md** — 模板驱动的 Markdown（内置默认模板，也可通过 `output.template` 自定义）

### 模板语法

| 语法 | 说明 |
|------|------|
| `{{ variable }}` | 插值 |
| `{{ variable.nested }}` | 嵌套属性访问 |
| `{{#each list}}...{{/each}}` | 遍历数组 |
| `{{#if value}}...{{/if}}` | 条件判断（真值） |
| `{{#unless value}}...{{/unless}}` | 条件判断（假值） |
| `{{! comment }}` | 注释 |
