"""
Router para gestión de modelos de Ollama
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Optional
from app.services.ai_service import ai_service

router = APIRouter()


@router.get("/models", response_model=List[Dict])
async def list_models():
    """
    Lista todos los modelos disponibles (Ollama + OpenRouter Free + Configurados)
    """
    try:
        models = await ai_service.get_available_models()
        return models
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al listar modelos: {str(e)}"
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



