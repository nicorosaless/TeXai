"""
Router para el chat con el asistente de IA
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
import json

from app.models.schemas import ChatRequest, ChatResponse, Message
from app.services.ai_service import ai_service, parse_llm_response, apply_changes
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
        chat_result = await ai_service.chat(
            user_message=request.message,
            latex_content=request.latex_content,
            conversation_history=request.conversation_history,
            stream=False,
            model=None  # Usa el modelo por defecto
        )
        
        response_text = chat_result.get("response", "")
        thinking_text = chat_result.get("thinking", None)
        
        # Parse the response to extract explanation and changes
        explanation, changes = parse_llm_response(response_text)
        
        # Apply changes to get modified LaTeX if there are changes
        modified_latex = None
        if changes:
            modified_latex = apply_changes(request.latex_content, changes)
        
        return ChatResponse(
            message=explanation,
            thinking=thinking_text,
            suggestions=None,
            changes=changes if changes else None,
            modified_latex=modified_latex
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el chat: {str(e)}")


async def _stream_chat(message: str, latex_content: str, conversation_history: List[Message]):
    """Generador para streaming de respuestas con thinking tokens y changes"""
    import logging
    logger = logging.getLogger(__name__)
    
    full_response = ""
    try:
        stream_generator = await ai_service.chat(
            user_message=message,
            latex_content=latex_content,
            conversation_history=conversation_history,
            stream=True,
            model=None
        )
        async for chunk in stream_generator:
            # chunk es un dict con 'type' y 'content'
            if chunk.get("type") == "response":
                full_response += chunk.get("content", "")
            yield f"data: {json.dumps(chunk)}\n\n"
        
        # After streaming complete, parse and send changes
        logger.info(f"Full response length: {len(full_response)}")
        explanation, changes = parse_llm_response(full_response)
        logger.info(f"Parsed changes count: {len(changes)}")
        
        if changes:
            modified_latex = apply_changes(latex_content, changes)
            changes_data = {
                "type": "changes",
                "changes": changes,
                "modified_latex": modified_latex
            }
            logger.info(f"Sending changes event with {len(changes)} changes")
            yield f"data: {json.dumps(changes_data)}\n\n"
        
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.error(f"Streaming error: {e}")
        error_data = json.dumps({'type': 'error', 'content': str(e)})
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

