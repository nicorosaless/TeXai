import { useState, useEffect } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { LatexEditor } from "@/components/LatexEditor";
import { LatexPreview } from "@/components/LatexPreview";
import { apiService, type Document } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

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
  const [latexContent, setLatexContent] = useState(defaultLatex);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Load or create document on mount
  useEffect(() => {
    loadOrCreateDocument();
  }, []);

  // Auto-save when content changes (debounced)
  useEffect(() => {
    if (!currentDocument) return;
    
    const timeoutId = setTimeout(() => {
      saveDocument();
    }, 2000); // Save after 2 seconds of no changes

    return () => clearTimeout(timeoutId);
  }, [latexContent]);

  const loadOrCreateDocument = async () => {
    try {
      const docs = await apiService.listDocuments();
      if (docs.length > 0) {
        // Load the most recent document
        const doc = await apiService.getDocument(docs[0].id);
        setCurrentDocument(doc);
        setLatexContent(doc.content || defaultLatex);
      } else {
        // Create a new document
        const doc = await apiService.createDocument("Untitled Document", defaultLatex);
        setCurrentDocument(doc);
      }
    } catch (error) {
      console.error("Error loading document:", error);
      // Continue with default content if server is not available
    }
  };

  const saveDocument = async () => {
    if (!currentDocument || isSaving) return;
    
    setIsSaving(true);
    try {
      await apiService.updateDocument(currentDocument.id, latexContent);
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyChange = (newContent: string) => {
    setLatexContent(newContent);
  };

  const handleContentChange = (newContent: string) => {
    setLatexContent(newContent);
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Chat Panel */}
        {!isChatCollapsed ? (
          <>
            <ResizablePanel defaultSize={22} minSize={18} maxSize={35}>
              <ChatPanel
                onApplyChange={handleApplyChange}
                currentLatex={latexContent}
                isCollapsed={isChatCollapsed}
                onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        ) : (
          <div className="w-12 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4">
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

        {/* Editor Panel */}
        <ResizablePanel defaultSize={39} minSize={25}>
          <LatexEditor content={latexContent} onChange={handleContentChange} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Preview Panel */}
        <ResizablePanel defaultSize={39} minSize={25}>
          <LatexPreview content={latexContent} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Index;
