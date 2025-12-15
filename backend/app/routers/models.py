"""
Router para gestión de modelos de Ollama
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict
from app.services.ai_service import ai_service

router = APIRouter()


@router.get("/models", response_model=List[Dict])
async def list_models():
    """
    Lista todos los modelos disponibles en Ollama
    
    Usa 'ollama list' para obtener la lista de modelos instalados
    """
    try:
        models = ai_service.get_available_models()
        return models
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail="Ollama no está instalado o no está en el PATH. Por favor, instala Ollama desde https://ollama.ai"
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Error al obtener la lista de modelos: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado: {str(e)}"
        )


@router.get("/models/current")
async def get_current_model():
    """
    Obtiene el modelo actualmente configurado
    """
    return {
        "model": ai_service.model,
        "base_url": ai_service.base_url
    }


@router.post("/models/current")
async def set_current_model(model_name: str):
    """
    Sets the current model to use for AI operations
    """
    ai_service.model = model_name
    return {
        "model": ai_service.model,
        "status": "updated"
    }
