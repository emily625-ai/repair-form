# Project Structure

This document defines the active project roots for the customer service record system.

## Formal Frontend Repo

Path:

```text
F:\07_網站與專案\repair-form
```

Purpose:

- Customer service record system frontend.
- GitHub Pages source.
- UI files, frontend JavaScript modules, frontend documentation, and frontend workflow notes.

Use this root for:

- Case list UI.
- Frontend filters and table layout.
- Frontend import/export controls.
- GitHub Pages deployment.
- Frontend documentation in `docs/`.

Do not use this root for:

- Report API backend changes.
- Render deployment source changes.
- Temporary scratch files or production data exports.

## Formal Report API Repo

Path:

```text
C:\Users\emily\OneDrive\文件\New project\report-api
```

Purpose:

- Report API backend.
- Weekly and monthly Excel export generation.
- Render deployment source for `report-api`.

Use this root for:

- `app.py` report generation logic.
- API dependencies such as `requirements.txt`.
- Weekly report changes.
- Monthly report changes.
- Render backend deployment changes.

Do not use this root for:

- Frontend UI layout changes.
- GitHub Pages frontend deployment.
- Customer Excel output storage.

## Temporary / Reference Workspace

Path:

```text
C:\Users\emily\OneDrive\文件\New project
```

Purpose:

- Temporary workspace.
- Reference files.
- Scratch files.
- Staging notes.
- SQL drafts or copied working files.

Important rules:

- `New project` itself is not a formal project root.
- Do not manage `New project` as one complete project.
- Do not assume every file in `New project` belongs to the same repo.
- Only `New project\report-api` is a formal repo inside this folder.
- Do not move files out of `New project` unless the user explicitly requests it.

## Codex Root Selection Rules

When opening Codex or selecting a project root:

- For frontend work, open `F:\07_網站與專案\repair-form`.
- For report API work, open `C:\Users\emily\OneDrive\文件\New project\report-api`.
- Do not open `C:\Users\emily\OneDrive\文件\New project` as the main project root for normal work.

Task routing:

| Task Type | Correct Root |
| --- | --- |
| Frontend UI, layout, buttons, filters | `F:\07_網站與專案\repair-form` |
| GitHub Pages frontend publishing | `F:\07_網站與專案\repair-form` |
| Weekly/monthly Excel report API | `C:\Users\emily\OneDrive\文件\New project\report-api` |
| Render backend deployment | `C:\Users\emily\OneDrive\文件\New project\report-api` |
| Temporary notes or one-off references | `C:\Users\emily\OneDrive\文件\New project` |

## Safety Rules

- Do not modify existing functionality when only documentation is requested.
- Do not move files unless explicitly requested.
- Confirm the correct repo before committing.
- Keep frontend and report API commits separate.
- Keep production data, exported reports, and sensitive files out of Git.
