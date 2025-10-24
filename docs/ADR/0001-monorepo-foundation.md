# ADR 0001: Monorepo Foundation

- Status: Accepted
- Date: 2024-12-04

## Context

StemPacker requires a cohesive desktop application that combines Electron with a modern frontend toolchain. The project must support shared packages, strict linting and formatting, and fast iteration on the renderer while compiling the main and preload processes.

## Decision

We adopted a pnpm-powered monorepo with dedicated workspaces for the Electron desktop app and shared packages. Electron (v38) hosts the main process, while Vite powers a React renderer. Tailwind CSS with DaisyUI (dark theme) delivers the base visual language. Tooling includes ESLint, Prettier, and Vitest configured at the workspace level. Main and preload scripts are bundled with tsup for both development watch mode and production builds.

## Consequences

- Consistent tooling across packages and apps via pnpm recursive scripts.
- Fast renderer refresh through Vite while Electron restarts on main/preload updates.
- Shared UI/i18n utilities can evolve independently inside `/packages`.
- The setup satisfies the project's quality gates (`lint`, `typecheck`, `test`, `build`, `dev`).
