# 第 2 章：AST 抽象语法树详解

---

## 2.1 什么是 AST？

**AST（Abstract Syntax Tree，抽象语法树）** 是源代码的树形结构化表示。它被称为"抽象"是因为它省略了语法细节（如分号、括号、空格），只保留程序结构的本质信息。

### 2.1.1 从源代码到 AST

```
源代码文本 → 词法分析 → Token 流 → 语法分析 → AST → (可选) 代码生成
```

### 2.1.2 为什么"抽象"？

以 `3 + 4 * 5` 为例：

```
具体语法树 (CST / Parse Tree) — 包含所有语法细节：
         Expression
         /    |    \
     Number  '+'  Expression
       |          /    |    \
       3     Number  '*'  Number
               |            |
               4            5

抽象语法树 (AST) — 去除冗余语法信息：
           (+)
          /   \
         3    (*)
              / \
             4   5
```

CST 包含了所有语法标记（包括可能对分析无用的括号、分隔符等），而 AST 只保留语义上重要的结构。

---

## 2.2 编译前端流水线

### 2.2.1 完整流水线

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  源代码      │ →  │  词法分析    │ →  │  语法分析    │ →  │  语义分析    │
│  (Source)   │    │  (Lexing)   │    │  (Parsing)  │    │  (Semantic) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                         │                   │                   │
                         ▼                   ▼                   ▼
                    Token 流              AST               带类型 AST
                                                                │
                                                    ┌───────────▼───────────┐
                                                    │       中间代码生成      │
                                                    │     (IR Generation)    │
                                                    └───────────────────────┘
```

### 2.2.2 词法分析（Lexical Analysis / Tokenization）

**输入**：源代码字符串
**输出**：Token（词法单元）流

```javascript
// 输入源代码
const x = 42 + y;

// 词法分析输出 — Token 流
[
  { type: 'Keyword',   value: 'const',  pos: 0  },
  { type: 'Identifier', value: 'x',     pos: 6  },
  { type: 'Punctuator', value: '=',     pos: 8  },
  { type: 'Numeric',   value: '42',     pos: 10 },
  { type: 'Punctuator', value: '+',     pos: 13 },
  { type: 'Identifier', value: 'y',     pos: 15 },
  { type: 'Punctuator', value: ';',     pos: 16 },
]
```

**词法分析的核心技术**：

| 技术 | 说明 | 示例 |
|------|------|------|
| **正则表达式** | 简单场景 | `/\b\d+\b/` 匹配数字 |
| **确定性有限自动机 (DFA)** | 高效匹配 | Lex/Flex 使用 |
| **手动编码** | 性能极致 | V8、JavaCC |

**难点**：
- **歧义**：`>>>` 是右移赋值还是右移 + 大于？
- **向前看 (Lookahead)**：`/` 在 JS 中是除法还是正则表达式起始？
- **语境敏感**：`}` 在模板字符串中不代表结束

```
// JavaScript 词法分析的经典歧义

// Case 1: / 是除法运算符
let x = a / b / g;

// Case 2: / 是正则表达式起始
let x = /foo/g;

// 词法分析器需要上下文才能区分！
```

### 2.2.3 语法分析（Syntax Analysis / Parsing）

**输入**：Token 流
**输出**：AST

#### 解析策略分类

```
语法分析策略
├── 自顶向下 (Top-Down)
│   ├── 递归下降 (Recursive Descent) ← 最常用
│   ├── LL(k) 解析器
│   │   ├── LL(1) — 看一个 token 决定
│   │   └── LL(*) — 任意向前看
│   └── Packrat 解析 (PEG)
│
└── 自底向上 (Bottom-Up)
    ├── LR(k) 解析器
    ├── LALR(1) — Yacc/Bison 使用
    ├── GLR — 处理歧义文法
    └── Earley 解析器 — 通用上下文无关解析
```

#### 主流解析器对比

| 解析器 | 类型 | 语言 | 特点 |
|--------|------|------|------|
| **acorn** | 递归下降 | JavaScript | 小巧快速，webpack/Babel 底层可选 |
| **@babel/parser** | 递归下降 | JavaScript | 功能全面，支持所有实验性语法 |
| **tree-sitter** | GLR | 多语言 | 容错性强，增量解析，IDE 友好 |
| **swc (Rust)** | 手写递归下降 | JS/TS | 极致性能，替代 Babel |
| **esbuild** | 手写 | JS/TS | 性能极致，Go 实现 |
| **TypeScript Compiler** | 手写递归下降 | TS/JS | 完整类型系统集成 |
| **Python ast** | LL(1) | Python | CPython 内置 |
| **syn (Rust)** | 递归下降 | Rust | 过程宏核心 |
| **go/parser** | 手写递归下降 | Go | Go 标准库 |

#### 文法与解析的数学基础

```
Chomsky 文法层级:

Type 0: 无限制文法 ─────────────────── 图灵机
Type 1: 上下文相关文法 (CSG) ──────── 线性有界非确定性图灵机
Type 2: 上下文无关文法 (CFG) ──────── 下推自动机 ← 绝大多数编程语言
Type 3: 正则文法 ──────────────────── 有限自动机 ← Token 级别
```

**大多数编程语言的语法是上下文无关文法（CFG）的子集**，实际使用 LL/LR 解析器处理。部分语言特性（如 C 的 `typedef`，Python 的缩进）需要上下文相关信息。

---

## 2.3 AST 节点类型体系

### 2.3.1 通用节点分类

```
AST 节点
├── 语句 (Statements)
│   ├── 表达式语句 (ExpressionStatement)
│   ├── 变量声明 (VariableDeclaration)
│   ├── 条件语句 (IfStatement, SwitchStatement)
│   ├── 循环语句 (ForStatement, WhileStatement)
│   ├── 控制流 (ReturnStatement, BreakStatement, ContinueStatement)
│   ├── 异常处理 (TryStatement, ThrowStatement)
│   └── 块语句 (BlockStatement)
│
├── 表达式 (Expressions)
│   ├── 字面量 (Literal: String, Number, Boolean, Null, RegExp)
│   ├── 标识符 (Identifier)
│   ├── 二元/一元表达式 (BinaryExpression, UnaryExpression)
│   ├── 赋值表达式 (AssignmentExpression)
│   ├── 函数表达式 (FunctionExpression, ArrowFunctionExpression)
│   ├── 调用表达式 (CallExpression)
│   ├── 成员表达式 (MemberExpression)
│   └── 条件表达式 (ConditionalExpression / 三元)
│
├── 声明 (Declarations)
│   ├── 函数声明 (FunctionDeclaration)
│   ├── 类声明 (ClassDeclaration)
│   ├── 变量声明 (VariableDeclaration)
│   └── 导入/导出 (ImportDeclaration, ExportDeclaration)
│
├── 模式 (Patterns)
│   ├── 对象模式 (ObjectPattern) — 解构
│   ├── 数组模式 (ArrayPattern)
│   └── 剩余/展开 (RestElement, SpreadElement)
│
└── 类型 (Types — TypeScript/Flow)
    ├── 类型注解 (TypeAnnotation)
    ├── 泛型 (TypeParameter)
    └── 联合/交叉类型 (UnionType, IntersectionType)
```

### 2.3.2 具体示例：JavaScript `for` 循环的 AST

```javascript
// 源代码
for (let i = 0; i < 10; i++) {
  console.log(i);
}
```

```json
{
  "type": "ForStatement",
  "init": {
    "type": "VariableDeclaration",
    "kind": "let",
    "declarations": [{
      "type": "VariableDeclarator",
      "id": { "type": "Identifier", "name": "i" },
      "init": { "type": "NumericLiteral", "value": 0 }
    }]
  },
  "test": {
    "type": "BinaryExpression",
    "operator": "<",
    "left": { "type": "Identifier", "name": "i" },
    "right": { "type": "NumericLiteral", "value": 10 }
  },
  "update": {
    "type": "UpdateExpression",
    "operator": "++",
    "argument": { "type": "Identifier", "name": "i" },
    "prefix": false
  },
  "body": {
    "type": "BlockStatement",
    "body": [{
      "type": "ExpressionStatement",
      "expression": {
        "type": "CallExpression",
        "callee": {
          "type": "MemberExpression",
          "object": { "type": "Identifier", "name": "console" },
          "property": { "type": "Identifier", "name": "log" }
        },
        "arguments": [{ "type": "Identifier", "name": "i" }]
      }
    }]
  }
}
```

### 2.3.3 AST 节点包含的元数据

现代 AST 节点通常包含位置信息和可选元数据：

```typescript
interface BaseNode {
  type: string;        // 节点类型
  start: number;       // 源码起始偏移
  end: number;         // 源码结束偏移
  loc: SourceLocation; // 源码位置(行/列)
  range?: [number, number];
  leadingComments?: Comment[];
  trailingComments?: Comment[];
  parent?: Node;       // 父节点引用（某些实现）
  [key: string]: any;  // 额外属性（如 TypeScript 的类型信息）
}

interface SourceLocation {
  start: { line: number; column: number };
  end:   { line: number; column: number };
}
```

---

## 2.4 AST 遍历模式

### 2.4.1 Visitor 模式（访问者模式）

这是 AST 操作中最核心的设计模式。

```typescript
// Visitor 接口定义
interface Visitor {
  // 进入节点时调用
  enter?: (node: Node, parent: Node | null) => void;
  // 离开节点时调用（子节点已处理完）
  leave?: (node: Node, parent: Node | null) => void;

  // 也可以按节点类型定义专用处理器
  Identifier?: (node: IdentifierNode) => void;
  CallExpression?: (node: CallExpressionNode) => void;
  FunctionDeclaration?: {
    enter?: (node: FunctionDeclarationNode) => void;
    leave?: (node: FunctionDeclarationNode) => void;
  };
}
```

#### 遍历算法（深度优先）

```
遍历顺序示例:

        Program
        /      \
   Variable    Function
   Declaration Declaration
       |         /    \
      let     Param   Body
               |       |
               x     return x

遍历顺序（Enter）:
Program → VariableDeclaration → let → FunctionDeclaration → Param → x → Body → return → x

遍历顺序（Leave，逆序）:
x ← return ← Body ← x ← Param ← FunctionDeclaration ← let ← VariableDeclaration ← Program
```

### 2.4.2 遍历实现

```javascript
// 简化的深度优先 AST 遍历器
function traverse(node, visitor, parent = null) {
  // 1. Enter — 进入节点
  if (visitor.enter) {
    visitor.enter(node, parent);
  }

  // 2. 调用类型特定的 enter 处理器
  const typeHandler = visitor[node.type];
  if (typeHandler?.enter) {
    typeHandler.enter(node, parent);
  } else if (typeof typeHandler === 'function') {
    typeHandler(node, parent);
  }

  // 3. 递归遍历子节点
  for (const key of getChildKeys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item.type === 'string') {
          traverse(item, visitor, node);
        }
      }
    } else if (child && typeof child.type === 'string') {
      traverse(child, visitor, node);
    }
  }

  // 4. Leave — 离开节点（子节点已全部处理完）
  if (typeHandler?.leave) {
    typeHandler.leave(node, parent);
  }
  if (visitor.leave) {
    visitor.leave(node, parent);
  }
}

// 获取节点的子属性键
function getChildKeys(node) {
  // 不同的 AST 规范有不同的子节点属性名
  const commonKeys = [
    'body', 'declarations', 'expression', 'callee',
    'arguments', 'left', 'right', 'init', 'test',
    'update', 'consequent', 'alternate', 'params',
    'properties', 'elements', 'id', 'value', 'object',
    'property', 'declaration', 'expressions',
  ];
  return commonKeys.filter(k => k in node);
}
```

### 2.4.3 路径（Path）概念

Babel 等成熟工具使用 `Path` 对象包装节点，提供丰富的上下文和操作 API：

```typescript
interface NodePath<T extends Node = Node> {
  // 当前节点
  node: T;
  // 父节点路径
  parentPath: NodePath | null;
  // 父节点
  parent: Node;
  // 作用域信息
  scope: Scope;

  // 替换当前节点
  replaceWith(newNode: Node): void;
  // 用多个节点替换
  replaceWithMultiple(nodes: Node[]): void;
  // 移除当前节点
  remove(): void;
  // 在之前/之后插入
  insertBefore(node: Node): void;
  insertAfter(node: Node): void;

  // 遍历子节点
  traverse(visitor: Visitor): void;
  // 跳过当前子树的遍历
  skip(): void;
  // 停止整个遍历
  stop(): void;

  // 查找祖先
  findParent(predicate: (path: NodePath) => boolean): NodePath | null;
  // 获取同级路径
  getSibling(key: number): NodePath;
}
```

---

## 2.5 跨语言 AST 对比

### 2.5.1 不同语言的 AST 规范

| 语言/工具 | AST 规范 | 节点类型数 | 特点 |
|----------|---------|-----------|------|
| **ESTree** (JS 社区标准) | ES 规范驱动 | ~100+ | ESLint、Prettier、Acorn 使用 |
| **Babel AST** | ESTree 超集 | ~150+ | 实验性语法、JSX、TypeScript |
| **TypeScript AST** | 自有规范 | ~200+ | 强类型、包含完整类型信息 |
| **Python AST** | CPython 定义 | ~40+ | 简洁，标准库 `ast` 模块 |
| **Go AST** | Go 标准库 | ~80+ | `go/ast`、强类型 |
| **Rust AST (syn)** | proc_macro 生态 | ~100+ | 过程宏核心，零拷贝 |
| **tree-sitter AST** | S-表达式 | 语法相关 | 增量解析、容错、多语言统一 |

### 2.5.2 同一段代码，不同 AST 表示

**Python 代码**：
```python
def add(a, b):
    return a + b
```

**Python `ast` 模块输出**：
```
Module(
  body=[
    FunctionDef(
      name='add',
      args=arguments(
        args=[arg(arg='a'), arg(arg='b')],
        defaults=[]
      ),
      body=[
        Return(
          value=BinOp(
            left=Name(id='a'),
            op=Add(),
            right=Name(id='b')
          )
        )
      ],
      decorator_list=[]
    )
  ]
)
```

**JavaScript 等效代码 (ESTree)**：
```json
{
  "type": "Program",
  "body": [{
    "type": "FunctionDeclaration",
    "id": { "type": "Identifier", "name": "add" },
    "params": [
      { "type": "Identifier", "name": "a" },
      { "type": "Identifier", "name": "b" }
    ],
    "body": {
      "type": "BlockStatement",
      "body": [{
        "type": "ReturnStatement",
        "argument": {
          "type": "BinaryExpression",
          "operator": "+",
          "left": { "type": "Identifier", "name": "a" },
          "right": { "type": "Identifier", "name": "b" }
        }
      }]
    }
  }]
}
```

### 2.5.3 关键差异

| 特性 | JavaScript(ESTree) | Python(ast) | Go(go/ast) |
|------|-------------------|-------------|------------|
| **顶层节点** | `Program` | `Module` | `File` |
| **表达式 vs 语句** | 严格区分 | 统一 `expr` | 接口 `Expr`/`Stmt` |
| **字面量** | `Literal` (含 value) | 细分 (`Num`, `Str`, `Bytes`) | `BasicLit` (含 Kind) |
| **位置信息** | `loc`, `range` | `lineno`, `col_offset` | `Pos()` / `End()` |
| **类型注释** | 扩展属性 | `annotation` 属性 | 无（通过注释） |

---

## 2.6 AST 的核心应用

### 2.6.1 代码转换（Transpilation）

```
ES6+ 源码 → @babel/parser → Babel AST → @babel/traverse + 插件 → 修改后 AST
                                                              ↓
ES5 目标代码 ← @babel/generator ←─────────────────────────┘
```

```javascript
// 输入 (ES6 箭头函数)
const double = (x) => x * 2;

// Babel 转换: ArrowFunctionExpression → FunctionExpression
// 1. 遍历 AST，找到 ArrowFunctionExpression 节点
// 2. 替换为 FunctionExpression 节点
// 3. 生成代码:
const double = function(x) {
  return x * 2;
};
```

### 2.6.2 代码格式化（Prettier 原理）

```
源代码 → 解析 AST → 丢弃原始空白 → 按规则重新生成 → 格式化代码
```

Prettier 的关键设计：
- 将 AST 重新渲染为格式化输出，**完全不保留原始格式**
- 使用 `print` 算法处理长行拆分（基于 IR 的中间表示）
- 通过 `doc` 构建器实现声明式布局

### 2.6.3 代码 Linting

```javascript
// ESLint 规则："禁止在条件中赋值"
// no-cond-assign

// 遍历 AST，在每个 IfStatement 中检查：
traverse(ast, {
  IfStatement(path) {
    const test = path.node.test;
    if (test.type === 'AssignmentExpression') {
      context.report({
        node: test,
        message: '在条件语句中使用了赋值表达式，你是想用 == 吗？'
      });
    }
  }
});
```

### 2.6.4 代码度量（Code Metrics）

```javascript
// 计算圈复杂度 (Cyclomatic Complexity)
function calculateCyclomaticComplexity(ast) {
  let complexity = 1; // 基础复杂度

  traverse(ast, {
    // 每个分支 +1
    IfStatement() { complexity++; },
    ForStatement() { complexity++; },
    WhileStatement() { complexity++; },
    CaseClause() { complexity++; },
    CatchClause() { complexity++; },
    // 逻辑运算符 &&, || 也 +1
    LogicalExpression(path) {
      if (path.node.operator === '&&' || path.node.operator === '||') {
        complexity++;
      }
    },
    ConditionalExpression() { complexity++; },
  });

  return complexity;
}
```

### 2.6.5 依赖分析

```javascript
// 提取文件的所有 import 依赖
function extractDependencies(ast) {
  const deps = [];

  traverse(ast, {
    ImportDeclaration(path) {
      deps.push({
        source: path.node.source.value,
        specifiers: path.node.specifiers.map(s => s.local.name),
        isDefault: path.node.specifiers.some(s => s.type === 'ImportDefaultSpecifier'),
      });
    },
    CallExpression(path) {
      if (path.node.callee.name === 'require' && path.node.arguments.length > 0) {
        deps.push({
          source: path.node.arguments[0].value,
          isRequire: true,
        });
      }
    }
  });

  return deps;
}
```

### 2.6.6 安全漏洞检测

```javascript
// 检测 eval() 使用
traverse(ast, {
  CallExpression(path) {
    if (
      path.node.callee.type === 'Identifier' &&
      path.node.callee.name === 'eval'
    ) {
      report('发现 eval() 调用，存在代码注入风险', path.node);
    }
  }
});

// 检测 innerHTML 赋值（XSS 风险）
traverse(ast, {
  AssignmentExpression(path) {
    if (
      path.node.left.type === 'MemberExpression' &&
      path.node.left.property.name === 'innerHTML'
    ) {
      report('使用 innerHTML 存在 XSS 风险，建议使用 textContent', path.node);
    }
  }
});
```

---

## 2.7 高级主题

### 2.7.1 容错解析（Error Recovery）

生产级解析器必须能处理不完整的代码（IDE 场景）。tree-sitter 是这方面的标杆：

```
不完整代码:
function foo(          ← 缺少参数和右括号

tree-sitter 输出:
(program
  (function_declaration       ← 依然能识别为函数
    name: (identifier)
    parameters: (formal_parameters "(" (ERROR)  ← 标记错误节点
    body: (MISSING "{" (MISSING "}")))  ← 标记缺失部分
```

### 2.7.2 增量解析

tree-sitter 的核心创新——只重新解析修改的部分：

```
原文:  const x = 1 + 2;
AST:   [const] [x] [=] [1] [+] [2]

修改:  const x = 1 + 2 + 3;  ← 只在末尾添加

增量:  只重新解析 "+ 3" 部分，复用前面的 AST
```

### 2.7.3 AST 序列化与存储

| 格式 | 工具 | 用途 |
|------|------|------|
| **JSON** | AST Explorer, ESLint | 调试、可视化 |
| **S-表达式** | tree-sitter, Clang | 机器友好、紧凑 |
| **Protobuf** | Kythe, Grok | 高性能、模式进化 |
| **二进制** | Babel cache, TS incremental | 性能优化、按需加载 |

---

## 本章小结

- AST 是代码的结构化抽象，省略语法噪音，保留语义本质
- 编译前端 = **词法分析**（代码→Token）→ **语法分析**（Token→AST）
- Visitor 模式是 AST 遍历的通用设计模式
- 不同语言有各自 AST 规范，但核心概念相通
- AST 应用涵盖：编译转译、代码格式化、Linting、安全检测、复杂度分析

> **下一章**：[03-静态分析技术深度剖析](./03-静态分析技术深度剖析.md) — 深入数据流分析、符号执行等高级技术。
