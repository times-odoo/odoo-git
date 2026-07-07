# OdooGit

OdooGit is a specialized desktop Git client and environment management utility tailored specifically for Odoo R&D developers. It unifies multi-repository version control, PostgreSQL database configuration, and Odoo server execution within a single, highly responsive desktop interface.

---

## Table of Contents
1. Key Features
2. Architecture and Tech Stack
3. Installation and Setup
4. Application Tour
5. Configuration and Customization
6. Development Guide

---

## Key Features

* **Multi-Repository Git Workflows**: Seamlessly manage git lifecycles across multiple Odoo directories (Community, Enterprise, and custom addons). Execute standard staging, diff inspection, committing, branch management, cherry-picking, stash manipulations, remote synchronization, and advanced grep searches across files and commit history.
* **Integrated Database Administration**: Manage local PostgreSQL databases directly from the GUI. Create, duplicate, and drop database environments, and designate templates. Bind specific git branches to target databases so your developer workspace updates its database connection automatically when checking out branches.
* **Unified Odoo Server Panel**: Configure, execute, update, and test Odoo server processes. Manage Python virtual environments (venvs), addons paths, custom start arguments, module installation (`-i`), module upgrades (`-u`), and unit testing configurations.
* **Interactive Logs Terminal**: View real-time server output inside a rich console formatting stream. Features proper line-wrapping, ANSI syntax highlighting, interactive `stdin` command injection supporting debuggers (e.g., `pdb` or `ipdb`), scrollback command history via arrow keys, and an inline send button.
* **Flexible UI Controls**: Adjust interface layout using a draggable pane splitter with built-in boundaries, or toggle the terminal panel into full-screen mode to focus on debugging logs.

---

## Architecture and Tech Stack

* **Host Runtime**: Electron (v33), Node.js (v20)
* **Frontend Interface**: React (v18), TypeScript, Tailwind CSS
* **Build System**: Vite (v6), TypeScript Compiler (`tsc`)
* **Local Storage**: `electron-store` for persisting repositories, branch-to-database mappings, templates, virtual environments, and configuration profiles.
* **Git Bridge**: Native node child process spawners invoking local shell processes for git commands, optimizing performance and compatibility.

---

## Installation and Setup

### Prerequisites
Before running or building OdooGit, ensure you have the following installed:
* **Node.js** (v18 or higher)
* **npm** (v9 or higher)
* **Git** command-line tools
* **PostgreSQL** server running locally
* **Python** (along with virtualenv tools if managing multiple versions)

### Installation Options

#### 1. Debian Package (Debian / Ubuntu / Linux Mint)
For quick installation on Debian-based systems, download the packaged release `.deb` file and install it via `dpkg`:
```bash
sudo dpkg -i odoogit_1.0.0_amd64.deb
```

#### 2. Running from Source (Development Mode)
To clone and run the application in hot-reloading development mode:
```bash
# Clone the repository
git clone https://github.com/times-odoo/odoo-git.git
cd odoo-git

# Install dependencies
npm install

# Run the development environment
npm run dev
```

#### 3. Building and Packaging
To compile the TypeScript bundle and generate distribution binaries:
```bash
# Compile and build the main and renderer bundles
npm run build

# Package the application as a standalone Linux binary (.deb, .AppImage)
npm run dist
```

---

## Application Tour

### 1. Repository Rail
Located on the far-left edge of the screen, the Repository Rail provides top-level navigation:
* **Active Repository Selection**: Quick-switch between added Odoo directories (e.g., Community or Enterprise repos).
* **Odoo Panel Toggle**: Switch to the dedicated Odoo Integration panel.
* **Settings Toggle**: Access application configuration settings.

### 2. Navigation Sidebar
When a repository is selected, the sidebar provides access to Git operations:
* **Current Branch**: Displays active branch, upstream tracking branch, ahead/behind counters, and working directory state (clean/dirty).
* **Fetch All**: Run fetch against all configured remotes for the active repository.
* **Feature Views**: Click to toggle between Branches, Diff, Git Add, Commit, Log, Push, Pull, Stash, Cherry, Remotes, and Search.

### 3. Git Operations Panels
* **Branches Panel**: Check out local or remote branches. Offers search filtering, checkout indicator animations, and database branch-mapping capabilities.
* **Diff Viewer**: Displays a list of modified files alongside side-by-side or unified diff visualizations highlighting added and removed lines.
* **Git Add**: Interactively stage or unstage files or specific line hunks.
* **Commit Composer**: Write commit messages (with optional automated prefixes matching active issue tags or Odoo module formats) and sign commits. Supports amending the last commit.
* **Log Panel**: Visualize the repository's commit tree history. Double-click commits to view their changes.
* **Push/Pull Panels**: Synchronize with remote branches. Supports standard push, force-with-lease, and branch tracking setup.
* **Stash Panel**: Save local modifications without committing, and view, apply, pop, or drop existing stashes.
* **Cherry-pick**: Cherry-pick specific commits onto your active branch.
* **Remotes**: Add, remove, and rename remote endpoints.
* **Search / Grep**: Perform high-performance searches across your repository using regular expressions or plain-text queries.

### 4. Odoo & PostgreSQL Integration Panel
Accessible via the Odoo icon in the Repository Rail, this interface hides the sidebar to utilize the full width of the screen. It is split into two panels:
* **Right Side: Odoo Server Controls**:
  * **Configuration Presets**: Save and load custom server configurations (e.g. Odoo 16.0, 19.0 Default Runs).
  * **Virtual Environment**: Select or type absolute paths to target Python `venv` environments.
  * **Environment Fields**: Configure PostgreSQL parameters (target database, template source), HTTP ports, HTTP interface IP, and addons paths.
  * **Interactive Module Actions**: Fast-check buttons to toggle `--dev=all`, `--without-demo`, or automatic initialization modules.
* **Left Side: Server Logs Terminal**:
  * **Live Stream**: Streams formatted Odoo server output in real-time. Automatically parses ANSI colors.
  * **Stdin Input Drawer**: Interactive prompt bar allowing developers to enter commands directly into active processes. Highly useful when Odoo is stopped on a `pdb` or `ipdb` breakpoint.
  * **Command History**: Retrieve previous commands inside the stdin bar using the Up and Down arrow keys.
  * **Split Slider**: Click and drag the vertical splitter bar to resize the console width (constrained between 30% and 70% to maintain readability).
  * **Full Screen Mode**: Maximize the terminal console to fill the entire panel when analyzing log streams, and restore the custom split layout when finished.

---

## Configuration and Customization

OdooGit saves preferences locally using JSON. Below are key configuration store definitions:
* `trigram`: Active developer's short code or initials.
* `repos`: Array of absolute paths and names of target repositories.
* `branchDbMap`: Key-value registry mapping repository paths and branches to designated databases.
* `odooTemplates`: Flags identifying PostgreSQL databases to be used as templates.
* `odooVenvs`: Array of path strings referencing available virtual environments.
* `pendingDbs`: Queue of new database environments marked for auto-creation on the next server startup.

---

## Development Guide

Contributions are welcome! Please follow these guidelines:
* Maintain clean TypeScript formatting.
* Ensure all frontend changes compile successfully with `npm run build` prior to submitting changes.
* Avoid using inline Tailwind styles for custom components where global theme styles are already defined in `globals.css`.
