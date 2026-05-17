/**
 * AST 实战示例 3: TypeScript Compiler API
 *
 * 功能：构建 TypeScript 自定义分析工具
 */

import * as ts from 'typescript';

// ============================================================
// 示例 1: TypeScript 类型感知的代码检查器
// ============================================================

class TypeScriptChecker {
  private issues: Array<{
    file: string;
    line: number;
    character: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }> = [];

  /**
   * 检查: 使用了 any 类型
   */
  checkAnyTypes(sourceFile: ts.SourceFile, checker: ts.TypeChecker) {
    const visit = (node: ts.Node) => {
      // 变量声明中隐式 any
      if (ts.isVariableDeclaration(node) && !node.type) {
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
          const type = checker.getTypeOfSymbolAtLocation(symbol, node.name);
          if (this.isAnyType(type, checker)) {
            this.report(sourceFile, node.name,
              '变量类型被推断为 any，请添加显式类型注解',
              'warning');
          }
        }
      }

      // 函数参数中的隐式 any
      if (ts.isParameter(node) && !node.type) {
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
          const type = checker.getTypeOfSymbolAtLocation(symbol, node.name);
          if (this.isAnyType(type, checker)) {
            this.report(sourceFile, node.name,
              `参数 "${node.name.getText()}" 类型为 any`,
              'warning');
          }
        }
      }

      // 函数返回类型中的 any
      if (ts.isFunctionDeclaration(node) && !node.type) {
        const signature = checker.getSignatureFromDeclaration(node);
        if (signature) {
          const returnType = checker.getReturnTypeOfSignature(signature);
          if (this.isAnyType(returnType, checker)) {
            this.report(sourceFile, node.name || node,
              `函数 "${node.name?.getText()}" 返回类型为 any`,
              'warning');
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /**
   * 检查: 使用了非空断言 (!)
   */
  checkNonNullAssertions(sourceFile: ts.SourceFile) {
    const visit = (node: ts.Node) => {
      if (ts.isNonNullExpression(node)) {
        this.report(sourceFile, node,
          '使用了非空断言 (!)，建议使用类型守卫或可选链替代',
          'warning');
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  /**
   * 检查: 使用了类型断言 (as)
   */
  checkTypeAssertions(sourceFile: ts.SourceFile) {
    const visit = (node: ts.Node) => {
      if (ts.isAsExpression(node)) {
        // 检查是否是危险的类型断言
        const targetType = node.type;
        const exprType = node.expression;

        this.report(sourceFile, node,
          `使用了 'as' 类型断言。请考虑使用类型守卫或 satisfies 替代`,
          'info');
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  /**
   * 检查: 缺少返回值类型的函数
   */
  checkMissingReturnTypes(sourceFile: ts.SourceFile) {
    const visit = (node: ts.Node) => {
      if (
        (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
        !node.type
      ) {
        const name = node.name?.getText() || '<anonymous>';
        this.report(sourceFile, node.name || node,
          `函数 "${name}" 缺少显式返回类型注解`,
          'warning');
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  private isAnyType(type: ts.Type, checker: ts.TypeChecker): boolean {
    return !!(type.flags & ts.TypeFlags.Any);
  }

  private report(
    file: ts.SourceFile,
    node: ts.Node,
    message: string,
    severity: 'error' | 'warning' | 'info'
  ) {
    const { line, character } = file.getLineAndCharacterOfPosition(
      node.getStart()
    );
    this.issues.push({
      file: file.fileName,
      line: line + 1,
      character: character + 1,
      message,
      severity,
    });
  }

  generateReport(): string {
    const bySeverity = {
      error: this.issues.filter(i => i.severity === 'error'),
      warning: this.issues.filter(i => i.severity === 'warning'),
      info: this.issues.filter(i => i.severity === 'info'),
    };

    let report = '';
    report += '='.repeat(60) + '\n';
    report += 'TypeScript 代码检查报告\n';
    report += '='.repeat(60) + '\n';
    report += `总计: ${this.issues.length} 个问题 `;
    report += `(ERROR: ${bySeverity.error.length}, `;
    report += `WARNING: ${bySeverity.warning.length}, `;
    report += `INFO: ${bySeverity.info.length})\n\n`;

    for (const issue of this.issues) {
      const icon = issue.severity === 'error' ? '❌'
        : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      report += `${icon} ${issue.file}:${issue.line}:${issue.character}\n`;
      report += `   ${issue.message}\n\n`;
    }

    return report;
  }
}


// ============================================================
// 示例 2: TypeScript AST 转换 — 重构辅助
// ============================================================

const classToFunctionTransformer: ts.TransformerFactory<ts.SourceFile> = (
  context: ts.TransformationContext
) => {
  return (sourceFile: ts.SourceFile) => {
    const visitor = (node: ts.Node): ts.Node => {
      // 检测: React 类组件 → 函数组件
      if (
        ts.isClassDeclaration(node) &&
        node.heritageClauses?.some(
          h => h.types.some(
            t => t.expression.getText() === 'React.Component' ||
                 t.expression.getText() === 'Component'
          )
        )
      ) {
        // 这种情况下需要更复杂的转换，这里仅作示例
        console.log(`发现 React 类组件: ${node.name?.getText()}`);
      }
      return ts.visitEachChild(node, visitor, context);
    };
    return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
  };
};


// ============================================================
// 示例 3: 未使用变量/导入检测
// ============================================================

class UnusedCodeDetector {
  private allDeclarations = new Map<string, ts.Node[]>();
  private allReferences = new Set<string>();

  analyze(sourceFile: ts.SourceFile) {
    this.collectDeclarations(sourceFile);
    this.collectReferences(sourceFile);
    return this.findUnused();
  }

  private collectDeclarations(node: ts.Node) {
    // 收集所有变量/函数/类型声明
    if (ts.isVariableDeclaration(node)) {
      const name = node.name.getText();
      if (!name.startsWith('_')) {
        const existing = this.allDeclarations.get(name) || [];
        this.allDeclarations.set(name, [...existing, node]);
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.getText();
      if (!name.startsWith('_')) {
        const existing = this.allDeclarations.get(name) || [];
        this.allDeclarations.set(name, [...existing, node]);
      }
    }
    ts.forEachChild(node, n => this.collectDeclarations(n));
  }

  private collectReferences(node: ts.Node) {
    // 收集所有标识符引用
    if (ts.isIdentifier(node) && !ts.isVariableDeclaration(node.parent)) {
      this.allReferences.add(node.getText());
    }
    ts.forEachChild(node, n => this.collectReferences(n));
  }

  private findUnused() {
    const unused: Array<{ name: string; node: ts.Node }> = [];
    for (const [name, nodes] of this.allDeclarations) {
      if (!this.allReferences.has(name)) {
        for (const node of nodes) {
          unused.push({ name, node });
        }
      }
    }
    return unused;
  }
}


// ============================================================
// 示例 4: API 使用一致性检查
// ============================================================

class APIConsistencyChecker {
  private apiCalls = new Map<string, Array<{
    file: string;
    line: number;
    args: string[];
  }>>();

  /**
   * 收集所有 API 调用并检查一致性
   */
  check(sourceFile: ts.SourceFile) {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;

        // 检查是否是 fetch 调用
        if (ts.isIdentifier(callee) && callee.getText() === 'fetch') {
          this.checkFetchCall(sourceFile, node);
        }

        // 检查是否是 axios 调用
        if (
          ts.isPropertyAccessExpression(callee) &&
          callee.expression.getText() === 'axios'
        ) {
          this.checkAxiosCall(sourceFile, node, callee.name.getText());
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  private checkFetchCall(file: ts.SourceFile, node: ts.CallExpression) {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart());

    if (node.arguments.length === 1) {
      console.log(
        `[WARN] ${file.fileName}:${line + 1} — ` +
        `fetch() 缺少第二个参数 (options)。请添加 method、headers 等配置。`
      );
    }

    // 检查是否有 .catch() 处理
    let parent = node.parent;
    let hasCatch = false;
    let hasThen = false;

    while (parent) {
      if (ts.isPropertyAccessExpression(parent)) {
        if (parent.name.getText() === 'catch') hasCatch = true;
        if (parent.name.getText() === 'then') hasThen = true;
      }
      parent = parent.parent;
    }

    if (hasThen && !hasCatch) {
      console.log(
        `[WARN] ${file.fileName}:${line + 1} — ` +
        `fetch() 有 .then() 但缺少 .catch() 错误处理`
      );
    }
  }

  private checkAxiosCall(
    file: ts.SourceFile,
    node: ts.CallExpression,
    method: string
  ) {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart());

    // 检查是否有 timeout 配置
    const configArg = node.arguments.length > 1 ? node.arguments[1] : null;
    if (
      configArg &&
      ts.isObjectLiteralExpression(configArg) &&
      !configArg.properties.some(
        p => p.name?.getText() === 'timeout'
      )
    ) {
      console.log(
        `[INFO] ${file.fileName}:${line + 1} — ` +
        `axios.${method}() 建议添加 timeout 配置`
      );
    }
  }
}


// ============================================================
// 主程序入口
// ============================================================

function main() {
  const fileName = process.argv[2] || 'src/index.ts';

  const program = ts.createProgram([fileName], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    strict: true,
  });

  const checker = program.getTypeChecker();

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;

    // 1. 类型检查
    const tsChecker = new TypeScriptChecker();
    tsChecker.checkAnyTypes(sourceFile, checker);
    tsChecker.checkNonNullAssertions(sourceFile);
    tsChecker.checkTypeAssertions(sourceFile);
    tsChecker.checkMissingReturnTypes(sourceFile);
    console.log(tsChecker.generateReport());

    // 2. 未使用代码检测
    const unusedDetector = new UnusedCodeDetector();
    const unused = unusedDetector.analyze(sourceFile);
    if (unused.length > 0) {
      console.log('\n未使用的声明:');
      for (const { name, node } of unused) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart()
        );
        console.log(`  ${sourceFile.fileName}:${line + 1} — "${name}"`);
      }
    }

    // 3. API 一致性检查
    const apiChecker = new APIConsistencyChecker();
    apiChecker.check(sourceFile);
  }
}

main();
