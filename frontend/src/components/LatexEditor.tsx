import { useRef, useState, useMemo, useEffect } from "react";
import { Copy, Download, RotateCcw, Image, Upload, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DiffLine } from "@/lib/diffUtils";
import * as electronApi from "@/services/electronApi";

interface UploadedImage {
  id: string;
  name: string;
  url: string; // For display (file:// URL or data URL)
  latexRef: string;
  filePath?: string; // Actual path on disk
}

interface LatexEditorProps {
  content: string;
  onChange: (content: string) => void;
  diff?: DiffLine[];
  onDiffChange?: (newContent: string) => void; // Used for "Reject" (updating suggestion)
  fileName?: string;
  onOpenFile?: () => void;
  projectDir?: string; // Directory of the current project for image storage
}

function highlightLatex(code: string): JSX.Element[] {
  const textColor = 'hsl(40, 6%, 90%)';
  const lineNumberColor = 'hsl(40, 4%, 50%)';
  const commentColor = 'hsl(40, 4%, 50%)';

  if (!code || code.trim() === "") {
    return [
      <div key={0} className="flex" style={{ color: textColor }}>
        <span className="editor-line-number" style={{ color: lineNumberColor }}>1</span>
        <span style={{ color: textColor }}>&nbsp;</span>
      </div>
    ];
  }

  const lines = code.split("\n");

  return lines.map((line, index) => {
    if (line.trim().startsWith("%")) {
      return (
        <div key={index} className="flex" style={{ color: textColor }}>
          <span className="editor-line-number" style={{ color: lineNumberColor }}>{index + 1}</span>
          <span style={{ color: commentColor, opacity: 0.7, fontStyle: 'italic' }}>
            {line || "\u00A0"}
          </span>
        </div>
      );
    }

    let highlighted = line || "";
    const originalLine = line;
    highlighted = highlighted.replace(
      /(\\[a-zA-Z]+)/g,
      '<span style="color: hsl(200, 70%, 60%)">$1</span>'
    );
    highlighted = highlighted.replace(
      /([{}[\]])/g,
      '<span style="color: hsl(30, 70%, 60%)">$1</span>'
    );

    // If no highlighting occurred, ensure the line is still visible
    if (highlighted === originalLine && originalLine === "") {
      highlighted = "\u00A0"; // Non-breaking space for empty lines
    }

    return (
      <div key={index} className="flex leading-6" style={{ color: textColor }}>
        <span className="editor-line-number shrink-0" style={{ color: lineNumberColor, width: '4rem', paddingRight: '1rem' }}>{index + 1}</span>
        <span
          className="flex-1"
          style={{ color: textColor, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          dangerouslySetInnerHTML={{ __html: highlighted || "\u00A0" }}
        />
      </div>
    );
  });
}

export function LatexEditor({ content, onChange, diff, onDiffChange, fileName, onOpenFile, projectDir }: LatexEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [showImages, setShowImages] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  // Load existing images from project directory
  useEffect(() => {
    const loadExistingImages = async () => {
      if (!projectDir || !electronApi.isElectron()) return;

      setIsLoadingImages(true);
      try {
        const result = await electronApi.listImages(projectDir);
        if (result.success && result.images) {
          const loadedImages: UploadedImage[] = result.images.map(img => ({
            id: img.name,
            name: img.name,
            url: `file://${img.path}`,
            latexRef: `\\includegraphics[width=0.8\\textwidth]{images/${img.name}}`,
            filePath: img.path
          }));
          setImages(loadedImages);
        }
      } catch (error) {
        console.error('Error loading images:', error);
      } finally {
        setIsLoadingImages(false);
      }
    };

    loadExistingImages();
  }, [projectDir]);

  // Helper to construct content from diff, optionally accepting/rejecting a specific chunk
  const applyChunkAction = (action: 'keep' | 'reject', chunkIndex: number, chunks: DiffChunk[]) => {
    let newContentLines: string[] = [];
    let newSuggestionLines: string[] = [];

    // Reconstruct the files based on the action
    // To "Keep": The chunk's modified lines become part of 'content', and also part of 'suggestion' (so they are no longer diffs)
    // To "Reject": The chunk's original lines become part of 'content' (unchanged), AND part of 'suggestion' (so they are no longer diffs)

    // Actually, simpler:
    // We have 'content' (original) and 'suggestion' (modified).
    // If we Keep: Update 'content' to match 'suggestion' for this chunk. 'suggestion' stays same.
    // If we Reject: Update 'suggestion' to match 'content' for this chunk. 'content' stays same.

    // So we need to reconstruct the full strings from the diff list
    // But working with the raw diff lines is easier.

    if (!diff) return;

    let currentChunkIdx = -1;
    let lastWasDiff = false;

    // We need to iterate over the *original diff array* to reconstruct strings
    // But we need to identify which lines belong to 'chunkIndex'

    // Let's first build the chunks map again to know line ranges
    // This is a bit inefficient but safe

    let buildContent = "";
    let buildSuggestion = "";

    // Flatten chunks back to lines
    let lineIdx = 0;

    for (const chunk of chunks) {
      const isTargetChunk = chunk.id === chunkIndex;

      if (chunk.type === 'unchanged') {
        const text = chunk.lines.map(l => l.content).join('\n') + (chunk === chunks[chunks.length - 1] ? "" : "\n");
        // Add newline only if not last chunk? 
        // Better: join all lines and then join chunks?
        // The lines themselves don't have newlines.

        // Actually, simpler loop over all chunks.
        for (const line of chunk.lines) {
          buildContent += line.content + "\n";
          buildSuggestion += line.content + "\n";
        }
      } else {
        // It's a change chunk
        if (isTargetChunk) {
          if (action === 'keep') {
            // Keep: set Content to Modified version. Suggestion stays Modified.
            // Modified version is the "added" lines.
            const addedLines = chunk.lines.filter(l => l.type === 'added');
            for (const line of addedLines) {
              buildContent += line.content + "\n";
              buildSuggestion += line.content + "\n";
            }
          } else {
            // Reject: set Suggestion to Original version. Content stays Original.
            // Original version is the "removed" lines.
            const removedLines = chunk.lines.filter(l => l.type === 'removed');
            for (const line of removedLines) {
              buildContent += line.content + "\n";
              buildSuggestion += line.content + "\n";
            }
          }
        } else {
          // Not target chunk: Maintain status quo
          // Content gets 'removed' lines (original state)
          // Suggestion gets 'added' lines (modified state)

          const removedLines = chunk.lines.filter(l => l.type === 'removed');
          for (const line of removedLines) {
            buildContent += line.content + "\n";
          }

          const addedLines = chunk.lines.filter(l => l.type === 'added');
          for (const line of addedLines) {
            buildSuggestion += line.content + "\n";
          }
        }
      }
    }

    // Trim last newline
    buildContent = buildContent.slice(0, -1);
    buildSuggestion = buildSuggestion.slice(0, -1);

    if (action === 'keep') {
      onChange(buildContent);
    } else {
      onDiffChange?.(buildSuggestion);
    }
  };


  interface DiffChunk {
    id: number;
    type: 'unchanged' | 'change';
    lines: DiffLine[];
  }

  const chunks = useMemo(() => {
    if (!diff) return [];

    const result: DiffChunk[] = [];
    let currentLines: DiffLine[] = [];
    let currentType: 'unchanged' | 'change' | null = null;
    let chunkId = 0;

    diff.forEach((line) => {
      const lineType = line.type === 'unchanged' ? 'unchanged' : 'change';

      if (currentType === null) {
        currentType = lineType;
      }

      if (lineType !== currentType) {
        result.push({ id: chunkId++, type: currentType, lines: currentLines });
        currentLines = [];
        currentType = lineType;
      }
      currentLines.push(line);
    });

    if (currentLines.length > 0 && currentType) {
      result.push({ id: chunkId++, type: currentType, lines: currentLines });
    }

    console.log("LatexEditor: Computed chunks", { count: result.length, diffLen: diff.length });
    return result;
  }, [diff]);


  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "LaTeX code copied to clipboard",
    });
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.tex";
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded",
      description: ".tex file downloaded",
    });
  };

  const syncScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Error",
          description: "Only image files are allowed",
          variant: "destructive",
        });
        continue;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

        // If we have a project directory, save to disk
        if (projectDir && electronApi.isElectron()) {
          try {
            const result = await electronApi.saveImage(projectDir, safeName, base64Data);
            if (result.success && result.path) {
              const newImage: UploadedImage = {
                id,
                name: safeName,
                url: `file://${result.path}`,
                latexRef: `\\includegraphics[width=0.8\\textwidth]{images/${safeName}}`,
                filePath: result.path
              };
              setImages((prev) => [...prev, newImage]);
              toast({
                title: "Image saved",
                description: `${safeName} saved to project`,
              });
            } else {
              toast({
                title: "Error saving image",
                description: result.error || "Unknown error",
                variant: "destructive",
              });
            }
          } catch (error) {
            console.error('Error saving image:', error);
            toast({
              title: "Error saving image",
              description: String(error),
              variant: "destructive",
            });
          }
        } else {
          // Fallback: just keep in memory (for non-Electron or no project)
          const newImage: UploadedImage = {
            id,
            name: file.name,
            url: base64Data,
            latexRef: `\\includegraphics[width=0.8\\textwidth]{${safeName}}`,
          };
          setImages((prev) => [...prev, newImage]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const copyLatexRef = (latexRef: string) => {
    navigator.clipboard.writeText(latexRef);
    toast({
      title: "Copied",
      description: "LaTeX reference copied to clipboard",
    });
  };

  const insertImage = (latexRef: string) => {
    const insertPosition = content.lastIndexOf("\\end{document}");
    if (insertPosition !== -1) {
      const newContent =
        content.slice(0, insertPosition) +
        `\n${latexRef}\n\n` +
        content.slice(insertPosition);
      onChange(newContent);
      setShowImages(false);
      toast({
        title: "Inserted",
        description: "Image reference added to document",
      });
    }
  };

  const deleteImage = async (id: string) => {
    const imageToDelete = images.find(img => img.id === id);

    if (imageToDelete && projectDir && electronApi.isElectron()) {
      try {
        const result = await electronApi.deleteImage(projectDir, imageToDelete.name);
        if (!result.success) {
          toast({
            title: "Error deleting image",
            description: result.error || "Unknown error",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error deleting image:', error);
      }
    }

    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-editor border-r border-border relative">
      <div className="h-12 border-b border-border flex items-center justify-between px-4 app-drag-region">
        <div className="flex items-center gap-3">
          {fileName && <span className="text-sm font-medium text-foreground">{fileName}</span>}
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-secondary rounded">
            LaTeX
          </span>
          <Button
            variant={showImages ? "secondary" : "icon"}
            size="icon"
            onClick={() => setShowImages(!showImages)}
            title="Toggle images"
            className="h-8 w-8 no-drag"
          >
            <Image className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1 no-drag">
          <Button variant="icon" size="icon" onClick={onOpenFile} title="Open File">
            <Upload className="h-4 w-4" />
          </Button>
          <Button variant="icon" size="icon" onClick={() => onChange(content)} title="Revert">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="icon" size="icon" onClick={handleCopy} title="Copy">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="icon" size="icon" onClick={handleDownload} title="Download">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showImages ? (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Image upload UI code ... */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Images</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Upload images to use in your LaTeX document. Click on an image to insert its reference.
              </p>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDragging
                ? "border-primary bg-primary/10"
                : "border-border hover:border-muted-foreground"
                }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-1">
                Drag and drop images here
              </p>
              <p className="text-xs text-muted-foreground">
                or click to select files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>

            {images.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">Uploaded images ({images.length})</p>
                <div className="grid grid-cols-2 gap-4">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="bg-card border border-border rounded-lg overflow-hidden group"
                    >
                      <div className="aspect-video relative">
                        <img
                          src={image.url}
                          alt={image.name}
                          className="w-full h-full object-cover"
                        />
                        <Button
                          variant="icon"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 bg-background/90 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteImage(image.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="text-xs text-foreground truncate">{image.name}</p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => copyLatexRef(image.latexRef)}
                          >
                            Copy ref
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => insertImage(image.latexRef)}
                          >
                            Insert
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {images.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No images uploaded yet</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden bg-background">
          {diff && diff.length > 0 ? (
            <div className="absolute inset-0 w-full h-full overflow-auto scrollbar-thin p-4 font-mono text-sm leading-6 z-20 bg-background text-foreground">
              {chunks.length === 0 ? (
                <div className="text-muted-foreground p-4">
                  Computing diff... (Chunks empty). Diff len: {diff.length}
                </div>
              ) : (
                chunks.map((chunk) => {
                  if (chunk.type === 'unchanged') {
                    return chunk.lines.map((line, idx) => (
                      <div key={`${chunk.id}-${idx}`} className="flex text-[hsl(40,6%,90%)] opacity-50">
                        <span className="w-8 shrink-0 text-right mr-4 text-[hsl(40,4%,50%)] select-none">
                          {line.oldLineNum}
                        </span>
                        <span className="flex-1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line.content || ' '}</span>
                      </div>
                    ));
                  } else {
                    return (
                      <div key={chunk.id} className="my-2 border border-border rounded-md overflow-hidden bg-black/20">
                        <div className="flex items-center justify-between p-1 bg-secondary/30 border-b border-border">
                          <span className="text-xs text-muted-foreground px-2">Proposed Change</span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs hover:bg-green-500/20 hover:text-green-400"
                              onClick={() => applyChunkAction('keep', chunk.id, chunks)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Keep
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs hover:bg-red-500/20 hover:text-red-400"
                              onClick={() => applyChunkAction('reject', chunk.id, chunks)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                        <div>
                          {chunk.lines.map((line, idx) => (
                            <div
                              key={idx}
                              className={`flex ${line.type === 'added'
                                ? 'bg-green-500/10 text-green-100'
                                : 'bg-red-500/10 text-red-300 line-through decoration-red-500/30'
                                }`}
                            >
                              <span className="w-8 shrink-0 text-right mr-4 select-none opacity-50">
                                {line.type === 'added' ? '+' : '-'}
                              </span>
                              <span className="flex-1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line.content || ' '}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                })
              )}
            </div>
          ) : (
            <>
              <div
                ref={highlightRef}
                className="absolute inset-0 pt-4 pr-4 pb-4 pl-0 font-mono text-sm leading-6 overflow-auto pointer-events-none scrollbar-thin z-0"
                aria-hidden="true"
                style={{
                  color: 'hsl(40, 6%, 90%)',
                  backgroundColor: 'hsl(43, 25%, 6%)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  boxSizing: 'border-box'
                }}
              >
                {highlightLatex(content)}
              </div>

              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => onChange(e.target.value)}
                onScroll={syncScroll}
                className="absolute inset-0 w-full h-full pt-4 pr-4 pb-4 pl-16 font-mono text-sm leading-6 bg-transparent text-transparent caret-foreground resize-none focus:outline-none scrollbar-thin z-10"
                spellCheck={false}
                style={{
                  caretColor: 'hsl(40, 6%, 90%)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  boxSizing: 'border-box'
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
