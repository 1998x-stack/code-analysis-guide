/**
 * AST 实战示例 2: Python — ast 模块与自定义 lint 工具
 *
 * Python 标准库 `ast` 模块的实战用法
 */

import ast
import sys
from typing import List, Dict, Any


# ============================================================
# 示例 1: 自定义 Python Lint 规则
# ============================================================

class CustomLinter(ast.NodeVisitor):
    """自定义 Python 代码检查器"""

    def __init__(self):
        self.issues: List[Dict[str, Any]] = []
        self.current_function = None

    def report(self, node: ast.AST, message: str, severity: str = "WARNING"):
        """记录一个问题"""
        self.issues.append({
            "line": getattr(node, 'lineno', 0),
            "col": getattr(node, 'col_offset', 0),
            "severity": severity,
            "message": message,
            "function": self.current_function,
        })

    # ---- 规则: 检测裸 except ----
    def visit_ExceptHandler(self, node: ast.ExceptHandler):
        """
        检测: except: (裸 except，吞掉所有异常)
        风险: 会捕获 KeyboardInterrupt、SystemExit 等不应捕获的异常
        """
        if node.type is None:
            self.report(node,
                "避免使用裸 except:，至少指定 except Exception: 或特定异常类型",
                severity="ERROR"
            )
        self.generic_visit(node)

    # ---- 规则: 检测可变默认参数 ----
    def visit_FunctionDef(self, node: ast.FunctionDef):
        """
        检测: def func(items=[]): (可变对象作为默认参数)
        风险: 默认参数在函数定义时只计算一次，会导致状态共享
        """
        old_func = self.current_function
        self.current_function = node.name

        for default in node.args.defaults:
            if isinstance(default, (ast.List, ast.Dict, ast.Set)):
                self.report(default,
                    f"函数 '{node.name}' 使用可变对象作为默认参数。"
                    f"建议使用 None 并在函数内部初始化。",
                    severity="ERROR"
                )

        self.generic_visit(node)
        self.current_function = old_func

    # ---- 规则: 检测过于宽泛的异常捕获 ----
    def visit_ExceptHandler_exception(self, node: ast.ExceptHandler):
        if node.type and isinstance(node.type, ast.Name):
            if node.type.id == 'Exception':
                self.report(node,
                    "捕获 Exception 过于宽泛，请指定更具体的异常类型",
                    severity="WARNING"
                )
            elif node.type.id == 'BaseException':
                self.report(node,
                    "不要捕获 BaseException，这会捕获 KeyboardInterrupt 等系统异常",
                    severity="ERROR"
                )

    # ---- 规则: 检测未使用的 import ----
    def __init__(self):
        super().__init__()
        self.issues = []
        self.current_function = None
        self.imports = set()
        self.used_names = set()

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.add(alias.asname or alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        for alias in node.names:
            self.imports.add(alias.asname or alias.name)
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name):
        if isinstance(node.ctx, ast.Load):
            self.used_names.add(node.id)
        self.generic_visit(node)

    # ---- 规则: 检测使用 eval/exec ----
    def visit_Call(self, node: ast.Call):
        if isinstance(node.func, ast.Name):
            if node.func.id in ('eval', 'exec'):
                self.report(node,
                    f"使用了 {node.func.id}()，存在代码注入风险",
                    severity="ERROR"
                )
        self.generic_visit(node)

    # ---- 规则: 检测硬编码密钥 ----
    def visit_Assign(self, node: ast.Assign):
        """检测变量名包含敏感关键词的赋值"""
        sensitive_keywords = {
            'password', 'secret', 'api_key', 'token',
            'private_key', 'access_key'
        }
        for target in node.targets:
            if isinstance(target, ast.Name):
                if target.id.lower() in sensitive_keywords:
                    if isinstance(node.value, ast.Constant):
                        self.report(node,
                            f"硬编码的敏感值 '{target.id}'。"
                            f"请使用环境变量或密钥管理服务",
                            severity="ERROR"
                        )
        self.generic_visit(node)

    # ---- 规则: 检测过深的嵌套 ----
    def visit_FunctionDef_nesting(self, node: ast.FunctionDef):
        self.current_function = node.name
        max_depth = self._get_max_nesting_depth(node)
        if max_depth > 4:
            self.report(node,
                f"函数 '{node.name}' 嵌套深度为 {max_depth}，"
                f"建议不超过 4 层",
                severity="WARNING"
            )
        self.generic_visit(node)

    def _get_max_nesting_depth(self, node: ast.AST, current_depth: int = 0) -> int:
        nested_types = (ast.If, ast.For, ast.While, ast.Try, ast.With)
        if isinstance(node, nested_types):
            current_depth += 1

        max_child_depth = current_depth
        for child in ast.iter_child_nodes(node):
            child_depth = self._get_max_nesting_depth(child, current_depth)
            max_child_depth = max(max_child_depth, child_depth)

        return max_child_depth


# ============================================================
# 示例 2: AST 转换 — 安全的代码改写
# ============================================================

class PrintToLogTransformer(ast.NodeTransformer):
    """
    将所有 print() 调用替换为 logging.info()
    并将 print(f"...") 替换为 logger.info(f"...")
    """
    def __init__(self):
        self.has_logging_import = False

    def visit_Module(self, node: ast.Module):
        # 检查是否已有 logging import
        for child in ast.iter_child_nodes(node):
            if isinstance(child, ast.Import):
                for alias in child.names:
                    if alias.name == 'logging':
                        self.has_logging_import = True

        # 如果没有，添加 import logging
        if not self.has_logging_import:
            import_node = ast.Import(
                names=[ast.alias(name='logging', asname=None)]
            )
            node.body.insert(0, import_node)

        # 添加 logger = logging.getLogger(__name__) (在 import 之后)
        logger_assignment = ast.Assign(
            targets=[ast.Name(id='logger', ctx=ast.Store())],
            value=ast.Call(
                func=ast.Attribute(
                    value=ast.Name(id='logging', ctx=ast.Load()),
                    attr='getLogger',
                    ctx=ast.Load()
                ),
                args=[ast.Attribute(
                    value=ast.Name(id='__name__', ctx=ast.Load()),
                    attr=None, ctx=ast.Load()
                )],
                keywords=[]
            )
        )
        node.body.insert(1, logger_assignment)

        return self.generic_visit(node)

    def visit_Call(self, node: ast.Call):
        # 检查是否是 print() 调用
        if isinstance(node.func, ast.Name) and node.func.id == 'print':
            # 替换为 logger.info()
            return ast.Call(
                func=ast.Attribute(
                    value=ast.Name(id='logger', ctx=ast.Load()),
                    attr='info',
                    ctx=ast.Load()
                ),
                args=node.args,
                keywords=node.keywords
            )
        return self.generic_visit(node)


# ============================================================
# 示例 3: 代码度量工具
# ============================================================

class CodeMetrics(ast.NodeVisitor):
    """计算代码度量指标"""

    def __init__(self):
        self.functions = []
        self.total_lines = 0
        self.comment_lines = 0
        self.blank_lines = 0
        self._current_func = None

    def visit_FunctionDef(self, node: ast.FunctionDef):
        metrics = {
            'name': node.name,
            'line': node.lineno,
            'args': len(node.args.args),
            'lines': node.end_lineno - node.lineno + 1 if node.end_lineno else 0,
            'complexity': self._cyclomatic_complexity(node),
            'cognitive_complexity': self._cognitive_complexity(node),
            'returns': self._count_returns(node),
        }
        self.functions.append(metrics)
        self.generic_visit(node)

    def _cyclomatic_complexity(self, node: ast.AST) -> int:
        """计算圈复杂度"""
        complexity = 1
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.For, ast.While,
                                  ast.ExceptHandler, ast.With)):
                complexity += 1
            elif isinstance(child, ast.BoolOp):
                complexity += len(child.values) - 1
        return complexity

    def _cognitive_complexity(self, node: ast.AST, nesting: int = 0) -> int:
        """
        计算认知复杂度（简化版）
        认知复杂度考虑：
        - 嵌套深度 (nesting penalty)
        - 结构复杂度
        """
        complexity = 0
        nesting_structures = (ast.If, ast.For, ast.While,
                              ast.Try, ast.ExceptHandler)

        for child in ast.iter_child_nodes(node):
            if isinstance(child, nesting_structures):
                # 嵌套的结构：基础分 + 嵌套惩罚
                complexity += 1 + nesting
                # 递归检查内部，嵌套层级 +1
                complexity += self._cognitive_complexity(child, nesting + 1)
            elif isinstance(child, ast.BoolOp):
                # 逻辑运算符序列
                complexity += len(child.values) - 1
            else:
                complexity += self._cognitive_complexity(child, nesting)

        return complexity

    def _count_returns(self, node: ast.AST) -> int:
        """统计 return 语句数量"""
        return sum(1 for n in ast.walk(node) if isinstance(n, ast.Return))

    def generate_report(self) -> str:
        """生成度量报告"""
        report = []
        report.append("=" * 60)
        report.append("代码度量报告")
        report.append("=" * 60)

        if not self.functions:
            report.append("未找到函数定义")
            return "\n".join(report)

        for func in sorted(self.functions,
                           key=lambda f: f['cognitive_complexity'],
                           reverse=True):
            rating = self._rate_complexity(func['cognitive_complexity'])
            report.append(
                f"\n{func['name']} (行 {func['line']})"
                f"\n  代码行数:       {func['lines']}"
                f"\n  参数数量:       {func['args']}"
                f"\n  圈复杂度:       {func['complexity']}"
                f"\n  认知复杂度:     {func['cognitive_complexity']} ({rating})"
                f"\n  return 数量:    {func['returns']}"
            )

        return "\n".join(report)

    @staticmethod
    def _rate_complexity(score: int) -> str:
        if score <= 5:  return "A — 优秀"
        if score <= 10: return "B — 良好"
        if score <= 20: return "C — 可接受"
        if score <= 30: return "D — 需重构"
        return "F — 超出限制"


# ============================================================
# 使用示例
# ============================================================

def demo_linter():
    """演示自定义 Linter"""
    code = """
import os

# BAD: 硬编码密钥
password = "super_secret_123"

def process_data(items=[]):  # BAD: 可变默认参数
    try:
        for item in items:
            eval(item)  # BAD: 使用 eval()
            print(f"Processing: {item}")
    except:  # BAD: 裸 except
        pass
"""
    tree = ast.parse(code)
    linter = CustomLinter()
    linter.visit(tree)

    print("发现的问题:")
    for issue in sorted(linter.issues, key=lambda x: x['line']):
        print(f"  行 {issue['line']}: [{issue['severity']}] {issue['message']}")


def demo_transformer():
    """演示 AST 转换"""
    code = """
def greet(name):
    print(f"Hello, {name}!")
    print("Done")

greet("World")
"""
    tree = ast.parse(code)
    transformer = PrintToLogTransformer()
    new_tree = transformer.visit(tree)
    ast.fix_missing_locations(new_tree)

    # 反编译为代码
    new_code = ast.unparse(new_tree)
    print("转换后的代码:")
    print(new_code)


if __name__ == '__main__':
    print("=== Linter 演示 ===")
    demo_linter()

    print("\n=== AST 转换演示 ===")
    demo_transformer()
