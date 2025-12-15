import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface OpenFile {
    path: string;
    name: string;
    modified: boolean;
}

interface FileTabsProps {
    files: OpenFile[];
    currentFile?: string;
    onFileSelect: (filePath: string) => void;
    onFileClose: (filePath: string) => void;
}

export function FileTabs({
    files,
    currentFile,
    onFileSelect,
    onFileClose,
}: FileTabsProps) {
    if (files.length === 0) return null;

    return (
        <div className="h-10 bg-background border-b border-border flex items-center overflow-hidden pl-20 app-drag-region">
            <ScrollArea className="flex-1">
                <div className="flex items-center h-10">
                    {files.map((file) => (
                        <div
                            key={file.path}
                            className={`flex items-center gap-2 px-4 h-full border-r border-border cursor-pointer hover:bg-secondary/50 transition-colors ${currentFile === file.path
                                ? "bg-editor text-foreground"
                                : "bg-background text-muted-foreground"
                                }`}
                            onClick={() => onFileSelect(file.path)}
                        >
                            <span className="text-sm whitespace-nowrap">
                                {file.name}
                                {file.modified && <span className="ml-1">•</span>}
                            </span>
                            <Button
                                variant="icon"
                                size="icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onFileClose(file.path);
                                }}
                                className="h-5 w-5 opacity-0 hover:opacity-100 group-hover:opacity-100"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
