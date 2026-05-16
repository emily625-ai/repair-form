# repair-form

This repository is the official frontend repo for the customer service record system.

## Project Locations

Official frontend repo:

```text
F:\07_網站與專案\repair-form
```

Official report API repo:

```text
C:\Users\emily\OneDrive\文件\New project\report-api
```

Temporary / reference workspace:

```text
C:\Users\emily\OneDrive\文件\New project
```

## Important Root Directory Rules

- `F:\07_網站與專案\repair-form` is the formal frontend repository.
- `C:\Users\emily\OneDrive\文件\New project\report-api` is the formal report API repository.
- `C:\Users\emily\OneDrive\文件\New project` itself is only a temporary, reference, and staging workspace.
- Only the `report-api` folder inside `New project` is a formal repository.
- Do not treat `New project` as one full project root.
- When using Codex, open `repair-form` for frontend work and `report-api` for report API work.

See also:

- `docs/workflow/PROJECT_STRUCTURE.md`

## Local Development Server

Use a local HTTP server for browser testing instead of opening the HTML file with `file://`.
Some browser features and script loading behavior can be blocked or behave differently in `file://` mode.

### Option 1: Python http.server

From the frontend repo:

```powershell
cd "F:\07_網站與專案\repair-form"
python -m http.server 8765 --bind 127.0.0.1
```

If `python` is not available, try:

```powershell
cd "F:\07_網站與專案\repair-form"
py -m http.server 8765 --bind 127.0.0.1
```

Open this URL:

```text
http://127.0.0.1:8765/客服記錄系統.html
```

Stop the server with `Ctrl + C` in the terminal.

### Option 2: VSCode Live Server

1. Open `F:\07_網站與專案\repair-form` in VSCode.
2. Install the `Live Server` extension if it is not already installed.
3. Right-click `客服記錄系統.html`.
4. Choose `Open with Live Server`.

Use this only for local preview. Do not connect new features to production API or Supabase during MVP staging checks unless the task explicitly requires it.
