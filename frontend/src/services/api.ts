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

export interface ChatResponse {
  message: string;
  suggestions?: string[];
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
  improvement_type?: "writing" | "formatting" | "equations" | "structure" | "all";
  focus_areas?: string[];
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
  async chat(request: ChatRequest): Promise<ChatResponse> {
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
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(error.detail || `Error ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error en chat:", error);
      throw error;
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
          improvement_type: request.improvement_type || "all",
          focus_areas: request.focus_areas,
          latex_content: request.latex_content,
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

