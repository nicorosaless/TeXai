import { useState, useEffect } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { LatexEditor } from "@/components/LatexEditor";
import { LatexPreview } from "@/components/LatexPreview";
import { FileTabs, type OpenFile } from "@/components/FileTabs";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
} from "@/components/ui/resizable";
import * as electronApi from "@/services/electronApi";
import { computeDiff, getDiffSummary } from "@/lib/diffUtils";

const defaultLatex = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{Introduction to Machine Learning}
\\author{Maria Garcia}
\\date{December 2024}

\\begin{document}

\\maketitle

\\begin{abstract}
This document presents an introduction to the fundamental concepts of machine learning, including the main types of algorithms and their applications in modern industry.
\\end{abstract}

\\section{Introduction}

Machine learning is a branch of artificial intelligence that enables systems to learn and improve automatically from experience without being explicitly programmed.

Machine learning algorithms use training data to create mathematical models that can make predictions or decisions.

\\section{Types of Learning}

There are three main types of machine learning:

\\begin{itemize}
\\item \\textbf{Supervised learning}: The model learns from labeled data.
\\item \\textbf{Unsupervised learning}: The model finds patterns in unlabeled data.
\\item \\textbf{Reinforcement learning}: The model learns through trial and error.
\\end{itemize}

\\subsection{Loss Functions}

The most common loss function is the mean squared error:

\\begin{equation}
MSE = \\frac{1}{n} \\sum_{i=1}^{n} (y_i - \\hat{y}_i)^2
\\end{equation}

\\section{Conclusions}

Machine learning continues to revolutionize multiple industries, from medicine to finance.

\\end{document}`;

const Index = () => {
    const [workspace, setWorkspace] = useState<string | null>(null);
    const [latexContent, setLatexContent] = useState(defaultLatex);
    const [suggestedContent, setSuggestedContent] = useState<string | null>(null);
    const [isChatCollapsed, setIsChatCollapsed] = useState(false);
    const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
    const [currentFilePath, setCurrentFilePath] = useState<string | undefined>();
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const isElectron = electronApi.isElectron();

    // Import diff utils dynamically to avoid circular dependencies if any (though here it is fine)
    // Actually we need to import them at top level. 
    // Assuming imports are added via separate tool call or I will add them here if possible? 
    // replace_file_content requires contiguous block. I cannot easily add top level imports AND modify component body in one go if they are far apart.
    // I will use multi_replace for this file next time or split this.
    // However, I can just modify the imports in a separate call.
    // Let's modify the body first.

    // Compute diff if suggestion exists
    const diff = suggestedContent ? computeDiff(latexContent, suggestedContent) : undefined;

    // Auto-clear suggestion if diff is empty (everything accepted/rejected)
    useEffect(() => {
        if (suggestedContent && diff && diff.length > 0) {
            const summary = getDiffSummary(diff);
            if (summary.added === 0 && summary.removed === 0) {
                setSuggestedContent(null);
                toast({
                    title: "All changes resolved",
                    description: "Diff view closed.",
                });
            }
        }
    }, [diff, suggestedContent]);

    // Auto-save when content changes (debounced)
    useEffect(() => {
        if (!currentFilePath || !isElectron) return;

        const timeoutId = setTimeout(() => {
            saveCurrentFile();
        }, 2000); // Save after 2 seconds of no changes

        return () => clearTimeout(timeoutId);
    }, [latexContent, currentFilePath, isElectron]);

    const saveCurrentFile = async () => {
        if (!currentFilePath || isSaving || !isElectron) return;

        setIsSaving(true);
        try {
            const result = await electronApi.writeFile(currentFilePath, latexContent);
            if (result.success) {
                // Mark file as not modified
                setOpenFiles(prev =>
                    prev.map(f =>
                        f.path === currentFilePath ? { ...f, modified: false } : f
                    )
                );
            } else {
                toast({
                    title: "Error saving file",
                    description: result.error,
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Error saving:", error);
            toast({
                title: "Error saving file",
                description: String(error),
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileSelect = async (filePath: string) => {
        // Check if file is already open
        const existingFile = openFiles.find(f => f.path === filePath);
        if (existingFile) {
            setCurrentFilePath(filePath);
            return;
        }

        // Load file from disk
        try {
            const result = await electronApi.readFile(filePath);
            if (result.success && result.content && result.name) {
                const newFile: OpenFile = {
                    path: filePath,
                    name: result.name,
                    modified: false,
                };
                setOpenFiles(prev => [...prev, newFile]);
                setCurrentFilePath(filePath);
                setLatexContent(result.content);
                setSuggestedContent(null); // Clear any pending diffs on file switch
            } else {
                toast({
                    title: "Error opening file",
                    description: result.error,
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Error opening file:", error);
            toast({
                title: "Error opening file",
                description: String(error),
                variant: "destructive",
            });
        }
    };

    const handleOpenFile = async () => {
        if (!isElectron) return;

        try {
            const result = await electronApi.openFile();
            if (result.success && result.path && result.content && result.name) {
                const newFile: OpenFile = {
                    path: result.path,
                    name: result.name,
                    modified: false,
                };
                setOpenFiles(prev => [...prev, newFile]);
                setCurrentFilePath(result.path);
                setLatexContent(result.content);
                setSuggestedContent(null);
            }
        } catch (error) {
            console.error("Error opening file:", error);
        }
    };

    const handleFileClose = (filePath: string) => {
        const fileToClose = openFiles.find(f => f.path === filePath);

        if (fileToClose?.modified) {
            const confirmed = window.confirm(
                `${fileToClose.name} has unsaved changes. Close anyway?`
            );
            if (!confirmed) return;
        }

        setOpenFiles(prev => prev.filter(f => f.path !== filePath));

        if (currentFilePath === filePath) {
            const remainingFiles = openFiles.filter(f => f.path !== filePath);
            if (remainingFiles.length > 0) {
                handleFileSelect(remainingFiles[0].path);
            } else {
                setCurrentFilePath(undefined);
                setLatexContent(defaultLatex);
                setSuggestedContent(null);
            }
        }
    };

    const handleApplyChange = (newContent: string) => {
        setLatexContent(newContent);
        setSuggestedContent(null); // Clear suggestion as it is fully applied
        markCurrentFileModified();
    };

    const handleSuggestion = (newContent: string | null) => {
        console.log("Index: handleSuggestion called", { newContentLength: newContent?.length });
        setSuggestedContent(newContent);
    };

    const handleDiffChange = (newSuggestion: string) => {
        console.log("Index: handleDiffChange called", { newSuggestionLength: newSuggestion.length });
        setSuggestedContent(newSuggestion);
    };

    const handleContentChange = (newContent: string) => {
        setLatexContent(newContent);
        markCurrentFileModified();
    };

    const markCurrentFileModified = () => {
        if (!currentFilePath) return;
        setOpenFiles(prev =>
            prev.map(f =>
                f.path === currentFilePath ? { ...f, modified: true } : f
            )
        );
    };
    // Show welcome screen if not in Electron
    if (!isElectron) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-4 p-8">
                    <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground" />
                    <h1 className="text-2xl font-bold">TeXai Desktop</h1>
                    <p className="text-muted-foreground max-w-md">
                        This application must be run as an Electron desktop app.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Run: <code className="bg-secondary px-2 py-1 rounded">npm run electron:dev</code>
                    </p>
                </div>
            </div>
        );
    }

    // Show welcome screen if no workspace selected
    if (!workspace) {
        return (
            <WelcomeScreen
                onWorkspaceSelected={(path) => {
                    setWorkspace(path);
                }}
                onFileSelected={(filePath, fileName, content) => {
                    // When a file is selected, use its directory as workspace
                    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
                    setWorkspace(dirPath);

                    // Open the file
                    const newFile: OpenFile = {
                        path: filePath,
                        name: fileName,
                        modified: false,
                    };
                    setOpenFiles([newFile]);
                    setCurrentFilePath(filePath);
                    setLatexContent(content);
                }}
            />
        );
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden">
            {/* File tabs */}
            <FileTabs
                files={openFiles}
                currentFile={currentFilePath}
                onFileSelect={handleFileSelect}
                onFileClose={handleFileClose}
            />

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {isChatCollapsed && (
                    <div className="w-12 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 shrink-0">
                        <button
                            onClick={() => setIsChatCollapsed(false)}
                            className="p-2 hover:bg-secondary rounded-md transition-colors"
                            title="Open Copilot"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect width="18" height="18" x="3" y="3" rx="2" />
                                <path d="M9 3v18" />
                            </svg>
                        </button>
                    </div>
                )}

                <ResizablePanelGroup direction="horizontal" className="h-full flex-1">
                    {/* Chat Panel */}
                    {!isChatCollapsed && (
                        <>
                            <ResizablePanel defaultSize={25} minSize={20} maxSize={40} order={1}>
                                <ChatPanel
                                    onApplyChange={handleApplyChange}
                                    onSuggestion={handleSuggestion}
                                    currentLatex={latexContent}
                                    isCollapsed={isChatCollapsed}
                                    onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)}
                                />
                            </ResizablePanel>
                            <ResizableHandle withHandle />
                        </>
                    )}

                    {/* Editor Panel */}
                    <ResizablePanel defaultSize={37} minSize={30} order={2}>
                        <LatexEditor
                            content={latexContent}
                            onChange={handleContentChange}
                            diff={diff}
                            onDiffChange={handleDiffChange}
                            fileName={openFiles.find(f => f.path === currentFilePath)?.name}
                            onOpenFile={handleOpenFile}
                        />
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Preview Panel */}
                    <ResizablePanel defaultSize={38} minSize={30} order={3}>
                        <LatexPreview content={latexContent} />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    );
};

export default Index;
