// ... imports ...
import { useState, useEffect, useRef } from "react";
import { Send, ChevronDown, PanelLeftClose, PanelLeft, Check, X, Plus, Minus, BrainCircuit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiService, type Message as ApiMessage } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const ThinkingBlock = ({ content }: { content: string }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <div
      ref={scrollRef}
      className="bg-secondary/30 rounded-md p-2 text-xs text-muted-foreground font-mono whitespace-pre-wrap border-l-2 border-primary/20 mb-2 max-h-[150px] overflow-y-auto scrollbar-thin transition-all"
    >
      {content || <span className="animate-pulse opacity-50">Thinking...</span>}
    </div>
  );
};

export interface DiffLine {
  type: "added" | "removed" | "context" | "unchanged";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string; // Add thinking field
  modifiedLatex?: string;
  diff?: DiffLine[];
  status?: "pending" | "accepted" | "rejected";
  isStreaming?: boolean;
}

// ... existing interfaces ...
interface ChatPanelProps {
  onApplyChange: (newContent: string) => void;
  onSuggestion?: (newContent: string | null) => void;
  currentLatex: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// ... computeDiff and getDiffSummary functions (keep as is) ...
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
      // Líneas iguales
      diff.push({
        type: "unchanged",
        content: originalLines[i],
        oldLineNum: oldLineNum++,
        newLineNum: newLineNum++
      });
      i++;
      j++;
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

export function ChatPanel({ onApplyChange, onSuggestion, currentLatex, isCollapsed, onToggleCollapse }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>("Ollama");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State for Thinking expansion
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    loadCurrentModel();
  }, []);

  const loadCurrentModel = async () => {
    try {
      const [modelInfo, modelsList] = await Promise.all([
        apiService.getCurrentModel(),
        apiService.listModels()
      ]);
      setCurrentModel(modelInfo.model || "Ollama");
      setAvailableModels(modelsList.map(m => m.name));
    } catch (error) {
      console.error("Error loading model:", error);
      setAvailableModels([]);
    }
  };

  const handleModelChange = async (modelName: string) => {
    try {
      await apiService.setCurrentModel(modelName);
      setCurrentModel(modelName);
      toast({
        title: "Model updated",
        description: `Switched to ${modelName}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to switch model",
        variant: "destructive",
      });
    }
  };

  const toggleThinking = (messageId: string) => {
    setExpandedThinking(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      thinking: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    // Auto-expand thinking for new messages
    setExpandedThinking(prev => ({ ...prev, [assistantMsgId]: true }));

    const userInput = input;
    setInput("");
    setIsLoading(true);

    try {
      let accumulatedThinking = "";
      let accumulatedContent = ""; // This will contain explanation + code block

      for await (const chunk of apiService.improveStream({
        latex_content: currentLatex,
        improvement_type: "all",
        user_message: userInput,
      })) {

        if (chunk.type === "thinking") {
          accumulatedThinking += chunk.content;
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, thinking: accumulatedThinking }
              : msg
          ));
        } else if (chunk.type === "content") {
          accumulatedContent += chunk.content;
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, content: accumulatedContent } // Temporary content display
              : msg
          ));
        }
      }

      // Parsing final content to separate explanation and code
      // We look for markdown code blocks
      const codeBlockMatch = accumulatedContent.match(/```(?:latex)?\s*([\s\S]*?)```/);
      let improvedLatex = "";
      let explanation = accumulatedContent;

      if (codeBlockMatch) {
        improvedLatex = codeBlockMatch[1].trim();
        // Explanation is everything before the code block
        explanation = accumulatedContent.substring(0, codeBlockMatch.index).trim();
        // If empty explanation (e.g. only code returned), use a default
        if (!explanation) explanation = "Changes generated.";
      } else if (accumulatedContent.includes("\\documentclass")) {
        // Fallback: entire content might be latex
        improvedLatex = accumulatedContent.trim();
        explanation = "Changes generated.";
      }

      // Calculate diff
      let diff: DiffLine[] = [];
      if (improvedLatex && improvedLatex !== currentLatex) {
        diff = computeDiff(currentLatex, improvedLatex);
        onSuggestion?.(improvedLatex);
      }

      // Update final message state
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMsgId
          ? {
            ...msg,
            content: explanation,
            thinking: accumulatedThinking,
            modifiedLatex: diff.length > 0 ? improvedLatex : undefined,
            diff: diff.length > 0 ? diff : undefined,
            status: diff.length > 0 ? "pending" : undefined,
            isStreaming: false
          }
          : msg
      ));

    } catch (error) {
      console.error("Error:", error);
      const errorMessage = `Error: ${error instanceof Error ? error.message : "Connection failed."}`;
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMsgId
          ? { ...msg, content: errorMessage, isStreaming: false }
          : msg
      ));
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
    onSuggestion?.(null); // Clear global suggestion
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
      <div className="p-3 border-b border-sidebar-border flex items-center justify-end app-drag-region">
        <Button variant="icon" size="icon" className="h-7 w-7 no-drag" onClick={onToggleCollapse}>
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-sm text-muted-foreground">
              Modify your LaTeX project or create one from scratch!
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="animate-fade-in space-y-2">
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

                  {/* Thinking Section */}
                  {message.thinking && message.thinking.length > 0 && (
                    <Collapsible
                      open={expandedThinking[message.id]}
                      onOpenChange={() => toggleThinking(message.id)}
                      className="w-full"
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors mb-1">
                          <BrainCircuit className="h-3 w-3" />
                          <span>Thinking Process</span>
                          {message.isStreaming && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                          <ChevronDown className={`h-3 w-3 transition-transform ${expandedThinking[message.id] ? "transform rotate-180" : ""}`} />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ThinkingBlock content={message.thinking} />
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Explanation - Moved BEFORE Diff per user request */}
                  <div className="space-y-1 mb-3">
                    <div className="text-sm text-foreground whitespace-pre-wrap">
                      {message.content
                        .replace(/```latex[\s\S]*$/, '')      // Remove LaTeX block at end
                        .replace(/```json[\s\S]*?```/g, '')   // Remove JSON blocks
                        .replace(/\[Explanation of changes\]/gi, '') // Remove specific bracket header
                        .replace(/\*\*(Explicació.*|Document.*|Explanation.*|Modified document.*)\*\*[:\s]*\n?/gi, '') // Remove bold headers
                        .trim() ||
                        (message.isStreaming && !message.content ? <span className="animate-pulse">Generating response...</span> : message.content.replace(/```latex[\s\S]*$/, '').trim())}
                    </div>
                  </div>

                  {/* Diff display */}
                  {message.diff && message.diff.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {/* Summary */}
                      <div className="flex items-center gap-3 text-xs">
                        {(() => {
                          const summary = getDiffSummary(message.diff);
                          return (
                            <>
                              <span className="font-medium">Proposed Changes:</span>
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

                      {/* Status-based actions */}
                      {message.status === "pending" && (
                        <>
                          <div className="bg-[#0d1117] rounded-lg overflow-hidden border border-border text-xs font-mono p-2 max-h-[200px] overflow-y-auto">
                            <div className="space-y-0.5">
                              {message.diff.slice(0, 5).map((line, idx) => (
                                <div key={idx} className={`flex ${line.type === 'added' ? 'bg-green-900/30 text-green-300' : line.type === 'removed' ? 'bg-red-900/30 text-red-300' : 'text-muted-foreground'}`}>
                                  <span className="w-4 inline-block select-none opacity-50">{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
                                  <span>{line.content}</span>
                                </div>
                              ))}
                              {message.diff.length > 5 && <div className="text-muted-foreground italic pl-4">... {message.diff.length - 5} more lines</div>}
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
                              Keep All
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-7 text-xs"
                              onClick={() => handleReject(message.id)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Reject All
                            </Button>
                          </div>
                        </>
                      )}

                      {/* Status */}
                      {message.status === "accepted" && (
                        <div className="flex items-center gap-1 text-xs text-green-400 font-medium bg-green-400/10 p-1.5 rounded">
                          <Check className="h-3 w-3" />
                          Changes Applied
                        </div>
                      )}
                      {message.status === "rejected" && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium bg-secondary p-1.5 rounded">
                          <X className="h-3 w-3" />
                          Changes Rejected
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ... Input section (unchanged) ... */}
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
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </Button>
        </div>

        {/* Model Selector below input */}
        <div className="flex items-center mt-2 justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-secondary/50 text-muted-foreground text-xs cursor-pointer hover:bg-secondary transition-colors">
                <span>{currentModel}</span>
                <ChevronDown className="h-3 w-3" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              {availableModels.length > 0 ? (
                availableModels.map((model) => (
                  <DropdownMenuItem key={model} onClick={() => handleModelChange(model)}>
                    {model}
                    {model === currentModel && <Check className="ml-auto h-3 w-3" />}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No models found</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
