const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

// Start Python backend server
function startBackend() {
  const backendPath = path.join(__dirname, 'backend');
  const pythonScript = path.join(backendPath, 'main.py');
  const venvPython = path.join(backendPath, 'venv', 'bin', 'python3');

  // Check if venv exists, otherwise use system python
  const fs = require('fs');
  const pythonPath = fs.existsSync(venvPython) ? venvPython : 'python3';

  console.log('Starting backend server with:', pythonPath);
  backendProcess = spawn(pythonPath, [pythonScript], {
    cwd: backendPath,
    env: { ...process.env }
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0a0a0a'
  });

  // Remove menu bar
  Menu.setApplicationMenu(null);

  // Load the app
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// File System IPC Handlers
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'LaTeX Files', extensions: ['tex'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return {
        success: true,
        path: filePath,
        name: path.basename(filePath),
        content
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  return { success: false, canceled: true };
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const dirPath = result.filePaths[0];
    try {
      const files = await fs.readdir(dirPath);
      const texFiles = files.filter(file => file.endsWith('.tex'));

      return {
        success: true,
        path: dirPath,
        files: texFiles
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  return { success: false, canceled: true };
});

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      success: true,
      content,
      path: filePath,
      name: path.basename(filePath)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('file:write', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return {
      success: true,
      path: filePath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('file:create', async (event, dirPath, fileName) => {
  try {
    const filePath = path.join(dirPath, fileName);
    await fs.writeFile(filePath, '', 'utf-8');
    return {
      success: true,
      path: filePath,
      name: fileName
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('directory:readFiles', async (event, dirPath) => {
  try {
    const files = await fs.readdir(dirPath);
    const texFiles = files.filter(file => file.endsWith('.tex'));

    const fileDetails = await Promise.all(
      texFiles.map(async (file) => {
        const fullPath = path.join(dirPath, file);
        const stats = await fs.stat(fullPath);
        return {
          name: file,
          path: fullPath,
          modified: stats.mtime
        };
      })
    );

    return {
      success: true,
      files: fileDetails
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// App lifecycle
app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
