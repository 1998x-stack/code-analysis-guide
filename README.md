# Code Analysis · AST · Static Analysis — Deep Technical Guide

> A comprehensive technical guide covering compiler theory, AST manipulation, and static analysis techniques — from fundamentals to industrial practice.

[![Pages](https://img.shields.io/badge/GitHub%20Pages-live-brightgreen)](https://1998x-stack.github.io/code-analysis-guide/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📖 Overview

This repository provides a **deep technical guide** on three interconnected topics:

- **Code Analysis** — Static vs. dynamic analysis, analysis layers (text → AST → IR → binary), soundness vs. precision trade-offs
- **AST (Abstract Syntax Tree)** — Lexing, parsing algorithms, visitor patterns, cross-language AST comparison
- **Static Analysis** — Data flow analysis (lattice theory), control flow graphs, symbolic execution, abstract interpretation

Content is available in **Chinese** with bilingual code examples. Beautiful HTML versions with dark-theme design system are hosted on GitHub Pages.

---

## 🚀 Quick Start

### Read Online
Visit **[GitHub Pages](https://1998x-stack.github.io/code-analysis-guide/)** for beautifully rendered HTML versions.

### Read Locally
```bash
git clone https://github.com/1998x-stack/code-analysis-guide.git
cd code-analysis-guide
open html/index.html
```

---

## 📂 Repository Structure

```
code-analysis-guide/
├── README.md                              # You are here (English)
├── 01-代码分析概述.md                      # Ch.1: Code Analysis Overview
├── 02-AST抽象语法树详解.md                  # Ch.2: AST Deep Dive
├── 03-静态分析技术深度剖析.md                # Ch.3: Static Analysis Techniques
├── 04-工具与实践.md                         # Ch.4: Tools & Practice
├── 05-ast-examples/                       # Code examples
│   ├── javascript/                        # Babel plugin, ESLint rules, complexity calculator
│   ├── python/                            # AST linter, transformer, code metrics
│   └── typescript/                        # TS Compiler API, type checker, API consistency
└── html/                                  # Interactive HTML versions
    ├── index.html                         # Landing page
    ├── 01-代码分析概述.html                 # Ch.1 HTML
    ├── 02-AST抽象语法树详解.html            # Ch.2 HTML
    ├── 03-静态分析技术深度剖析.html          # Ch.3 HTML
    ├── 04-工具与实践.html                  # Ch.4 HTML
    └── assets/base-dark.css              # Design system
```

---

## 📚 Chapter Guide

| Chapter | Content | Code Examples |
|---------|---------|---------------|
| **Chapter 1** | Code analysis fundamentals, static vs. dynamic, analysis layers, soundness vs. precision, Rice's theorem | - |
| **Chapter 2** | AST internals: lexing, parsing (recursive descent, LL, LR), visitor pattern, ESTree/Babel/Python/Go AST comparison, error recovery, incremental parsing | Complexity calculator, dependency graph builder |
| **Chapter 3** | Data flow analysis (lattice theory, IFDS), control flow (CFG, dominator tree), type systems (Curry-Howard, variance), symbolic execution (SMT solvers), abstract interpretation (Astrée case study), taint analysis, program slicing | - |
| **Chapter 4** | 50+ tool matrix (per language), CI/CD quality gate architecture, ESLint type-aware rules, Semgrep security rules, CodeQL path queries, ast-grep refactoring, tree-sitter analyzer, TypeScript Compiler API, best practices | Babel plugin, ESLint rule, Python linter/transformer, TS type checker |

---

## 🛠️ Technology Stack Covered

| Language | AST Libraries | Static Analysis Tools |
|----------|-------------|----------------------|
| **JavaScript/TS** | `acorn`, `@babel/parser`, `typescript` | ESLint, TypeScript Compiler, CodeQL |
| **Python** | `ast` (stdlib), `libcst` | Ruff, Pylint, Mypy, Bandit, Semgrep |
| **Java** | `JavaParser`, `Eclipse JDT` | SpotBugs, PMD, Error Prone, SonarQube |
| **Go** | `go/ast`, `go/parser` | go vet, staticcheck, golangci-lint |
| **Rust** | `syn`, `quote` | Clippy, rust-analyzer |
| **C/C++** | `clang AST`, `libclang` | Clang Static Analyzer, Cppcheck |
| **Multi-language** | `tree-sitter`, `ast-grep` | Semgrep, CodeQL, SonarQube |

---

## 🎯 Who Is This For?

- **Software Engineers** who want to understand how linters, formatters, and static analyzers work under the hood
- **Security Engineers** building or tuning SAST (Static Application Security Testing) pipelines
- **Compiler Enthusiasts** interested in the bridge between academic compiler theory and industrial tooling
- **Tool Builders** looking to create custom code analysis tools using tree-sitter, ESLint, or TypeScript Compiler API

---

## 🔧 Key Technical Highlights

- **Rice's Theorem** — Why no static analysis can be both sound and complete
- **Lattice Theory** — Mathematical foundation of data flow analysis
- **Curry-Howard Isomorphism** — Types as propositions, programs as proofs
- **Astrée Case Study** — How abstract interpretation verified Airbus A380 flight control software with zero false alarms
- **Google Tricorder** — Industrial-scale static analysis: 50,000+ code reviews analyzed daily
- **Path Explosion** — Why symbolic execution doesn't scale and how to mitigate it
- **Covariance/Contravariance** — Deep dive into type variance with TypeScript examples

---

## 📄 License

MIT — Feel free to use, modify, and share.

---

## 🙏 References

- [Crafting Interpreters](https://craftinginterpreters.com/) — Robert Nystrom
- [Engineering a Compiler (2nd Ed)](https://www.elsevier.com/books/engineering-a-compiler/cooper/978-0-12-088478-0) — Cooper & Torczon
- [Static Program Analysis](https://cs.au.dk/~amoeller/spa/) — Møller & Schwartzbach
- [Lessons from Building Static Analysis Tools at Google](https://cacm.acm.org/research/lessons-from-building-static-analysis-tools-at-google/) — Sadowski et al.
