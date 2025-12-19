"""
LaTeX AI Backend - API principal
Sistema de IA especializado en asistencia para documentos LaTeX
"""

from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
from typing import List, Optional
import os
from dotenv import load_dotenv

from app.routers import chat, analyze, improve, models, documents, settings as settings_router
from app.core.config import settings
from app.services.database import init_database

# Cargar variables de entorno
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa la base de datos al iniciar"""
    await init_database()
    yield

# Crear aplicación FastAPI
app = FastAPI(
    title="LaTeX AI Companion API",
    description="API backend para asistencia inteligente con documentos LaTeX",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(analyze.router, prefix="/api/v1", tags=["analyze"])
app.include_router(improve.router, prefix="/api/v1", tags=["improve"])
app.include_router(models.router, prefix="/api/v1", tags=["models"])
app.include_router(settings_router.router, prefix="/api/v1", tags=["settings"])
app.include_router(documents.router, prefix="/api/v1", tags=["documents"])


@app.get("/")
async def root():
    """Endpoint raíz"""
    return {
        "message": "LaTeX AI Companion API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "latex-ai-backend"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )

