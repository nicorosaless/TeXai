// Type definitions for Electron APIs exposed via preload
export interface ElectronAPI {
    openFile: () => Promise<{
        success: boolean;
        path?: string;
        name?: string;
        content?: string;
        error?: string;
        canceled?: boolean;
    }>;

    openDirectory: () => Promise<{
        success: boolean;
        path?: string;
        files?: string[];
        error?: string;
        canceled?: boolean;
    }>;

    readFile: (filePath: string) => Promise<{
        success: boolean;
        content?: string;
        path?: string;
        name?: string;
        error?: string;
    }>;

    writeFile: (filePath: string, content: string) => Promise<{
        success: boolean;
        path?: string;
        error?: string;
    }>;

    createFile: (dirPath: string, fileName: string) => Promise<{
        success: boolean;
        path?: string;
        name?: string;
        error?: string;
    }>;

    readDirectoryFiles: (dirPath: string) => Promise<{
        success: boolean;
        files?: Array<{
            name: string;
            path: string;
            modified: Date;
        }>;
        error?: string;
    }>;

    isElectron: boolean;
    platform: string;
}

// Declare global window interface
declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

// Check if running in Electron
export const isElectron = (): boolean => {
    return typeof window !== 'undefined' && window.electronAPI?.isElectron === true;
};

// Export the API (will be undefined if not in Electron)
export const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;

// Helper functions with fallbacks
export const openFile = async () => {
    if (!isElectron() || !electronAPI) {
        throw new Error('File operations are only available in Electron');
    }
    return electronAPI.openFile();
};

export const openDirectory = async () => {
    if (!isElectron() || !electronAPI) {
        throw new Error('Directory operations are only available in Electron');
    }
    return electronAPI.openDirectory();
};

export const readFile = async (filePath: string) => {
    if (!isElectron() || !electronAPI) {
        throw new Error('File operations are only available in Electron');
    }
    return electronAPI.readFile(filePath);
};

export const writeFile = async (filePath: string, content: string) => {
    if (!isElectron() || !electronAPI) {
        throw new Error('File operations are only available in Electron');
    }
    return electronAPI.writeFile(filePath, content);
};

export const createFile = async (dirPath: string, fileName: string) => {
    if (!isElectron() || !electronAPI) {
        throw new Error('File operations are only available in Electron');
    }
    return electronAPI.createFile(dirPath, fileName);
};

export const readDirectoryFiles = async (dirPath: string) => {
    if (!isElectron() || !electronAPI) {
        throw new Error('Directory operations are only available in Electron');
    }
    return electronAPI.readDirectoryFiles(dirPath);
};
