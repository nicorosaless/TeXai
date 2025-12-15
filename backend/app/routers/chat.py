"""
Router para el chat con el asistente de IA
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
import json

from app.models.schemas import ChatRequest, ChatResponse, Message
from app.services.ai_service import ai_service
from app.core.config import settings
from typing import Optional

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Endpoint principal para chat con el asistente de LaTeX
    
    Permite hacer preguntas sobre el documento y recibir respuestas inteligentes
    """
    try:
        # Validar longitud del LaTeX
        if len(request.latex_content) > settings.MAX_LATEX_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"El documento LaTeX es demasiado largo (máximo {settings.MAX_LATEX_LENGTH} caracteres)"
            )
        
        # Si se solicita streaming
        if request.stream:
            return StreamingResponse(
                _stream_chat(request.message, request.latex_content, request.conversation_history),
                media_type="text/event-stream"
            )
        
        # Chat normal
        response_text = await ai_service.chat(
            user_message=request.message,
            latex_content=request.latex_content,
            conversation_history=request.conversation_history,
            stream=False,
            model=None  # Usa el modelo por defecto
        )
        
        # Extraer sugerencias y código modificado si está presente
        suggestions = None
        modified_latex = None
        
        # Intentar extraer código LaTeX de la respuesta
        import re
        # Buscar bloques de código LaTeX
        latex_blocks = re.findall(r'```latex\s*\n(.*?)\n```', response_text, re.DOTALL)
        if not latex_blocks:
            # También buscar bloques de código sin el prefijo "latex"
            code_blocks = re.findall(r'```\s*\n(.*?)\n```', response_text, re.DOTALL)
            for block in code_blocks:
                # Verificar si parece código LaTeX
                if '\\documentclass' in block or '\\begin{document}' in block:
                    latex_blocks.append(block)
                    break
        
        if latex_blocks:
            modified_latex = latex_blocks[0].strip()
            # Limpiar el código LaTeX de posibles artefactos
            modified_latex = re.sub(r'^```latex\s*', '', modified_latex, flags=re.MULTILINE)
            modified_latex = re.sub(r'```\s*$', '', modified_latex, flags=re.MULTILINE)
            modified_latex = modified_latex.strip()
        
        return ChatResponse(
            message=response_text,
            suggestions=suggestions,
            modified_latex=modified_latex
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el chat: {str(e)}")


async def _stream_chat(message: str, latex_content: str, conversation_history: List[Message]):
    """Generador para streaming de respuestas"""
    try:
        stream_generator = await ai_service.chat(
            user_message=message,
            latex_content=latex_content,
            conversation_history=conversation_history,
            stream=True,
            model=None
        )
        async for chunk in stream_generator:
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        error_data = json.dumps({'error': str(e)})
        yield f"data: {error_data}\n\n"


@router.get("/chat/suggestions")
async def get_suggestions():
    """
    Obtiene sugerencias predefinidas para el chat
    """
    return {
        "suggestions": [
            "Improve writing",
            "Add equations",
            "Fix errors",
            "Improve formatting",
            "Add sections",
            "Optimize structure",
            "Add bibliography",
            "Improve equations"
        ]
    }

