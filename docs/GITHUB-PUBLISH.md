# GitHub Publish Plan (Public Repo)

## 1. Create Local Git History
From project root:

```bash
git init
git add .
git commit -m "chore: initialize angular user controls workspace"
```

## 2. Create GitHub Repository
Create a new repository on GitHub:
- Name suggestion: `ng-user-controls`
- Visibility: `Public`
- Do not initialize with README/license/gitignore (already present locally)

## 3. Link Local Repo to GitHub
Replace `<your-username>` with your GitHub username:

```bash
git remote add origin https://github.com/<your-username>/ng-user-controls.git
git branch -M main
git push -u origin main
```

## 4. Make It Easy for Others to Use
- Add a clear project description on GitHub
- Add topics: `angular`, `ui-components`, `drag-drop`, `list-view`, `component-library`
- Enable Issues and Discussions
- Add `CONTRIBUTING.md` and a code of conduct

## 5. Protect Quality on Public Contributions
- Add branch protection for `main`:
  - Require PR reviews
  - Require passing CI checks
- Add CI workflow for lint, test, and build

## 6. Recommended Release Workflow
- Use Conventional Commits for PRs
- Tag releases (`v0.1.0`, `v0.2.0`, ...)
- Publish changelog with every release
- Optionally publish to npm once controls are stable

## 7. Suggested Next Commits
1. `feat: add library workspace structure`
2. `feat: add list view control (MVP)`
3. `feat: add drag and drop flex view (MVP)`
4. `docs: add usage guides and API docs`
5. `ci: add lint/test/build workflows`
