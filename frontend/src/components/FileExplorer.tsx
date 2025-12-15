import { useState, useEffect } from "react";
import { Folder, FileText, X, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as electronApi from "@/services/electronApi";

interface FileItem {
    name: string;
    path: string;
    modified: Date;
}

interface FileExplorerProps {
    onFileSelect: (filePath: string) => void;
    currentFile?: string;
    initialWorkspace?: string;
}

export function FileExplorer({ onFileSelect, currentFile, initialWorkspace }: FileExplorerProps) {
    const [workspace, setWorkspace] = useState<string | null>(initialWorkspace || null);
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Load files when component mounts if initialWorkspace is provided
    useEffect(() => {
        if (initialWorkspace) {
            loadFiles(initialWorkspace);
        }
    }, [initialWorkspace]);

    const handleOpenWorkspace = async () => {
        try {
            const result = await electronApi.openDirectory();
            if (result.success && result.path) {
                setWorkspace(result.path);
                loadFiles(result.path);
            }
        } catch (error) {
            console.error("Error opening workspace:", error);
        }
    };

    const loadFiles = async (dirPath: string) => {
        setIsLoading(true);
        try {
            const result = await electronApi.readDirectoryFiles(dirPath);
            if (result.success && result.files) {
                setFiles(result.files);
            }
        } catch (error) {
            console.error("Error loading files:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseWorkspace = () => {
        setWorkspace(null);
        setFiles([]);
    };

    return (
        <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
            {/* Header */}
            <div className="h-12 border-b border-sidebar-border flex items-center justify-between pl-20 pr-3">
                <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Explorer</span>
                </div>
            </div>

            {/* Content */}
            {workspace ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Workspace header */}
                    <div className="px-3 py-2 border-b border-sidebar-border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <Folder className="h-4 w-4 text-primary flex-shrink-0" />
                                <span className="text-xs text-muted-foreground truncate" title={workspace}>
                                    {workspace.split('/').pop()}
                                </span>
                            </div>
                            <Button
                                variant="icon"
                                size="icon"
                                onClick={handleCloseWorkspace}
                                className="h-6 w-6 flex-shrink-0"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    {/* Files list */}
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                            {isLoading ? (
                                <div className="text-xs text-muted-foreground text-center py-4">
                                    Loading files...
                                </div>
                            ) : files.length > 0 ? (
                                files.map((file) => (
                                    <button
                                        key={file.path}
                                        onClick={() => onFileSelect(file.path)}
                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary transition-colors text-left ${currentFile === file.path ? "bg-secondary" : ""
                                            }`}
                                    >
                                        <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                        <span className="text-xs text-foreground truncate">
                                            {file.name}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="text-xs text-muted-foreground text-center py-4">
                                    No .tex files found
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center space-y-3">
                        <Folder className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenWorkspace}
                            className="text-xs"
                        >
                            Open Folder
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Select a folder with .tex files
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
