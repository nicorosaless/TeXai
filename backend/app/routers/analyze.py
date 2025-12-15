"""
Router para análisis de documentos LaTeX
"""

from fastapi import APIRouter, HTTPException

from app.models.schemas import AnalysisRequest, AnalysisResponse
from app.services.ai_service import ai_service
from app.core.config import settings

router = APIRouter()


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_latex(request: AnalysisRequest):
    """
    Analiza un documento LaTeX y encuentra errores, advertencias y sugerencias
    
    Retorna:
    - Errores de sintaxis y lógica
    - Advertencias sobre mejores prácticas
    - Sugerencias de mejora
    - Estructura del documento
    - Estadísticas (palabras, ecuaciones, figuras, etc.)
    """
    try:
        # Validar longitud
        if len(request.latex_content) > settings.MAX_LATEX_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"El documento LaTeX es demasiado largo (máximo {settings.MAX_LATEX_LENGTH} caracteres)"
            )
        
        # Realizar análisis
        analysis = await ai_service.analyze_latex(request.latex_content)
        
        # Formatear respuesta
        return AnalysisResponse(
            errors=analysis.get("errors", []),
            warnings=analysis.get("warnings", []),
            suggestions=analysis.get("suggestions", []),
            structure=analysis.get("structure", {}),
            statistics=analysis.get("statistics", {})
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al analizar el documento: {str(e)}")

