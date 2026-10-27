# Rizhai (日摘)

**Turn scattered SVN commit messages into a DingTalk-ready daily log.**

Rizhai is a small local web app. Once a day you pick a date, pull logs from every configured SVN repo, uncheck commits that should not appear in the report, then copy (or submit) the result to DingTalk.

It is meant for people who still work with multiple SVN trunks and write DingTalk work reports by hand.

## Features

- Pull commit messages from many SVN repositories in parallel
- Filter by calendar day and timezone; “only mine” by SVN author
- Personal vs team wording (team lines include the author)
- Include / exclude individual commits; drafts autosave per date
- Paste plain or XML `svn log` output when the network is blocked
- Copy the full report, or submit via DingTalk Open API / group webhook
- Sample data so you can preview the layout without real repos

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer
- An `svn` command on your `PATH`

```bash
# Windows — pick one
# - TortoiseSVN: enable “command line client tools”, ensure svn is on PATH
# - SlikSVN or VisualSVN: install and add svn.exe to PATH

# macOS
brew install subversion

# Ubuntu / Debian
sudo apt install subversion
```

## Quick start

```bash
git clone https://github.com/ZhaoNan7/rizhai.git
cd rizhai
```

Then start it the easy way:

| OS | How |
|----|-----|
| **Windows** | Double-click `start.cmd` |
| **macOS / Linux** | `chmod +x start.sh && ./start.sh` |

The script installs dependencies on first run, opens the browser, and serves [http://127.0.0.1:43123](http://127.0.0.1:43123).

Same thing from a terminal after the first install:

```bash
npm run dev
```

### Other modes

```bash
npm run build && npm start      # production build, localhost only
npm run build && npm run start:lan   # LAN bind — no login, do not expose publicly
```

## Daily workflow

1. Add each project URL (usually a `trunk` or the path you actually commit to).
2. Enter SVN username/password, or prefer **saved credentials on this machine** (safer: password is not passed on the process command line).
3. In Settings, set your SVN username so “only mine” works.
4. Pick a date → **Pull commits**.
5. Uncheck noise; fill unfinished / coordination / tomorrow sections.
6. **Copy full text** into DingTalk, or use the submit / group-robot actions.

### Offline paste fallback

On a machine that can reach SVN:

```bash
svn log -v -r {2026-10-27T00:00:00+08:00}:{2026-10-27T23:59:59+08:00} https://svn.example.com/order/trunk
```

Paste the output into that repo’s “Paste svn log” dialog. Chinese and English `svn log` text both work. After paste, the generated “today’s work” section refreshes automatically (unless you have hand-edited it).

Adjust the offset to match Settings → timezone (default `+08:00`).

## DingTalk integration

Copy-paste needs no DingTalk permissions.

### Personal work report (Open API)

1. Create an internal enterprise app on the [DingTalk Open Platform](https://open.dingtalk.com/).
2. Enable scopes for querying and managing employee reports, then publish the app.
3. Put AppKey, AppSecret, and your `userId` in Settings.
4. Set the template name exactly (e.g. `日报`), then **Save and load template**.
5. Map each template field to a Rizhai section; submit from the main page.

Notes:

- Each text field is limited to **1000 characters** on the API; truncate risk → use copy-paste instead.
- Non-text fields (images, attachments) cannot be filled via the API.

### Group robot

“Send to group” uses a custom group robot webhook. That posts a group message, not a personal work report.

## Data & privacy

Repos, passwords, DingTalk secrets, and daily drafts live under a local `data/` directory (gitignored). There is **no authentication**. Keep the process on localhost unless you fully trust the network.

Optional environment variables:

| Variable | Purpose |
|----------|---------|
| `RIZHAI_DATA_DIR` | Custom data directory |
| `RIZHAI_SVN_TRUST_CERT` | SVN cert trust failures (default `unknown-ca`; `none` to disable) |
| `RIZHAI_ALLOW_SVN_FILE_URL=1` | Allow `file:` repo URLs (blocked by default outside development) |

## Scripts

| Command | Description |
|---------|-------------|
| `start.cmd` / `./start.sh` | One-click install (if needed) + run |
| `npm run dev` | Dev server on `127.0.0.1:43123` |
| `npm run build` | Production build |
| `npm start` | Serve build on localhost |
| `npm run start:lan` | Serve build on `0.0.0.0` |
| `npm test` | Unit tests |
| `npm run lint` | ESLint |

## Stack

Next.js (App Router), React, Tailwind CSS. SVN is invoked as a local CLI; nothing is hosted for you.

## License

MIT — see [LICENSE](LICENSE).
