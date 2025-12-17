const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // File operations
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
    createFile: (dirPath, fileName) => ipcRenderer.invoke('file:create', dirPath, fileName),
    readDirectoryFiles: (dirPath) => ipcRenderer.invoke('directory:readFiles', dirPath),

    // Image operations
    saveImage: (projectDir, fileName, base64Data) => ipcRenderer.invoke('image:save', projectDir, fileName, base64Data),
    listImages: (projectDir) => ipcRenderer.invoke('image:list', projectDir),
    deleteImage: (projectDir, fileName) => ipcRenderer.invoke('image:delete', projectDir, fileName),

    // Check if running in Electron
    isElectron: true,

    // Platform info
    platform: process.platform
});
