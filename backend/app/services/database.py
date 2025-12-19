"""
Servicio de base de datos SQLite para almacenar documentos LaTeX
"""

import aiosqlite
import os
from datetime import datetime
from typing import List, Optional
import json
import uuid

# Ruta de la base de datos
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "texai.db")


async def init_database():
    """Inicializa la base de datos y crea las tablas necesarias"""
    # Crear directorio de datos si no existe
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    async with aiosqlite.connect(DB_PATH) as db:
        # Tabla de documentos
        await db.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        # Tabla de historial de versiones
        await db.execute("""
            CREATE TABLE IF NOT EXISTS document_versions (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                content TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents(id)
            )
        """)
        
        # Tabla de conversaciones
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents(id)
            )
        """)
        
        # Tabla de mensajes
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                modified_latex TEXT,
                status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            )
        """)
        
        # Tabla de configuración (API keys, etc)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        await db.commit()


class DocumentService:
    """Servicio para gestionar documentos"""
    
    @staticmethod
    async def create(name: str, content: str) -> dict:
        """Crea un nuevo documento"""
        doc_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT INTO documents (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (doc_id, name, content, now, now)
            )
            
            # Crear versión inicial
            version_id = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO document_versions (id, document_id, content, description, created_at) VALUES (?, ?, ?, ?, ?)",
                (version_id, doc_id, content, "Initial version", now)
            )
            
            await db.commit()
        
        return {
            "id": doc_id,
            "name": name,
            "content": content,
            "created_at": now,
            "updated_at": now
        }
    
    @staticmethod
    async def get(doc_id: str) -> Optional[dict]:
        """Obtiene un documento por ID"""
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM documents WHERE id = ?",
                (doc_id,)
            )
            row = await cursor.fetchone()
            
            if row:
                return dict(row)
            return None
    
    @staticmethod
    async def update(doc_id: str, content: str, description: str = None) -> Optional[dict]:
        """Actualiza un documento y guarda la versión anterior"""
        now = datetime.utcnow().isoformat()
        
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            
            # Obtener documento actual
            cursor = await db.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
            row = await cursor.fetchone()
            
            if not row:
                return None
            
            # Guardar versión anterior
            version_id = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO document_versions (id, document_id, content, description, created_at) VALUES (?, ?, ?, ?, ?)",
                (version_id, doc_id, content, description or "Updated", now)
            )
            
            # Actualizar documento
            await db.execute(
                "UPDATE documents SET content = ?, updated_at = ? WHERE id = ?",
                (content, now, doc_id)
            )
            
            await db.commit()
            
            return {
                "id": doc_id,
                "name": row["name"],
                "content": content,
                "created_at": row["created_at"],
                "updated_at": now
            }
    
    @staticmethod
    async def list_all() -> List[dict]:
        """Lista todos los documentos"""
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT id, name, created_at, updated_at FROM documents ORDER BY updated_at DESC"
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    
    @staticmethod
    async def delete(doc_id: str) -> bool:
        """Elimina un documento"""
        async with aiosqlite.connect(DB_PATH) as db:
            # Eliminar mensajes
            await db.execute(
                "DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE document_id = ?)",
                (doc_id,)
            )
            # Eliminar conversaciones
            await db.execute("DELETE FROM conversations WHERE document_id = ?", (doc_id,))
            # Eliminar versiones
            await db.execute("DELETE FROM document_versions WHERE document_id = ?", (doc_id,))
            # Eliminar documento
            cursor = await db.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
            await db.commit()
            return cursor.rowcount > 0
    
    @staticmethod
    async def get_versions(doc_id: str) -> List[dict]:
        """Obtiene todas las versiones de un documento"""
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM document_versions WHERE document_id = ? ORDER BY created_at DESC",
                (doc_id,)
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


class ConversationService:
    """Servicio para gestionar conversaciones"""
    
    @staticmethod
    async def create(document_id: str) -> dict:
        """Crea una nueva conversación"""
        conv_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT INTO conversations (id, document_id, created_at) VALUES (?, ?, ?)",
                (conv_id, document_id, now)
            )
            await db.commit()
        
        return {
            "id": conv_id,
            "document_id": document_id,
            "created_at": now
        }
    
    @staticmethod
    async def add_message(
        conversation_id: str, 
        role: str, 
        content: str, 
        modified_latex: str = None,
        status: str = "pending"
    ) -> dict:
        """Añade un mensaje a la conversación"""
        msg_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT INTO messages (id, conversation_id, role, content, modified_latex, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (msg_id, conversation_id, role, content, modified_latex, status, now)
            )
            await db.commit()
        
        return {
            "id": msg_id,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "modified_latex": modified_latex,
            "status": status,
            "created_at": now
        }
    
    @staticmethod
    async def get_messages(conversation_id: str) -> List[dict]:
        """Obtiene todos los mensajes de una conversación"""
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
                (conversation_id,)
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    
    @staticmethod
    async def update_message_status(message_id: str, status: str) -> bool:
        """Actualiza el estado de un mensaje"""
        async with aiosqlite.connect(DB_PATH) as db:
            cursor = await db.execute(
                "UPDATE messages SET status = ? WHERE id = ?",
                (status, message_id)
            )
            await db.commit()
            return cursor.rowcount > 0


class SettingsService:
    """Servicio para gestionar configuración global"""
    
    @staticmethod
    async def set(key: str, value: str):
        """Establece un valor de configuración"""
        now = datetime.utcnow().isoformat()
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
                (key, value, now)
            )
            await db.commit()
            
    @staticmethod
    async def get(key: str) -> Optional[str]:
        """Obtiene un valor de configuración"""
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT value FROM settings WHERE key = ?", (key,))
            row = await cursor.fetchone()
            if row:
                return row["value"]
            return None

    @staticmethod
    async def list_all() -> dict:
        """Lista toda la configuración"""
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT key, value FROM settings")
            rows = await cursor.fetchall()
            return {row["key"]: row["value"] for row in rows}


# Instancias de servicios
document_service = DocumentService()
conversation_service = ConversationService()
settings_service = SettingsService()

