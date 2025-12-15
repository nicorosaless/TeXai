"""
Schemas Pydantic para validación de datos
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from enum import Enum


class MessageRole(str, Enum):
    """Roles de mensajes"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Message(BaseModel):
    """Modelo de mensaje"""
    role: MessageRole
    content: str


class ChatRequest(BaseModel):
    """Request para chat"""
    message: str = Field(..., description="Mensaje del usuario")
    latex_content: str = Field(..., description="Contenido completo del documento LaTeX")
    conversation_history: Optional[List[Message]] = Field(
        default=[], 
        description="Historial de conversación"
    )
    stream: bool = Field(default=False, description="Si se debe hacer streaming de la respuesta")


class ChatResponse(BaseModel):
    """Response del chat"""
    message: str = Field(..., description="Respuesta del asistente")
    thinking: Optional[str] = Field(
        default=None,
        description="Thinking tokens for CoT models like DeepSeek R1"
    )
    suggestions: Optional[List[str]] = Field(
        default=None, 
        description="Sugerencias de acciones adicionales"
    )
    changes: Optional[List[dict]] = Field(
        default=None,
        description="List of changes to apply: {type, search, replace/content}"
    )
    modified_latex: Optional[str] = Field(
        default=None, 
        description="Versión modificada del LaTeX si aplica"
    )


class AnalysisRequest(BaseModel):
    """Request para análisis de documento"""
    latex_content: str = Field(..., description="Contenido del documento LaTeX")


class AnalysisResponse(BaseModel):
    """Response del análisis"""
    errors: List[dict] = Field(default=[], description="Errores encontrados")
    warnings: List[dict] = Field(default=[], description="Advertencias")
    suggestions: List[str] = Field(default=[], description="Sugerencias de mejora")
    structure: dict = Field(default={}, description="Estructura del documento")
    statistics: dict = Field(default={}, description="Estadísticas del documento")


class ImproveRequest(BaseModel):
    """Request para mejorar documento"""
    latex_content: str = Field(..., description="Contenido del documento LaTeX")
    user_message: Optional[str] = Field(
        default=None,
        description="User's specific instruction for the modification"
    )
    improvement_type: Literal[
        "writing", 
        "formatting", 
        "equations", 
        "structure", 
        "all"
    ] = Field(default="all", description="Tipo de mejora solicitada")
    focus_areas: Optional[List[str]] = Field(
        default=None, 
        description="Áreas específicas en las que enfocarse"
    )
    stream: bool = Field(default=False, description="Si se debe hacer streaming de la respuesta")


class ImproveResponse(BaseModel):
    """Response de mejora"""
    improved_latex: str = Field(..., description="Documento LaTeX mejorado")
    changes: List[dict] = Field(default=[], description="Lista de cambios realizados")
    explanation: str = Field(..., description="Explicación de las mejoras")


class ErrorDetail(BaseModel):
    """Detalle de error"""
    line: int = Field(..., description="Línea donde ocurre el error")
    column: Optional[int] = Field(default=None, description="Columna del error")
    message: str = Field(..., description="Mensaje de error")
    severity: Literal["error", "warning", "info"] = Field(
        default="error", 
        description="Severidad del error"
    )
    suggestion: Optional[str] = Field(default=None, description="Sugerencia de corrección")

