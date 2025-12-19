from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.database import settings_service

router = APIRouter()

class SettingUpdate(BaseModel):
    value: str

@router.get("/settings")
async def get_settings():
    """Obtiene toda la configuración (incluyendo API keys)"""
    return await settings_service.list_all()

@router.post("/settings/{key}")
async def update_setting(key: str, update: SettingUpdate):
    """Actualiza una configuración específica"""
    try:
        await settings_service.set(key, update.value)
        return {"status": "success", "key": key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/openrouter/available-models")
async def get_openrouter_models():
    """Obtiene la lista de modelos gratuitos de OpenRouter directamente del scraper"""
    try:
        from app.services.openrouter_scraper import get_free_openrouter_models
        models = await get_free_openrouter_models()
        return models
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
