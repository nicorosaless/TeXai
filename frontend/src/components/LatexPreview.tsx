import { useEffect, useState, useRef } from "react";
import { ZoomIn, ZoomOut, Maximize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import katex from "katex";
import "katex/dist/katex.min.css";

interface LatexPreviewProps {
  content: string;
}

function renderMath(latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
    });
  } catch {
    return `<code>${latex}</code>`;
  }
}

function renderInlineMath(latex: string): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
    });
  } catch {
    return `<code>${latex}</code>`;
  }
}

function compileLatexToHtml(latex: string): string {
  // Extract document body
  const bodyMatch = latex.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  let content = bodyMatch ? bodyMatch[1] : latex;

  // Extract metadata
  const titleMatch = latex.match(/\\title\{([^}]*)\}/);
  const authorMatch = latex.match(/\\author\{([^}]*)\}/);
  const dateMatch = latex.match(/\\date\{([^}]*)\}/);

  let html = "";

  // Handle \maketitle
  if (content.includes("\\maketitle")) {
    let titleBlock = '<div class="title-block">';
    if (titleMatch) {
      titleBlock += `<h1 class="doc-title">${titleMatch[1]}</h1>`;
    }
    if (authorMatch) {
      titleBlock += `<p class="doc-author">${authorMatch[1]}</p>`;
    }
    if (dateMatch) {
      titleBlock += `<p class="doc-date">${dateMatch[1]}</p>`;
    }
    titleBlock += '</div>';
    content = content.replace("\\maketitle", titleBlock);
  }

  html = content;

  // Abstract
  html = html.replace(
    /\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g,
    '<div class="abstract"><p class="abstract-title">Abstract</p><p class="abstract-content">$1</p></div>'
  );

  // Sections
  html = html.replace(/\\section\*?\{([^}]*)\}/g, '<h2 class="section">$1</h2>');
  html = html.replace(/\\subsection\*?\{([^}]*)\}/g, '<h3 class="subsection">$1</h3>');
  html = html.replace(/\\subsubsection\*?\{([^}]*)\}/g, '<h4 class="subsubsection">$1</h4>');

  // Text formatting
  html = html.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
  html = html.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
  html = html.replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>');
  html = html.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>');
  html = html.replace(/\\texttt\{([^}]*)\}/g, '<code class="tt">$1</code>');

  // Display equations with KaTeX
  html = html.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, (_, eq) => {
    return `<div class="equation">${renderMath(eq.trim())}</div>`;
  });

  html = html.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, (_, eq) => {
    return `<div class="equation">${renderMath("\\begin{aligned}" + eq.trim() + "\\end{aligned}")}</div>`;
  });

  // Display math $$ ... $$
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, eq) => {
    return `<div class="equation">${renderMath(eq.trim())}</div>`;
  });

  // Inline math $ ... $
  html = html.replace(/\$([^$]+)\$/g, (_, eq) => {
    return renderInlineMath(eq.trim());
  });

  // Itemize
  html = html.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, items) => {
    const listItems = items
      .split("\\item")
      .filter((item: string) => item.trim())
      .map((item: string) => `<li>${processInlineFormatting(item.trim())}</li>`)
      .join("");
    return `<ul class="itemize">${listItems}</ul>`;
  });

  // Enumerate
  html = html.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, items) => {
    const listItems = items
      .split("\\item")
      .filter((item: string) => item.trim())
      .map((item: string) => `<li>${processInlineFormatting(item.trim())}</li>`)
      .join("");
    return `<ol class="enumerate">${listItems}</ol>`;
  });

  // Figures (simplified)
  html = html.replace(/\\begin\{figure\}[\s\S]*?\\includegraphics.*?\{([^}]*)\}[\s\S]*?\\caption\{([^}]*)\}[\s\S]*?\\end\{figure\}/g,
    '<figure class="figure"><div class="figure-placeholder">[$1]</div><figcaption>$2</figcaption></figure>'
  );

  // Simple includegraphics
  html = html.replace(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/g,
    '<div class="figure-placeholder">Image: $2</div>'
  );

  // Tables (basic)
  html = html.replace(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g, (_, tableContent) => {
    const rows = tableContent
      .split("\\\\")
      .filter((row: string) => row.trim() && !row.includes("\\hline"))
      .map((row: string) => {
        const cells = row.split("&").map((cell: string) => `<td>${processInlineFormatting(cell.trim())}</td>`).join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    return `<table class="tabular"><tbody>${rows}</tbody></table>`;
  });

  // Quotes
  html = html.replace(/``/g, '"');
  html = html.replace(/''/g, '"');

  // Line breaks
  html = html.replace(/\\\\/g, '<br/>');
  html = html.replace(/\\newline/g, '<br/>');

  // Horizontal rules
  html = html.replace(/\\hrule/g, '<hr/>');

  // Comments (remove)
  html = html.replace(/%.*/g, '');

  // Clean up remaining commands
  html = html.replace(/\\[a-zA-Z]+(\[[^\]]*\])?\{[^}]*\}/g, '');
  html = html.replace(/\\(usepackage|documentclass|label|ref|cite|bibliography|bibliographystyle)\{[^}]*\}/g, '');
  html = html.replace(/\\[a-zA-Z]+/g, '');

  // Paragraphs
  html = html.replace(/\n\s*\n/g, '</p><p>');

  return `<div class="latex-document"><p>${html}</p></div>`;
}

function processInlineFormatting(text: string): string {
  let result = text;
  result = result.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
  result = result.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
  result = result.replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>');
  result = result.replace(/\$([^$]+)\$/g, (_, eq) => renderInlineMath(eq.trim()));
  return result;
}

export function LatexPreview({ content }: LatexPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiledHtml, setCompiledHtml] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsCompiling(true);
    const timer = setTimeout(() => {
      const html = compileLatexToHtml(content);
      setCompiledHtml(html);
      setIsCompiling(false);
    }, 300); // Small delay for debouncing

    return () => clearTimeout(timer);
  }, [content]);

  const [containerWidth, setContainerWidth] = useState<number>(0);

  const outerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!outerContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(outerContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Measure content height to ensure correct scrolling
  const [contentHeight, setContentHeight] = useState<number>(1056);

  useEffect(() => {
    // Only measure when content or width changes
    // We measure the scrollHeight of the inner container to see how tall the text is
    const measure = () => {
      if (containerRef.current) {
        // Reset height temporarily to natural size
        setContentHeight(Math.max(1056, containerRef.current.scrollHeight));
      }
    };
    // Debounce slightly
    const timer = setTimeout(measure, 100);
    return () => clearTimeout(timer);
  }, [compiledHtml, containerWidth, zoom]); // Re-measure on key changes

  // Calculate generic fit scale (with 40px padding safety)
  // 816px is the fixed width of the doc
  // Ensure scale doesn't go below 0.1 or become negative
  const fitScale = containerWidth ? Math.max(0.1, Math.min(1, (containerWidth - 64) / 816)) : 1;
  const effectiveScale = (zoom / 100) * fitScale;

  return (
    <div className="flex-1 flex flex-col bg-preview h-full w-full">
      <div className="h-12 border-b border-border bg-card flex items-center justify-between pl-4 pr-4">
        {/* ... (Header same as before) ... */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Preview</span>
          {isCompiling && (
            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="icon"
            size="icon"
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{zoom}%</span>
          <Button
            variant="icon"
            size="icon"
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="icon" size="icon" title="Fullscreen">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={outerContainerRef}
        className="flex-1 overflow-auto bg-gray-100/50 p-8 scrollbar-thin relative w-full h-full flex flex-col items-center"
      >
        {/* Wrapper handles the SCROLLED size */}
        <div
          style={{
            width: 816 * effectiveScale,
            height: contentHeight * effectiveScale,
            flexShrink: 0
          }}
          className="relative my-4 transition-all duration-100"
        >
          <div
            ref={containerRef}
            className="w-[816px] min-h-[1056px] bg-white shadow-xl text-black origin-top-left"
            style={{
              transform: `scale(${effectiveScale})`,
              padding: "2.5cm"
            }}
          >
            <style>{`
            .latex-document {
              font-family: 'Times New Roman', 'Computer Modern', serif;
              font-size: 12pt;
              line-height: 1.5;
              color: #000;
            }
            .latex-document p {
              margin-bottom: 0.75em;
              text-align: justify;
            }
            .title-block {
              text-align: center;
              margin-bottom: 2em;
            }
            .doc-title {
              font-size: 1.5em;
              font-weight: bold;
              margin-bottom: 0.5em;
            }
            .doc-author {
              font-size: 1.1em;
              margin-bottom: 0.25em;
            }
            .doc-date {
              font-size: 0.95em;
              color: #555;
            }
            .abstract {
              margin: 1.5em 2em;
              padding: 1em;
              background: #f9f9f9;
              border-left: 3px solid #ccc;
            }
            .abstract-title {
              font-weight: bold;
              margin-bottom: 0.5em;
            }
            .abstract-content {
              font-size: 0.95em;
            }
            .section {
              font-size: 1.3em;
              font-weight: bold;
              margin-top: 1.5em;
              margin-bottom: 0.75em;
            }
            .subsection {
              font-size: 1.15em;
              font-weight: bold;
              margin-top: 1.25em;
              margin-bottom: 0.5em;
            }
            .subsubsection {
              font-size: 1.05em;
              font-weight: bold;
              margin-top: 1em;
              margin-bottom: 0.5em;
            }
            .equation {
              margin: 1em 0;
              text-align: center;
              overflow-x: auto;
            }
            .itemize, .enumerate {
              margin: 0.75em 0;
              padding-left: 2em;
            }
            .itemize li, .enumerate li {
              margin-bottom: 0.25em;
            }
            .tabular {
              margin: 1em auto;
              border-collapse: collapse;
            }
            .tabular td {
              padding: 0.5em 1em;
              border: 1px solid #ddd;
            }
            .figure {
              margin: 1.5em auto;
              text-align: center;
            }
            .figure-placeholder {
              background: #f0f0f0;
              padding: 2em;
              border: 1px dashed #ccc;
              color: #666;
              font-style: italic;
            }
            figcaption {
              margin-top: 0.5em;
              font-size: 0.9em;
              color: #555;
            }
            .tt {
              font-family: 'Courier New', monospace;
              background: #f5f5f5;
              padding: 0 0.25em;
            }
          `}</style>
            <div dangerouslySetInnerHTML={{ __html: compiledHtml }} />
          </div>
        </div>
      </div>
    </div>
  );
}
