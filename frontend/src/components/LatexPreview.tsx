import { useEffect, useState, useRef } from "react";
import { ZoomIn, ZoomOut, Maximize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import katex from "katex";
import "katex/dist/katex.min.css";

interface LatexPreviewProps {
  content: string;
  projectDir?: string;
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

function compileLatexToHtml(latex: string, projectDir?: string): string {
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
    (_, imgPath, caption) => {
      const imageSrc = projectDir ? `file://${projectDir}/${imgPath}` : imgPath;
      return `<figure class="figure"><img src="${imageSrc}" alt="${caption}" class="figure-image" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" /><div class="figure-placeholder" style="display:none">[${imgPath}]</div><figcaption>${caption}</figcaption></figure>`;
    }
  );

  // Simple includegraphics
  html = html.replace(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/g,
    (_, options, imgPath) => {
      const imageSrc = projectDir ? `file://${projectDir}/${imgPath}` : imgPath;
      return `<div class="figure"><img src="${imageSrc}" alt="${imgPath}" class="figure-image" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" /><div class="figure-placeholder" style="display:none">Image: ${imgPath}</div></div>`;
    }
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

// Page dimensions in pixels (Letter size at 96 DPI)
const PAGE_WIDTH = 816;  // 8.5 inches * 96 DPI
const PAGE_HEIGHT = 1056; // 11 inches * 96 DPI
const PAGE_PADDING = 96;  // ~1 inch margins (2.54cm)
const CONTENT_HEIGHT = PAGE_HEIGHT - (PAGE_PADDING * 2); // Usable content height per page

export function LatexPreview({ content, projectDir }: LatexPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiledHtml, setCompiledHtml] = useState<string>("");
  const [numPages, setNumPages] = useState(1);
  const measureRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    setIsCompiling(true);
    const timer = setTimeout(() => {
      const html = compileLatexToHtml(content, projectDir);
      setCompiledHtml(html);
      setIsCompiling(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [content, projectDir]);

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

  // Measure content and calculate number of pages needed
  useEffect(() => {
    const measure = () => {
      if (measureRef.current) {
        const contentActualHeight = measureRef.current.scrollHeight;
        const pagesNeeded = Math.max(1, Math.ceil(contentActualHeight / CONTENT_HEIGHT));
        setNumPages(pagesNeeded);
      }
    };
    const timer = setTimeout(measure, 150);
    return () => clearTimeout(timer);
  }, [compiledHtml]);

  const fitScale = containerWidth ? Math.max(0.1, Math.min(1, (containerWidth - 64) / PAGE_WIDTH)) : 1;
  const effectiveScale = (zoom / 100) * fitScale;

  // Total height = all pages + gaps between them
  const pageGap = 24;
  const totalHeight = (numPages * PAGE_HEIGHT + (numPages - 1) * pageGap) * effectiveScale;

  return (
    <div className="flex-1 flex flex-col bg-preview h-full w-full">
      <div className="h-12 border-b border-border bg-card flex items-center justify-between pl-4 pr-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Preview</span>
          {isCompiling && (
            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
          )}
          <span className="text-xs text-muted-foreground">
            {numPages} {numPages === 1 ? 'page' : 'pages'}
          </span>
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

      {/* Hidden measurement container */}
      <div
        ref={measureRef}
        className="absolute opacity-0 pointer-events-none"
        style={{
          width: PAGE_WIDTH - (PAGE_PADDING * 2),
          padding: 0,
          left: -9999,
        }}
        dangerouslySetInnerHTML={{ __html: compiledHtml }}
      />

      <div
        ref={outerContainerRef}
        className="flex-1 overflow-auto bg-gray-500/20 p-6 scrollbar-thin relative w-full h-full"
      >
        <div
          className="flex flex-col items-center gap-6"
          style={{
            minHeight: totalHeight,
          }}
        >
          {/* Render each page */}
          {Array.from({ length: numPages }).map((_, pageIndex) => (
            <div
              key={pageIndex}
              className="bg-white shadow-xl origin-top"
              style={{
                width: PAGE_WIDTH * effectiveScale,
                height: PAGE_HEIGHT * effectiveScale,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: PAGE_WIDTH,
                  height: PAGE_HEIGHT,
                  transform: `scale(${effectiveScale})`,
                  transformOrigin: 'top left',
                  padding: PAGE_PADDING,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Content container with column-based pagination */}
                <div
                  className="latex-page-content"
                  style={{
                    position: 'absolute',
                    top: PAGE_PADDING,
                    left: PAGE_PADDING,
                    width: PAGE_WIDTH - (PAGE_PADDING * 2),
                    height: CONTENT_HEIGHT,
                    overflow: 'hidden',
                    columnWidth: PAGE_WIDTH - (PAGE_PADDING * 2),
                    columnCount: 1,
                    columnFill: 'auto',
                  }}
                >
                  <div
                    style={{
                      marginTop: -(pageIndex * CONTENT_HEIGHT),
                    }}
                    dangerouslySetInnerHTML={{ __html: compiledHtml }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Global LaTeX styles */}
        <style>{`
          /* === OVERLEAF-STYLE LATEX DOCUMENT === */
          .latex-document {
            font-family: 'Computer Modern Serif', 'Latin Modern Roman', 'CMU Serif', 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.2;
            color: #000;
            text-align: justify;
            hyphens: auto;
            -webkit-hyphens: auto;
            word-spacing: 0.05em;
          }
          
          .latex-document p {
            margin: 0;
            text-indent: 1.5em;
            line-height: 1.2;
            widows: 2;
            orphans: 2;
          }
          
          .latex-document p:first-of-type,
          .latex-document h2 + p,
          .latex-document h3 + p,
          .latex-document h4 + p,
          .latex-document .abstract + p,
          .latex-document .title-block + p {
            text-indent: 0;
          }
          
          /* Title block - centered, LaTeX style */
          .title-block {
            text-align: center;
            margin-bottom: 1.5em;
            padding-bottom: 0;
          }
          
          .doc-title {
            font-family: 'Computer Modern Serif', 'Latin Modern Roman', serif;
            font-size: 17pt;
            font-weight: bold;
            margin-bottom: 0.8em;
            line-height: 1.2;
            letter-spacing: -0.01em;
          }
          
          .doc-author {
            font-size: 12pt;
            margin-bottom: 0.3em;
            font-weight: normal;
          }
          
          .doc-date {
            font-size: 12pt;
            margin-top: 0.5em;
          }
          
          /* Abstract - LaTeX article style (no box, just indented) */
          .abstract {
            margin: 1.5em 2.5em;
            padding: 0;
            background: transparent;
            border: none;
            font-size: 10pt;
          }
          
          .abstract-title {
            font-weight: bold;
            font-size: 11pt;
            text-align: center;
            margin-bottom: 0.5em;
            display: block;
          }
          
          .abstract-content {
            text-align: justify;
            line-height: 1.2;
            text-indent: 0;
          }
          
          /* Section headings - LaTeX article style */
          .section {
            font-family: 'Computer Modern Serif', 'Latin Modern Roman', serif;
            font-size: 12pt;
            font-weight: bold;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            counter-increment: section;
            display: block;
          }
          
          .section::before {
            content: counter(section) "  ";
          }
          
          .subsection {
            font-family: 'Computer Modern Serif', 'Latin Modern Roman', serif;
            font-size: 11pt;
            font-weight: bold;
            margin-top: 1.2em;
            margin-bottom: 0.4em;
            counter-increment: subsection;
            display: block;
          }
          
          .subsection::before {
            content: counter(section) "." counter(subsection) "  ";
          }
          
          .subsubsection {
            font-family: 'Computer Modern Serif', 'Latin Modern Roman', serif;
            font-size: 11pt;
            font-weight: bold;
            margin-top: 1em;
            margin-bottom: 0.3em;
            counter-increment: subsubsection;
            display: block;
          }
          
          .subsubsection::before {
            content: counter(section) "." counter(subsection) "." counter(subsubsection) "  ";
          }
          
          /* Reset counters at document level */
          .latex-document {
            counter-reset: section subsection subsubsection;
          }
          
          .section {
            counter-reset: subsection subsubsection;
          }
          
          .subsection {
            counter-reset: subsubsection;
          }
          
          /* Equations - centered with proper spacing */
          .equation {
            margin: 0.8em 0;
            text-align: center;
            overflow-x: auto;
          }
          
          /* Lists - LaTeX style */
          .itemize, .enumerate {
            margin: 0.5em 0;
            padding-left: 2.5em;
            list-style-position: outside;
          }
          
          .itemize {
            list-style-type: disc;
          }
          
          .enumerate {
            list-style-type: decimal;
          }
          
          .itemize li, .enumerate li {
            margin-bottom: 0.15em;
            text-indent: 0;
            line-height: 1.2;
          }
          
          /* Tables - LaTeX booktabs style */
          .tabular {
            margin: 1em auto;
            border-collapse: collapse;
            font-size: 10pt;
          }
          
          .tabular td, .tabular th {
            padding: 0.3em 0.8em;
            border: none;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
          }
          
          .tabular tr:first-child td,
          .tabular tr:first-child th {
            border-top: 2px solid #000;
          }
          
          .tabular tr:last-child td,
          .tabular tr:last-child th {
            border-bottom: 2px solid #000;
          }
          
          /* Figures */
          .figure {
            margin: 1em auto;
            text-align: center;
          }
          
          .figure-placeholder {
            background: #fafafa;
            padding: 2em 3em;
            border: 1px solid #ddd;
            color: #666;
            font-family: 'Computer Modern Typewriter', 'Courier New', monospace;
            font-size: 9pt;
          }
          
          .figure-image {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          
          figcaption {
            margin-top: 0.5em;
            font-size: 10pt;
            text-align: center;
          }
          
          figcaption::before {
            content: "Figure: ";
            font-weight: bold;
          }
          
          /* Monospace / typewriter text */
          .tt {
            font-family: 'Computer Modern Typewriter', 'Courier New', monospace;
            font-size: 10pt;
            background: transparent;
            padding: 0;
          }
          
          /* Emphasis and bold */
          .latex-document strong {
            font-weight: bold;
          }
          
          .latex-document em {
            font-style: italic;
          }
          
          /* Horizontal rules */
          .latex-document hr {
            border: none;
            border-top: 0.5pt solid #000;
            margin: 1em 0;
          }
          
          /* KaTeX overrides for Computer Modern look */
          .katex {
            font-size: 1em !important;
          }
        `}</style>
      </div>
    </div>
  );
}
