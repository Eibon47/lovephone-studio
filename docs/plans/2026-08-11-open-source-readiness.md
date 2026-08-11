# Open Source Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the repository understandable, safe to fork, and automatically verifiable before it is made public.

**Architecture:** Keep runtime behavior unchanged and concentrate the work in public documentation, contributor guardrails, CI, and a checked-in custom App example. Security boundaries are documented beside the existing privacy and custom-App documents so users see the same rules at installation and in the repository.

**Tech Stack:** GitHub Actions, npm, Node.js test runner, Markdown, LovePhone custom App package format.

---

### Task 1: Repair public entry documentation

**Files:**
- Modify: `README.md`

**Steps:** Repair the broken phone-mode code fence, add a concise custom-App section and link all public policies.

### Task 2: Document third-party App risk

**Files:**
- Modify: `docs/PRIVACY.md`, `SECURITY.md`, `docs/CUSTOM_APP_DEVELOPER_GUIDE.md`

**Steps:** Describe sandboxing, permission grants, data sharing, AI spending and trusted-source guidance.

### Task 3: Add continuous verification

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/dependabot.yml`

**Steps:** Run clean install, tests and static web build on supported pull requests and scheduled dependency updates.

### Task 4: Synchronize release materials

**Files:**
- Modify: `docs/RELEASE_AUDIT.md`, `docs/GITHUB_RELEASE_CHECKLIST.md`

**Steps:** Record the current 143-test baseline, custom-App checks, and the npm-mirror audit limitation with an official-registry command.

### Task 5: Add contributor-facing artifacts

**Files:**
- Create: `CODE_OF_CONDUCT.md`, `SUPPORT.md`, `CHANGELOG.md`, `examples/hello-companion/*`
- Modify: `CONTRIBUTING.md`

**Steps:** Set community expectations, support boundaries, release history and a readable custom-App source example.
