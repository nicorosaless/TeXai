"""
Router para mejorar documentos LaTeX
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional

from app.models.schemas import ImproveRequest, ImproveResponse
from app.services.ai_service import ai_service
from app.core.config import settings

router = APIRouter()


@router.post("/improve", response_model=ImproveResponse)
async def improve_latex(request: ImproveRequest):
    """
    Mejora un documento LaTeX según el tipo solicitado
    
    Tipos de mejora disponibles:
    - writing: Mejora la escritura y redacción
    - formatting: Mejora el formato y estructura visual
    - equations: Optimiza ecuaciones matemáticas
    - structure: Mejora la estructura del documento
    - all: Mejora todo lo anterior
    """
    try:
        # Validar longitud
        if len(request.latex_content) > settings.MAX_LATEX_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"El documento LaTeX es demasiado largo (máximo {settings.MAX_LATEX_LENGTH} caracteres)"
            )
        
        # Validar tipo de mejora
        valid_types = ["writing", "formatting", "equations", "structure", "all"]
        if request.improvement_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo de mejora inválido. Debe ser uno de: {', '.join(valid_types)}"
            )
        
        # Realizar mejora
        if request.stream:
            from fastapi.responses import StreamingResponse
            import json

            async def improve_generator():
                async for chunk in ai_service.improve_latex_stream(
                    latex_content=request.latex_content,
                    improvement_type=request.improvement_type,
                    user_message=request.user_message,
                    focus_areas=request.focus_areas
                ):
                    yield f"data: {json.dumps(chunk)}\n\n"
                yield "data: [DONE]\n\n"

            return StreamingResponse(
                improve_generator(),
                media_type="text/event-stream"
            )

        # Standard request
        result = await ai_service.improve_latex(
            latex_content=request.latex_content,
            improvement_type=request.improvement_type,
            user_message=request.user_message,
            focus_areas=request.focus_areas
        )
        
        return ImproveResponse(
            improved_latex=result.get("improved_latex", request.latex_content),
            changes=result.get("changes", []),
            explanation=result.get("explanation", "Mejoras aplicadas")
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al mejorar el documento: {str(e)}")

