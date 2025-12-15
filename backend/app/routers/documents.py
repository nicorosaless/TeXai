"""
Router para gestión de documentos
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from app.services.database import document_service, conversation_service

router = APIRouter()


class CreateDocumentRequest(BaseModel):
    name: str
    content: str


class UpdateDocumentRequest(BaseModel):
    content: str
    description: Optional[str] = None


class DocumentResponse(BaseModel):
    id: str
    name: str
    content: Optional[str] = None
    created_at: str
    updated_at: str


class DocumentListResponse(BaseModel):
    id: str
    name: str
    created_at: str
    updated_at: str


@router.post("/documents", response_model=DocumentResponse)
async def create_document(request: CreateDocumentRequest):
    """Crea un nuevo documento"""
    try:
        doc = await document_service.create(request.name, request.content)
        return DocumentResponse(**doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents", response_model=List[DocumentListResponse])
async def list_documents():
    """Lista todos los documentos"""
    try:
        docs = await document_service.list_all()
        return [DocumentListResponse(**doc) for doc in docs]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str):
    """Obtiene un documento por ID"""
    doc = await document_service.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse(**doc)


@router.put("/documents/{doc_id}", response_model=DocumentResponse)
async def update_document(doc_id: str, request: UpdateDocumentRequest):
    """Actualiza un documento"""
    doc = await document_service.update(doc_id, request.content, request.description)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse(**doc)


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Elimina un documento"""
    success = await document_service.delete(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}


@router.get("/documents/{doc_id}/versions")
async def get_document_versions(doc_id: str):
    """Obtiene el historial de versiones de un documento"""
    versions = await document_service.get_versions(doc_id)
    return versions

