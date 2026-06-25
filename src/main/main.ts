import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers, cleanUpOdooServer } from './ipc-handlers';
import { getWindowBounds, setWindowBounds, getSettings, applyGitCredentials } from './store';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const bounds = getWindowBounds();

  mainWindow = new BrowserWindow({
    width: bounds?.width || 1400,
    height: bounds?.height || 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0F1117',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Development: load from Vite dev server
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load built files
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Save window bounds on resize/move
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      const [x, y] = mainWindow.getPosition();
      setWindowBounds({ width, height, x, y });
    }
  });

  mainWindow.on('move', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      const [x, y] = mainWindow.getPosition();
      setWindowBounds({ width, height, x, y });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();

  // Apply saved GitHub PAT to git-credentials on startup
  const settings = getSettings();
  if (settings.githubPat) {
    applyGitCredentials(settings.githubUsername || '', settings.githubPat);
  }

  createWindow();
});

app.on('before-quit', () => {
  cleanUpOdooServer();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
