/**
 * Servicio API para comunicarse con el backend de LaTeX AI
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  message: string;
  latex_content: string;
  conversation_history?: Message[];
  stream?: boolean;
}

export interface LatexChange {
  type: "replace" | "delete" | "insert_after";
  search: string;
  replace?: string;  // For "replace"
  content?: string;  // For "insert_after"
}

export interface ChatResponse {
  message: string;
  thinking?: string;
  suggestions?: string[];
  changes?: LatexChange[];
  modified_latex?: string;
}

export interface AnalysisResponse {
  errors: Array<{
    line: number;
    message: string;
    severity: "error" | "warning" | "info";
    suggestion?: string;
  }>;
  warnings: Array<{
    line: number;
    message: string;
    suggestion?: string;
  }>;
  suggestions: string[];
  structure: {
    sections: string[];
    equations: number;
    figures: number;
    tables: number;
  };
  statistics: {
    words: number;
    equations: number;
    figures: number;
    tables: number;
    sections: number;
  };
}

export interface ImproveRequest {
  latex_content: string;
  user_message?: string;
  improvement_type?: "writing" | "formatting" | "equations" | "structure" | "all";
  focus_areas?: string[];
  stream?: boolean;
}

export interface ImproveResponse {
  improved_latex: string;
  changes: Array<{
    line: number;
    type: string;
    description: string;
    before?: string;
    after?: string;
  }>;
  explanation: string;
}

export interface OllamaModel {
  name: string;
  size: string;
  modified: string;
  digest: string;
}

export interface Document {
  id: string;
  name: string;
  content?: string;
  created_at: string;
  updated_at: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Envía un mensaje al asistente de IA
   */
  async chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...request,
          stream: false,
        }),
        signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(error.detail || `Error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error; // Re-throw abort errors
      }
      console.error("Error en chat:", error);
      throw error;
    }
  }

  /**
   * Streaming chat for progressive display of thinking and response
   * Returns an async generator that yields typed chunks
   */
  async *chatStream(
    request: ChatRequest,
    signal?: AbortSignal
  ): AsyncGenerator<{ type: 'thinking' | 'response' | 'error' | 'done' | 'changes'; content: string; changes?: LatexChange[]; modified_latex?: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...request,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Error desconocido" }));
      throw new Error(error.detail || `Error ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              yield { type: "done", content: "" };
              return;
            }
            try {
              const parsed = JSON.parse(data);
              yield parsed;
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Analiza un documento LaTeX
   */
  async analyze(latexContent: string): Promise<AnalysisResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latex_content: latexContent,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(error.detail || `Error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error en análisis:", error);
      throw error;
    }
  }

  /**
   * Mejora un documento LaTeX
   */
  async improve(request: ImproveRequest): Promise<ImproveResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/improve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latex_content: request.latex_content,
          user_message: request.user_message,
          improvement_type: request.improvement_type || "all",
          focus_areas: request.focus_areas,
          stream: false
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(error.detail || `Error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error en mejora:", error);
      throw error;
    }
  }

  /**
   * Mejora un documento LaTeX con streaming
   */
  async *improveStream(
    request: ImproveRequest,
    signal?: AbortSignal
  ): AsyncGenerator<{ type: 'thinking' | 'content' | 'error' | 'done'; content: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/improve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...request,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Error desconocido" }));
      throw new Error(error.detail || `Error ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              yield { type: "done", content: "" };
              return;
            }
            try {
              const parsed = JSON.parse(data);
              yield parsed;
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Lista los modelos disponibles de Ollama
   */
  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/models`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(error.detail || `Error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error al listar modelos:", error);
      throw error;
    }
  }

  /**
   * Obtiene el modelo actual configurado
   */
  async getCurrentModel(): Promise<{ model: string; base_url: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/models/current`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(error.detail || `Error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error al obtener modelo actual:", error);
      throw error;
    }
  }

  /**
   * Establece el modelo actual
   */
  async setCurrentModel(modelName: string): Promise<{ model: string; status: string }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/models/current?model_name=${encodeURIComponent(modelName)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(error.detail || `Error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error al establecer modelo:", error);
      throw error;
    }
  }

  // ============ Document API ============

  /**
   * Crea un nuevo documento
   */
  async createDocument(name: string, content: string): Promise<Document> {
    const response = await fetch(`${this.baseUrl}/api/v1/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    });
    if (!response.ok) throw new Error("Failed to create document");
    return response.json();
  }

  /**
   * Lista todos los documentos
   */
  async listDocuments(): Promise<Document[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/documents`);
    if (!response.ok) throw new Error("Failed to list documents");
    return response.json();
  }

  /**
   * Obtiene un documento por ID
   */
  async getDocument(id: string): Promise<Document> {
    const response = await fetch(`${this.baseUrl}/api/v1/documents/${id}`);
    if (!response.ok) throw new Error("Document not found");
    return response.json();
  }

  /**
   * Actualiza un documento
   */
  async updateDocument(id: string, content: string, description?: string): Promise<Document> {
    const response = await fetch(`${this.baseUrl}/api/v1/documents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, description }),
    });
    if (!response.ok) throw new Error("Failed to update document");
    return response.json();
  }

  /**
   * Elimina un documento
   */
  async deleteDocument(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/documents/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete document");
  }
}

export const apiService = new ApiService();
