import { Folder, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as electronApi from "@/services/electronApi";

interface WelcomeScreenProps {
    onWorkspaceSelected: (workspacePath: string) => void;
    onFileSelected: (filePath: string, fileName: string, content: string) => void;
}

export function WelcomeScreen({
    onWorkspaceSelected,
    onFileSelected,
}: WelcomeScreenProps) {
    const handleOpenFolder = async () => {
        try {
            const result = await electronApi.openDirectory();
            if (result.success && result.path) {
                // Check if there are .tex files in the folder
                const filesResult = await electronApi.readDirectoryFiles(result.path);

                if (filesResult.success && filesResult.files && filesResult.files.length > 0) {
                    // Open the first .tex file found
                    const firstFile = filesResult.files[0];
                    const fileContent = await electronApi.readFile(firstFile.path);

                    if (fileContent.success && fileContent.content) {
                        onFileSelected(firstFile.path, firstFile.name, fileContent.content);
                    } else {
                        onWorkspaceSelected(result.path);
                    }
                } else {
                    // No .tex files, just open workspace (will show default content)
                    onWorkspaceSelected(result.path);
                }
            }
        } catch (error) {
            console.error("Error opening folder:", error);
        }
    };

    const handleCreateNewFile = async () => {
        try {
            // First, ask user to select a folder
            const dirResult = await electronApi.openDirectory();
            if (!dirResult.success || !dirResult.path) return;

            // Ask for filename
            const fileName = window.prompt(
                "Enter the name for your new .tex file:",
                "document.tex"
            );

            if (!fileName) return;

            // Ensure it has .tex extension
            const fullFileName = fileName.endsWith('.tex') ? fileName : `${fileName}.tex`;

            // Create the file
            const createResult = await electronApi.createFile(dirResult.path, fullFileName);

            if (createResult.success && createResult.path && createResult.name) {
                // Open the newly created file with default content
                const defaultContent = `\\documentclass{article}
\\usepackage[utf8]{inputenc}

\\title{${fullFileName.replace('.tex', '')}}
\\author{}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

Your content here.

\\end{document}`;

                // Write default content
                await electronApi.writeFile(createResult.path, defaultContent);

                // Open the file
                onFileSelected(createResult.path, createResult.name, defaultContent);
            }
        } catch (error) {
            console.error("Error creating file:", error);
        }
    };

    return (
        <div className="h-screen flex items-center justify-center bg-background">
            <div className="max-w-md w-full p-8 space-y-8">
                {/* Logo/Title */}
                <div className="text-center space-y-3">
                    <div className="flex items-center justify-center">
                        <svg
                            className="h-16 w-16 text-primary"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M4 7V4h16v3" />
                            <path d="M9 20h6" />
                            <path d="M12 4v16" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold">TeXai</h1>
                    <p className="text-muted-foreground">
                        AI-powered LaTeX editor for creating beautiful documents
                    </p>
                </div>

                {/* Action Cards */}
                <div className="space-y-4">
                    {/* Open Folder */}
                    <button
                        onClick={handleOpenFolder}
                        className="w-full p-6 bg-card border border-border rounded-lg hover:bg-secondary transition-colors text-left group"
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                <Folder className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-foreground mb-1">
                                    Open Folder
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Open a folder containing .tex files to start working on your project
                                </p>
                            </div>
                        </div>
                    </button>

                    {/* Create New File */}
                    <button
                        onClick={handleCreateNewFile}
                        className="w-full p-6 bg-card border border-border rounded-lg hover:bg-secondary transition-colors text-left group"
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                <FileText className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-foreground mb-1">
                                    Create New File
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Create a new .tex file in a folder of your choice
                                </p>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Footer */}
                <div className="text-center pt-4">
                    <p className="text-xs text-muted-foreground">
                        Start by selecting a folder or file to begin editing
                    </p>
                </div>
            </div>
        </div>
    );
}
