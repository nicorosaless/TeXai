import { useState, useEffect, useRef } from "react";
import { Send, ChevronDown, PanelLeftClose, PanelLeft, Check, X, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiService, type Message as ApiMessage } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface DiffLine {
  type: "added" | "removed" | "context";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  modifiedLatex?: string;
  diff?: DiffLine[];
  status?: "pending" | "accepted" | "rejected";
}

interface ChatPanelProps {
  onApplyChange: (newContent: string) => void;
  currentLatex: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// Función para calcular diff con contexto
function computeDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const diff: DiffLine[] = [];
  
  // Algoritmo LCS simplificado para diff
  let i = 0, j = 0;
  let oldLineNum = 1, newLineNum = 1;
  
  while (i < originalLines.length || j < modifiedLines.length) {
    if (i >= originalLines.length) {
      // Solo quedan líneas nuevas
      diff.push({ 
        type: "added", 
        content: modifiedLines[j], 
        newLineNum: newLineNum++ 
      });
      j++;
    } else if (j >= modifiedLines.length) {
      // Solo quedan líneas eliminadas
      diff.push({ 
        type: "removed", 
        content: originalLines[i], 
        oldLineNum: oldLineNum++ 
      });
      i++;
    } else if (originalLines[i] === modifiedLines[j]) {
      // Líneas iguales - saltar (no mostrar contexto por ahora)
      i++;
      j++;
      oldLineNum++;
      newLineNum++;
    } else {
      // Buscar la mejor coincidencia
      let foundInMod = modifiedLines.slice(j, j + 10).indexOf(originalLines[i]);
      let foundInOrig = originalLines.slice(i, i + 10).indexOf(modifiedLines[j]);
      
      if (foundInMod === -1 && foundInOrig === -1) {
        // Reemplazo directo
        diff.push({ 
          type: "removed", 
          content: originalLines[i], 
          oldLineNum: oldLineNum++ 
        });
        diff.push({ 
          type: "added", 
          content: modifiedLines[j], 
          newLineNum: newLineNum++ 
        });
        i++;
        j++;
      } else if (foundInMod >= 0 && (foundInOrig === -1 || foundInMod <= foundInOrig)) {
        // Líneas añadidas antes de la coincidencia
        for (let k = 0; k < foundInMod; k++) {
          diff.push({ 
            type: "added", 
            content: modifiedLines[j + k], 
            newLineNum: newLineNum++ 
          });
        }
        j += foundInMod;
      } else {
        // Líneas eliminadas antes de la coincidencia
        for (let k = 0; k < foundInOrig; k++) {
          diff.push({ 
            type: "removed", 
            content: originalLines[i + k], 
            oldLineNum: oldLineNum++ 
          });
        }
        i += foundInOrig;
      }
    }
  }
  
  return diff;
}

// Resumen del diff
function getDiffSummary(diff: DiffLine[]): { added: number; removed: number } {
  const added = diff.filter(d => d.type === "added").length;
  const removed = diff.filter(d => d.type === "removed").length;
  return { added, removed };
}

export function ChatPanel({ onApplyChange, currentLatex, isCollapsed, onToggleCollapse }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>("Ollama");
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    loadCurrentModel();
  }, []);

  const loadCurrentModel = async () => {
    try {
      const modelInfo = await apiService.getCurrentModel();
      setCurrentModel(modelInfo.model || "Ollama");
    } catch (error) {
      console.error("Error loading model:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setIsLoading(true);

    try {
      const improveResponse = await apiService.improve({
        latex_content: currentLatex,
        improvement_type: "all",
      });

      const modifiedLatex = improveResponse.improved_latex;
      const explanation = improveResponse.explanation || "Changes suggested.";
      
      // Solo calcular diff si hay cambios reales
      let diff: DiffLine[] = [];
      if (modifiedLatex && modifiedLatex !== currentLatex) {
        diff = computeDiff(currentLatex, modifiedLatex);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: explanation,
        modifiedLatex: diff.length > 0 ? modifiedLatex : undefined,
        diff: diff.length > 0 ? diff : undefined,
        status: diff.length > 0 ? "pending" : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Connection failed."}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
      toast({
        title: "Error",
        description: "Could not connect to the server",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeep = (messageId: string, modifiedLatex: string) => {
    onApplyChange(modifiedLatex);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, status: "accepted" as const } : msg
      )
    );
    toast({
      title: "Changes applied",
      description: "The document has been updated",
    });
  };

  const handleReject = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, status: "rejected" as const } : msg
      )
    );
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4">
        <Button variant="icon" size="icon" onClick={onToggleCollapse}>
          <PanelLeft className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-sidebar border-r border-sidebar-border flex flex-col h-full w-full">
      <div className="p-3 border-b border-sidebar-border flex items-center justify-between">
        <span className="font-semibold text-foreground text-sm">LaTeX Copilot</span>
        <Button variant="icon" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <span className="text-lg">📝</span>
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">
              LaTeX Copilot
            </h3>
            <p className="text-xs text-muted-foreground">
              Describe the changes you want to make to your document.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="animate-fade-in">
              {/* User message */}
              {message.role === "user" && (
                <div className="flex justify-end">
                  <div className="bg-primary/20 rounded-lg px-3 py-2 max-w-[85%]">
                    <p className="text-sm text-foreground">{message.content}</p>
                  </div>
                </div>
              )}

              {/* Assistant message */}
              {message.role === "assistant" && (
                <div className="space-y-2">
                  {/* Explanation */}
                  <p className="text-sm text-foreground">{message.content}</p>

                  {/* Diff display */}
                  {message.diff && message.diff.length > 0 && (
                    <div className="space-y-2">
                      {/* Summary */}
                      <div className="flex items-center gap-3 text-xs">
                        {(() => {
                          const summary = getDiffSummary(message.diff);
                          return (
                            <>
                              {summary.added > 0 && (
                                <span className="flex items-center gap-1 text-green-400">
                                  <Plus className="h-3 w-3" />
                                  {summary.added}
                                </span>
                              )}
                              {summary.removed > 0 && (
                                <span className="flex items-center gap-1 text-red-400">
                                  <Minus className="h-3 w-3" />
                                  {summary.removed}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {/* Diff view */}
                      {message.status === "pending" && (
                        <>
                          <div className="bg-[#0d1117] rounded-lg overflow-hidden border border-border text-xs font-mono">
                            <div className="max-h-40 overflow-y-auto">
                              {message.diff.slice(0, 30).map((line, idx) => (
                                <div
                                  key={idx}
                                  className={`px-2 py-0.5 flex ${
                                    line.type === "added"
                                      ? "bg-green-500/15 text-green-400"
                                      : line.type === "removed"
                                      ? "bg-red-500/15 text-red-400"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  <span className="w-5 text-right mr-2 opacity-40 select-none">
                                    {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                                  </span>
                                  <span className="flex-1 whitespace-pre overflow-hidden text-ellipsis">
                                    {line.content || " "}
                                  </span>
                                </div>
                              ))}
                              {message.diff.length > 30 && (
                                <div className="px-2 py-1 text-center text-muted-foreground border-t border-border">
                                  +{message.diff.length - 30} more
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleKeep(message.id, message.modifiedLatex!)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Keep
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-7 text-xs"
                              onClick={() => handleReject(message.id)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </>
                      )}

                      {/* Status */}
                      {message.status === "accepted" && (
                        <div className="flex items-center gap-1 text-xs text-green-400">
                          <Check className="h-3 w-3" />
                          Applied
                        </div>
                      )}
                      {message.status === "rejected" && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <X className="h-3 w-3" />
                          Rejected
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs">Generating...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe changes..."
            className="w-full bg-chat-input border border-border rounded-lg px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
            rows={2}
          />
          <Button
            variant="icon"
            size="icon"
            className="absolute bottom-2 right-2 h-6 w-6"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center mt-1.5">
          <span className="text-xs text-muted-foreground">{currentModel}</span>
        </div>
      </div>
    </div>
  );
}
