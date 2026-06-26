# OdooGit 🚀

OdooGit is a simple desktop Git client designed specifically for Odoo developers to manage git repositories, control databases, and easily run, test, and upgrade Odoo servers in one app.

---

## Key Features

* **Streamlined Git Workflows**: Navigate development across multiple Odoo repositories (Community, Enterprise, Themes) without leaving the app. You can stage changes, review diffs, manage branches, and perform interactive rebases or cherry-picks. The integrated search allows you to grep for terms across your active working tree or specific commit revisions.
* **Smart Database Management**: Control your PostgreSQL database environments without manual terminal scripting. You can duplicate template databases, drop obsolete setups, or queue new databases to initialize automatically on startup. You can also link specific Git branches to designated databases so the correct environment loads automatically when you switch branches.
* **Unified Odoo Server Controls**: Run, upgrade, or test your Odoo instances from a single console. The application manages Python virtual environments (`venvs`) and makes it simple to specify addons, custom arguments, and modules to update or install. Monitor live output via the built-in console, or launch the server in an external window when needed. The app automatically frees up target ports before startup and cleans up running server processes on exit.
* **Developer Conveniences**: Features integrated helpers to manage GitHub authentication tokens, verify user credentials, and automatically update configurations to keep your local environment synchronized.

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
