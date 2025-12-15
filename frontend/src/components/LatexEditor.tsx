import { useRef, useState } from "react";
import { Copy, Download, RotateCcw, Image, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface UploadedImage {
  id: string;
  name: string;
  url: string;
  latexRef: string;
}

interface LatexEditorProps {
  content: string;
  onChange: (content: string) => void;
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
      <div key={index} className="flex" style={{ color: textColor }}>
        <span className="editor-line-number" style={{ color: lineNumberColor }}>{index + 1}</span>
        <span 
          style={{ color: textColor }}
          dangerouslySetInnerHTML={{ __html: highlighted || "\u00A0" }} 
        />
      </div>
    );
  });
}

export function LatexEditor({ content, onChange }: LatexEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const [showImages, setShowImages] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);

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

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Error",
          description: "Only image files are allowed",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const newImage: UploadedImage = {
          id,
          name: file.name,
          url: e.target?.result as string,
          latexRef: `\\includegraphics[width=0.8\\textwidth]{${safeName}}`,
        };
        setImages((prev) => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    });
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

  const deleteImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col bg-editor border-r border-border">
      <div className="h-12 border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">document.tex</span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-secondary rounded">
            LaTeX
          </span>
          <Button
            variant={showImages ? "secondary" : "icon"}
            size="icon"
            onClick={() => setShowImages(!showImages)}
            title="Toggle images"
            className="h-8 w-8"
          >
            <Image className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
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
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Images</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Upload images to use in your LaTeX document. Click on an image to insert its reference.
              </p>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDragging
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
        <div className="flex-1 relative overflow-hidden bg-editor">
          <div
            ref={highlightRef}
            className="absolute inset-0 p-4 pl-16 font-mono text-sm leading-6 overflow-auto pointer-events-none whitespace-pre scrollbar-thin z-0"
            aria-hidden="true"
            style={{ 
              color: 'hsl(40, 6%, 90%)',
              backgroundColor: 'hsl(43, 25%, 6%)'
            }}
          >
            {highlightLatex(content)}
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onScroll={syncScroll}
            className="absolute inset-0 w-full h-full p-4 pl-16 font-mono text-sm leading-6 bg-transparent text-transparent caret-foreground resize-none focus:outline-none scrollbar-thin z-10"
            spellCheck={false}
            style={{ 
              caretColor: 'hsl(40, 6%, 90%)'
            }}
          />
        </div>
      )}
    </div>
  );
}
