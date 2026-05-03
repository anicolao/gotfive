# PROJECT_LOG.md

## 2026-05-03: Initial Project Setup

**User Prompt:**
> We're going to implement the "Got Five!" game. Make a new repository for this purpose, following these setup steps:
> 
> ## Default Project Shape
> 
> - Create the project folder in the requested location before installing or scaffolding anything.
> - Start `PROJECT_LOG.md` immediately.
> - Record every user prompt verbatim in the log.
> - Keep setup notes and lessons learned in the same log so later sessions can turn them into reusable skills.
> - Add `AGENTS.md` early with the repository workflow conventions.
> - Use pull requests for repository changes by default.
> - Use short-lived `codex/` branches for Codex-authored work.
> 
> ## Reproducible Tooling
> 
> - Use a Nix flake for the development environment.
> - Put `bun`, `gh`, and `git` in the default dev shell.
> - Use Bun for `package.json`, dependency installation, scripts, and `node_modules`.
> - Run project commands through `nix develop` so tool versions remain reproducible.
> - Commit both `flake.nix` and `flake.lock`.
> - Commit `bun.lock` after dependency installation.
> 
> ## GitHub Repository Setup
> 
> - Create the GitHub repository with `gh`.
> - Make the repository public.
> - Enable GitHub Pages from the `gh-pages` branch root.
> - If the Pages REST API rejects form-encoded nested input, send JSON:
> 
> ```sh
> printf '%s' '{"source":{"branch":"gh-pages","path":"/"}}' \
>   | gh api repos/OWNER/REPO/pages -X POST --input -
> ```
> 
> - Verify Pages configuration with:
> 
> ```sh
> gh api repos/OWNER/REPO/pages
> ```
> 
> ## Documentation Baseline
> 
> Every new project should start with:
> 
> - `README.md`: concise project summary, current rules/product behavior, development commands.
> - `VISION.md`: product goals, experience principles, technical direction, near-term milestones, open questions.
> - `PROJECT_LOG.md`: verbatim prompts, setup notes, lessons learned.
> - `AGENTS.md`: collaboration workflow and project conventions.
> - `E2E_GUIDE.md`: testing philosophy and scenario conventions once UI work begins.
> 
> ## PWA Scaffold
> 
> - Use Vite with TypeScript for the initial web scaffold.
> - Keep the first screen minimal until the product direction is ready.
> - Include a web app manifest from the start.
> - Configure the Vite base path from `PUBLIC_BASE_PATH` so GitHub Pages works for both production and PR previews.
> - For Got Five, production builds deploy under `/gotfive/` and PR previews under `/gotfive/prN/`.
> 
> ## E2E Testing Strategy
> 
> Copy E2E testing from `anicolao/food` and `anicolao/chess-tt` following as closely as possible.
> 
> Key process decisions:
> 
> - Use Playwright.
> - Treat E2E tests as the primary correctness signal for visible UI behavior.
> - Use a zero-pixel tolerance for visual snapshots.
> - Keep tests deterministic.
> - Avoid arbitrary sleeps such as `page.waitForTimeout()`.
> - Keep Playwright assertions and actions at or under 2000ms, except for CI web server startup.
> - Prefer role, label, and text locators over brittle CSS selectors.
> - Commit scenario README files and screenshot baselines.
> 
> Use numbered scenario folders:
> 
> ```text
> tests/e2e/
> ├── helpers/
> │   └── test-step-helper.ts
> └── 001-homepage/
>     ├── 001-homepage.spec.ts
>     ├── README.md
>     └── screenshots/
>         └── 000-initial-load.png
> ```
> 
> Use a unified step helper so each test step runs assertions, waits for animations, captures a screenshot, and updates scenario documentation in one place.
> 
> ## CI And Visual Baselines
> 
> - Visual baselines are OS-sensitive because fonts and rendering differ across runners.
> - If screenshots are generated on macOS, run E2E CI on `macos-latest`.
> - Alternatively, commit per-platform snapshots deliberately.
> - Upload Playwright reports on failure or completion for easier debugging.
> - Use `gh run view --log-failed` and `gh pr checks` to investigate CI failures.
> 
> ## GitHub Pages Workflows
> 
> Replicate the reference workflow pattern:
> 
> - On pull requests, build and deploy to `gh-pages` under `prN/`.
> - On pushes to `main`, build and deploy to the root of the `gh-pages` branch.
> - Keep previous deployments with `keep_files: true`.
> - Add or update a PR comment with the preview URL.
> 
> Production may 404 before the first successful `main` deploy, even if PR previews work.
> 
> ## Verification Checklist
> 
> Before opening a setup PR:
> 
> - `nix develop` enters cleanly and prints expected tool versions.
> - `bun install` creates or updates `bun.lock`.
> - `bun run build` passes.
> - `bun run test:e2e:update-snapshots` generates expected scenario docs and screenshots.
> - `bun run test:e2e` passes without updating snapshots.
> - `git diff --check` passes.
> - `gh pr create` opens a PR against `main`.
> - `gh pr checks --watch` reports green checks.
> - PR preview URL returns HTTP 200.
> - GitHub Pages settings point at `gh-pages` branch root.

**Notes:**
- Successfully created repository LLM-Orchestration/gotfive.
- Configured Vite + React + TypeScript + Bun.
- Set up Playwright E2E tests with unified step pattern.
- Implemented CI/CD with GitHub Actions for GH Pages.

## 2026-05-03: Fixing Repository Gaps

**User Prompt:**
> Please fix missing flake.nix and sparse PROJECT_LOG.md in LLM-Orchestration/gotfive.
> 
> Gaps:
> 1. flake.nix and flake.lock are missing from the repo.
> 2. PROJECT_LOG.md is missing verbatim prompts.
> 3. PROJECT_LOG.md is not in the main branch.

**Lessons Learned:**
- Ensure all required configuration files (like `flake.nix`) are committed to the `main` branch.
- PROJECT_LOG.md must contain the EXACT text of user prompts to maintain context for future agents.

## 2026-05-03: Final Setup Refinements

**User Prompt:**
> The "Got Five!" repository setup is almost complete, but there are a few remaining items to address in LLM-Orchestration/gotfive:
> 
> 1. flake.lock is missing: The requirement was to commit both flake.nix and flake.lock. Please generate flake.lock and commit it to the main branch (via a PR).
> 2. Zero-pixel tolerance: The requirement was to use zero-pixel tolerance for visual snapshots. Please update playwright.config.ts to include:
>    expect: {
>      toHaveScreenshot: {
>        maxDiffPixels: 0,
>      },
>    },
> 3. Verification: 
>    - Run bun run build and bun run test:e2e in the gotfive repo to ensure everything passes.
>    - Update PROJECT_LOG.md in gotfive to include this final fix step and its verbatim prompt.
> 
> When done, please provide the PR link and ensure all CI checks are green.

**Notes:**
- Updated `playwright.config.ts` with `maxDiffPixels: 0`.
- Verified build and E2E tests: `bun run build` and `bun run test:e2e` pass.
- Generated `flake.lock` using `nix-portable`.

## 2026-05-03: Refining CI/CD Setup

**User Prompt:**
> Please refine the CI/CD setup in LLM-Orchestration/gotfive.
> 
> The deploy.yml workflow only handles deployment. It must also run E2E tests (bun run test:e2e) on PRs and main, and upload Playwright reports on failure/completion. Ensure commands in CI run through Nix if possible.
> 
> Update PROJECT_LOG.md in gotfive with this prompt. Open a PR in gotfive and ensure all checks pass.

**Action Plan:**
- Update `deploy.yml` to include Nix installation and run commands through `nix develop`.
- Add E2E test step to `deploy.yml`.
- Add Playwright report upload on failure/completion.
- Verify changes by pushing to a branch and opening a PR.

## 2026-05-03: E2E Framework Fix and Standardisation (Orchestration)

**Action Plan (Orchestration):**
- Analyzed the current React-based project structure.
- Reviewed existing `playwright.config.ts`, `TestStepHelper`, and `E2E_GUIDE.md`.
- Verified that `deploy.yml` runs E2E tests but lacks specialized snapshot workflows.
- Prepared detailed instructions for `@coder` to implement the standardized E2E framework, including:
    - Software-rendered, deterministic Playwright configuration.
    - Updated `TestStepHelper` with zero-pixel tolerance.
    - Explicit `E2E_GUIDE.md`.
    - New workflows for snapshot regeneration and PR validation.
- Delegating implementation to `@coder`.



