# ng-user-controls

Angular workspace for building reusable enterprise-style user controls, starting with:
- List View
- Code Editor (Monaco-powered)
- Data Grid
- Tree View
- 3D Scene Viewer (Three.js)
- 3D Bar Chart (Three.js)

## Current Tech State
- Angular: 21.2.x
- Node on this machine: 22.15.0

Angular 22 requires Node >= 22.22.3. Upgrade Node first, then run Angular update commands when ready.

## Quick Start

```bash
npm install
npm run build
npm start
```

Open `http://localhost:4200/` after the dev server starts.

## Project Planning Docs
- [Project delivery plan](docs/PROJECT-PLAN.md)
- [GitHub public publishing plan](docs/GITHUB-PUBLISH.md)

## Useful Commands

```bash
npm start
npm run build
npm test
```

## Notes
- This repository is scaffolded and ready for component implementation.
- Current controls are available in the in-app docs navigation:
	- `List View` with selection and row drag-drop reorder
	- `Code Editor` with live content updates
	- `Data Grid` with sorting, pagination, row selection, row drag-drop reorder, and column drag-drop reorder
	- `Tree View` with parent-child hierarchy, checkbox cascade, expand/collapse, and drag-drop reordering
	- `3D Scene Viewer` with Three.js, orbit controls, multiple shapes, background themes, live FPS, and object click events