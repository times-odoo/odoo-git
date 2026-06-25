# OdooGit 🚀

OdooGit is a simple desktop Git client designed specifically for Odoo developers to manage git repositories, control databases, and easily run, test, and upgrade Odoo servers in one app.

---

## Key Features

### 1. 🌿 Advanced Git Version Control
* **Branch & Remote Management**: Easily fetch, pull, push, checkout, rename, or delete local and remote branches.
* **Smart Commits**: Write guidelines-compliant commit messages, amend the last commit (with or without message editing), and stage/unstage files easily.
* **Visual Diff Viewer**: Interactive, color-coded side-by-side diff viewer with support for staged vs. unstaged files and raw git diff arguments.
* **Stash Controller**: Save, list, view, apply, pop, or drop git stashes.
* **Cherry-Picking & Rebasing**: Full support for interactive git rebase (continue/abort) and cherry-picking commits.
* **Multi-Repo Switcher**: Seamlessly switch between multiple repositories (e.g. Odoo Community, Enterprise, Design, Themes).
* **Grep Panel**: Multi-revision search to grep for terms across working trees or specific commit versions.

### 2. 🗄️ PostgreSQL Database Orchestration
* **Virtual DB Creation**: Create databases without templates by registering them as pending names. This allows Odoo to automatically initialize them on launch (installing base modules and building the correct Odoo schema) rather than creating empty databases.
* **Template Duplication**: Instantly copy or clone existing PostgreSQL template databases.
* **Database Cleanup**: Seamlessly drop database environments, removing them from both the database manager and local stores.
* **Branch-to-DB Mapping**: Bind specific git branches to designated databases, making Odoo automatically load the correct database when you switch branches.

### 3. ⚙️ Odoo Server Integration
* **Multi-mode Execution**: Spin up Odoo servers in `run`, `upgrade`, or `test` mode.
* **Granular Options**: Customize addons paths, upgrade utility paths, run ports, interface options, test tags, and modules to install (`-i`) or update (`-u`).
* **Environment Control**: Manage python virtual environments (`venv`) and set venv paths dynamically.
* **Terminal Console**: Live Odoo logs console built into the UI, with support for opening the server in an external terminal window (`gnome-terminal`).
* **Auto Cleanup**: Keeps your system tidy by automatically closing the Odoo server process group when you shut down the Electron application.

### 4. 🧰 Extras
* **Grammar Verification**: Verify git commit messages or comments on the fly using a built-in grammar checker powered by the LanguageTool public API.
* **GitHub Integration**: Manage Personal Access Tokens (PATs), verify connections, and automatically sync credentials to your global `~/.git-credentials` helper.

---

## Tech Stack

* **Frontend**: React (v18), Tailwind CSS, TypeScript
* **Bundler & Build Tool**: Vite (v6)
* **Backend Runtime**: Electron (v33), Node.js
* **Data Persistence**: `electron-store` (for configuration, branch mapping, venv list, and pending databases)
* **Git Bridge**: Native child process bindings calling git CLI wrapper commands

---

## Installation & Setup

### Prerequisites
Make sure you have the following installed on your system:
* **Node.js** (v18+ recommended)
* **npm** (v9+ recommended)
* **PostgreSQL** (configured and running locally)
* **Git** CLI
* **Odoo** source code repository

### 1. Install Debian Package (Recommended)
To install the pre-packaged application version from the git packages, download the `.deb` release file and execute:
```bash
sudo dpkg -i odoogit_1.0.0_amd64.deb
```

### 2. Manual Development Setup
If you want to build or run from source, clone the repository and install dependencies:
```bash
git clone https://github.com/odoo/git_gui_odoo.git
cd git_gui_odoo
npm install
```

To run the developer server with hot reloading enabled for both the main process and the renderer:
```bash
npm run dev
```

To compile the TypeScript code and prepare the production packages:
```bash
# Build both frontend and backend
npm run build

# Package the application as a standalone Linux build (.deb / .AppImage)
npm run dist
```

---

## Project Structure

```
├── dist/                # Compiled main and preload files
├── src/
│   ├── main/            # Electron main process (IPC handlers, window creation, store config)
│   ├── preload/         # Context bridge mapping main API to renderer
│   ├── renderer/        # React frontend application (Components, hooks, assets)
│   └── types.d.ts       # Global TypeScript declaration files
├── package.json         # Scripts and package configuration
├── tsconfig.json        # Main TypeScript configuration
└── vite.config.ts       # Vite bundler configuration
```

---

## Configuration Store Keys
The application stores configuration locally in `electron-store` configurations:
* `trigram`: Developer initials/trigram.
* `repos`: Array of path-name bindings for Odoo development repositories.
* `branchDbMap`: Key-value registry mapping repositories and branches to target databases.
* `odooTemplates`: Mark specific databases as template databases.
* `odooVenvs`: List of paths to local Python virtual environments.
* `pendingDbs`: List of newly declared databases to be initialized upon running Odoo.
