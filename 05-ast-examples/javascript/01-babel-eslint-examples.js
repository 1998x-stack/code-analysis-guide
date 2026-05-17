/**
 * AST 实战示例 1: JavaScript — Babel 插件开发
 *
 * 功能：实现一个 Babel 插件，自动为所有 console.log 添加文件名和行号前缀
 *
 * 输入:
 *   console.log("hello")
 *
 * 输出:
 *   console.log("[app.js:42]", "hello")
 */

// ============================================================
// Babel 插件: babel-plugin-console-prefix
// ============================================================

module.exports = function ({ types: t }) {
  return {
    name: 'console-prefix',
    visitor: {
      CallExpression(path, state) {
        const { node } = path;
        const { callee } = node;

        // 检查是否是 console.log / console.warn / console.error
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: 'console' }) &&
          t.isIdentifier(callee.property) &&
          ['log', 'warn', 'error', 'info', 'debug'].includes(
            callee.property.name
          )
        ) {
          // 获取源文件名和行号
          const filename = state.file.opts.filename || 'unknown';
          const line = node.loc?.start.line || '?';

          // 创建前缀字符串
          const prefix = t.stringLiteral(`[${filename}:${line}]`);

          // 将前缀插入到参数列表最前面
          node.arguments.unshift(prefix);
        }
      }
    }
  };
};

// ============================================================
// 使用方式:
//
// .babelrc:
// {
//   "plugins": ["./babel-plugin-console-prefix.js"]
// }
// ============================================================


// ============================================================
// ESLint 自定义规则: 检测未处理的 Promise
// ============================================================

/**
 * ESLint 规则: no-floating-promise-custom
 *
 * 检测没有 .catch() 或 try/catch 包裹的 Promise 返回
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止未处理的 Promise',
    },
    schema: [],
  },
  create(context) {
    return {
      // 检测函数表达式和箭头函数
      'FunctionExpression, ArrowFunctionExpression'(node) {
        // 如果函数标记为 async，可以安全忽略
        if (node.async) return;

        const body = node.body;

        // 获取返回语句
        const returnStatements = [];
        function collectReturns(n) {
          if (!n) return;
          if (n.type === 'ReturnStatement' && n.argument) {
            returnStatements.push(n);
          }
          for (const key of Object.keys(n)) {
            if (n[key] && typeof n[key] === 'object') {
              collectReturns(n[key]);
            }
          }
        }
        collectReturns(body);

        for (const ret of returnStatements) {
          const arg = ret.argument;

          // 检查: 返回了一个函数调用
          if (arg.type === 'CallExpression' || arg.type === 'AwaitExpression') {
            const isAsyncContext = isInAsyncFunction(ret);
            if (!isAsyncContext) {
              const callee = arg.callee || arg.argument?.callee;
              context.report({
                node: ret,
                message: `返回了一个可能未处理的 Promise。`
                  + `请添加 .catch()、使用 try/catch，`
                  + `或将外层函数标记为 async。`,
              });
            }
          }
        }
      }
    };
  }
};

function isInAsyncFunction(node) {
  // 检查是否在 async 函数内部
  let current = node;
  while (current) {
    if (
      (current.type === 'FunctionDeclaration' ||
        current.type === 'FunctionExpression' ||
        current.type === 'ArrowFunctionExpression') &&
      current.async
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}


// ============================================================
// AST-based 代码复杂度计算器
// ============================================================

/**
 * 计算圈复杂度 (Cyclomatic Complexity)
 * 公式: M = E - N + 2P
 * 简化: 从 1 开始，每遇到一个分支语句 +1
 */
function calculateCyclomaticComplexity(ast) {
  let complexity = 1;

  const complexityNodes = new Set([
    'IfStatement',
    'ForStatement',
    'ForInStatement',
    'ForOfStatement',
    'WhileStatement',
    'DoWhileStatement',
    'CaseClause',        // switch 的每个 case
    'CatchClause',       // try-catch
    'ConditionalExpression', // 三元运算符 ? :
  ]);

  function walk(node) {
    if (!node || typeof node !== 'object') return;

    if (complexityNodes.has(node.type)) {
      complexity++;
    }

    // 逻辑运算符 && 和 || 也增加复杂度
    if (
      node.type === 'LogicalExpression' &&
      (node.operator === '&&' || node.operator === '||')
    ) {
      complexity++;
    }

    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(walk);
      } else if (child && typeof child.type === 'string') {
        walk(child);
      }
    }
  }

  walk(ast);
  return complexity;
}

/**
 * 复杂度评级
 */
function rateComplexity(score) {
  if (score <= 5)  return { level: 'A', desc: '简单，易于测试' };
  if (score <= 10) return { level: 'B', desc: '中等，可维护' };
  if (score <= 20) return { level: 'C', desc: '复杂，建议重构' };
  if (score <= 30) return { level: 'D', desc: '非常复杂，高风险' };
  return { level: 'F', desc: '不可维护，必须重构' };
}


// ============================================================
// AST-based 依赖图构建器
// ============================================================

/**
 * 从 AST 构建文件依赖关系
 */
class DependencyGraph {
  constructor() {
    this.nodes = new Map(); // filePath → { imports, exports }
    this.edges = new Map(); // filePath → Set<filePath>
  }

  /**
   * 提取文件的 import 依赖
   */
  extractImports(ast, filePath) {
    const imports = [];

    function walk(node) {
      if (!node) return;

      // ES6 import
      if (node.type === 'ImportDeclaration') {
        imports.push({
          source: node.source.value,
          specifiers: node.specifiers.map(s =>
            s.type === 'ImportDefaultSpecifier'
              ? { type: 'default', name: s.local.name }
              : s.type === 'ImportNamespaceSpecifier'
                ? { type: 'namespace', name: s.local.name }
                : { type: 'named', name: s.imported?.name || s.local.name }
          ),
        });
      }

      // CommonJS require
      if (
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'require' &&
        node.arguments.length > 0 &&
        node.arguments[0].type === 'StringLiteral'
      ) {
        imports.push({
          source: node.arguments[0].value,
          type: 'require',
        });
      }

      // 动态 import()
      if (
        node.type === 'ImportExpression' &&
        node.source?.type === 'StringLiteral'
      ) {
        imports.push({
          source: node.source.value,
          type: 'dynamic',
        });
      }

      // 递归子节点
      for (const key of Object.keys(node)) {
        if (Array.isArray(node[key])) {
          node[key].forEach(walk);
        } else if (node[key] && typeof node[key] === 'object') {
          walk(node[key]);
        }
      }
    }

    walk(ast);

    this.nodes.set(filePath, {
      ...this.nodes.get(filePath),
      imports,
    });

    return imports;
  }

  /**
   * 检测循环依赖
   */
  detectCycles() {
    const cycles = [];
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map();

    for (const node of this.nodes.keys()) {
      color.set(node, WHITE);
    }

    function dfs(node, stack, graph) {
      color.set(node, GRAY);
      stack.push(node);

      const edges = graph.edges.get(node) || new Set();
      for (const neighbor of edges) {
        if (color.get(neighbor) === GRAY) {
          // 找到环
          const cycleStart = stack.indexOf(neighbor);
          cycles.push(stack.slice(cycleStart).concat(neighbor));
        } else if (color.get(neighbor) === WHITE) {
          dfs(neighbor, stack, graph);
        }
      }

      stack.pop();
      color.set(node, BLACK);
    }

    for (const node of this.nodes.keys()) {
      if (color.get(node) === WHITE) {
        dfs(node, [], this);
      }
    }

    return cycles;
  }

  /**
   * 生成依赖报告
   */
  generateReport() {
    const report = {
      totalFiles: this.nodes.size,
      totalDependencies: 0,
      cycles: this.detectCycles(),
      mostDependedUpon: [],
    };

    const dependencyCount = new Map();
    for (const [file, data] of this.nodes) {
      const deps = data.imports?.length || 0;
      report.totalDependencies += deps;

      for (const imp of data.imports || []) {
        dependencyCount.set(
          imp.source,
          (dependencyCount.get(imp.source) || 0) + 1
        );
      }
    }

    report.mostDependedUpon = [...dependencyCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return report;
  }
}

module.exports = {
  consolePrefixPlugin: require('./babel-plugin-console-prefix'),
  noFloatingPromiseRule: require('./eslint-no-floating-promise'),
  calculateCyclomaticComplexity,
  rateComplexity,
  DependencyGraph,
};
