# Project Plan: Angular User Controls Library

## Goal
Build a reusable Angular user-controls library with enterprise-grade control experiences, starting with:
- List View (virtualized, templated, sortable/filterable)
- Drag and Drop Flex View (responsive tiles/rows with drag-reorder and cross-container drop)

## Product Scope
- Framework: Angular (current project: v21.x)
- Distribution: Public npm package + live docs/demo app
- Target users: Angular teams needing enterprise-ready UI controls

## Architecture Direction
- `projects/user-controls`: Angular library package (controls + services + utilities)
- `apps/docs`: showcase/documentation app for examples, API, and playgrounds
- CDK-first approach: use Angular CDK for drag-drop, scrolling, overlays, accessibility primitives
- Theming: CSS variables + optional Sass API

## Delivery Phases

### Phase 1: Foundation (Week 1)
- Initialize monorepo layout with library + docs app
- Add linting, formatting, and test baseline
- Define design tokens and theming contract
- Set semantic versioning and changelog strategy

### Phase 2: List View Control (Week 2-3)
- Features:
  - Data input adapters (array, observable)
  - Template outlets for item/header/footer/empty state
  - Sorting, filtering, selection modes
  - Virtual scroll for large datasets
- Quality:
  - Unit tests for data behaviors
  - Accessibility: keyboard nav + ARIA roles
  - Story/demo examples in docs app

### Phase 3: Drag and Drop Flex View (Week 3-4)
- Features:
  - Reorder within container
  - Transfer between containers
  - Orientation/flex layout options
  - Drag handles, previews, placeholders
- Quality:
  - Pointer and keyboard interaction tests
  - Performance profiling with large lists
  - Docs and recipes (kanban, dashboard widgets)

### Phase 4: Enterprise Hardening (Week 5+)
- API review and stabilization
- i18n hooks and RTL verification
- Dark/light themes and custom token packs
- Bundle-size checks and performance budget gates

## Quality Gates
- Unit test coverage target: >= 85% on library packages
- Accessibility baseline: WCAG 2.1 AA for core interactions
- CI checks on every PR:
  - Lint
  - Unit tests
  - Build library + docs

## Suggested Backlog (Initial)
- `uc-list-view`: base list rendering
- `uc-list-view-virtual-scroll`
- `uc-list-view-selection`
- `uc-flex-dnd-container`
- `uc-flex-dnd-item`
- `uc-theme-tokens`
- `uc-docs-playground`

## Upgrade Note: Latest Angular (v22)
This machine currently has Node v22.15.0, while Angular v22 requires Node >= v22.22.3.

To move this project to Angular v22:
1. Upgrade Node to 22.22.3+ (or 24.15.0+).
2. Run `ng update @angular/core @angular/cli`.
3. Re-run test and build pipelines.
