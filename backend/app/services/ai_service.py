"""
Servicio de IA para procesamiento de documentos LaTeX
Usa Ollama para ejecutar modelos de IA localmente
"""

import os
import json
import re
import subprocess
from typing import List, Optional, AsyncGenerator, Dict, Any, Tuple
from app.core.config import settings
from app.models.schemas import Message, MessageRole


def parse_llm_response(response_text: str) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Parse LLM response to extract explanation and JSON changes.
    
    Returns:
        Tuple of (explanation_text, list_of_changes)
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Try to find JSON block in response (various formats)
    # Pattern 1: ```json ... ```
    json_match = re.search(r'```json\s*([\s\S]*?)```', response_text)
    
    if json_match:
        json_str = json_match.group(1).strip()
        logger.info(f"Found JSON block: {json_str[:200]}...")
        try:
            data = json.loads(json_str)
            changes = data.get("changes", [])
            # Get explanation (everything before the JSON block)
            explanation = response_text[:json_match.start()].strip()
            logger.info(f"Parsed {len(changes)} changes successfully")
            return explanation, changes
        except json.JSONDecodeError as e:
            logger.warning(f"JSON decode error: {e}")
            pass
    
    # Pattern 2: Look for {"changes": [...]} anywhere
    json_match = re.search(r'\{\s*"changes"\s*:\s*\[[\s\S]*?\]\s*\}', response_text)
    if json_match:
        try:
            data = json.loads(json_match.group())
            changes = data.get("changes", [])
            explanation = response_text[:json_match.start()].strip()
            logger.info(f"Parsed {len(changes)} changes from raw JSON")
            return explanation, changes
        except json.JSONDecodeError as e:
            logger.warning(f"Raw JSON decode error: {e}")
            pass
    
    # No JSON found - return full response as explanation with no changes
    logger.info("No JSON changes found in response")
    return response_text, []


def apply_changes(original: str, changes: List[Dict[str, Any]]) -> str:
    """
    Apply a list of changes to the original LaTeX document.
    
    Each change is a dict with:
    - type: "replace" | "delete" | "insert_after"
    - search: exact text to find
    - replace: new text (for "replace")
    - content: text to insert (for "insert_after")
    
    Returns:
        Modified document string
    """
    result = original
    
    for change in changes:
        change_type = change.get("type", "")
        search = change.get("search", "")
        
        if not search:
            continue
            
        if change_type == "replace":
            replace_with = change.get("replace", "")
            result = result.replace(search, replace_with, 1)
            
        elif change_type == "delete":
            result = result.replace(search, "", 1)
            
        elif change_type == "insert_after":
            content = change.get("content", "")
            idx = result.find(search)
            if idx >= 0:
                insert_pos = idx + len(search)
                result = result[:insert_pos] + content + result[insert_pos:]
    
    return result

class AIService:
    """Servicio principal de IA usando Ollama"""
    
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL
        self._init_ollama()
    
    def _init_ollama(self):
        """Inicializa cliente de Ollama"""
        try:
            import ollama
            self.client = ollama.AsyncClient(host=self.base_url)
        except ImportError:
            raise ImportError("ollama no está instalado. Ejecuta: pip install ollama")
        except Exception as e:
            raise ConnectionError(f"No se pudo conectar a Ollama en {self.base_url}. Asegúrate de que Ollama esté ejecutándose. Error: {str(e)}")
    
    def get_available_models(self) -> List[dict]:
        """
        Obtiene la lista de modelos disponibles usando 'ollama list'
        
        Returns:
            Lista de modelos disponibles con su información
        """
        try:
            result = subprocess.run(
                ["ollama", "list"],
                capture_output=True,
                text=True,
                check=True
            )
            
            models = []
            lines = result.stdout.strip().split('\n')
            
            # Saltar la línea de encabezado
            for line in lines[1:]:
                if line.strip():
                    parts = line.split()
                    if len(parts) >= 2:
                        model_name = parts[0]
                        size = parts[1] if len(parts) > 1 else "N/A"
                        modified = parts[2] if len(parts) > 2 else "N/A"
                        digest = parts[3] if len(parts) > 3 else "N/A"
                        
                        models.append({
                            "name": model_name,
                            "size": size,
                            "modified": modified,
                            "digest": digest
                        })
            
            return models
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Error al ejecutar 'ollama list': {str(e)}")
        except FileNotFoundError:
            raise FileNotFoundError("Ollama no está instalado o no está en el PATH")
    
    def _build_system_prompt(self) -> str:
        """Construye el prompt del sistema para el asistente de LaTeX"""
        return """You are an expert LaTeX assistant. You help users modify their LaTeX documents.

RESPONSE FORMAT:
- For questions about the document: Answer naturally in the user's language.
- For modification requests: Return a JSON block with changes.

WHEN MODIFYING THE DOCUMENT, respond with:
1. A brief explanation of what you'll change (1-2 sentences)
2. A JSON block with the exact changes:

```json
{
  "changes": [
    {"type": "replace", "search": "exact old text", "replace": "new text"},
    {"type": "delete", "search": "exact text to remove"},
    {"type": "insert_after", "search": "text to find", "content": "text to insert after it"}
  ]
}
```

STRICT RULES:
- "search" MUST be EXACT text copied from the document (character-perfect match)
- Keep changes minimal - only the specific lines that need to change
- NEVER return the full document
- For multi-line search/replace, include the exact lines with newlines
- Use "replace" for modifications, "delete" for removals, "insert_after" for additions
- Respond in the user's language for explanations"""
    
    def _prepare_messages(
        self, 
        user_message: str, 
        latex_content: str,
        conversation_history: Optional[List[Message]] = None
    ) -> str:
        """
        Prepara el prompt completo para Ollama
        Ollama usa un formato de prompt simple, no mensajes estructurados
        """
        system_prompt = self._build_system_prompt()
        
        # Construir historial de conversación
        history_text = ""
        if conversation_history:
            for msg in conversation_history:
                role_prefix = "Usuario" if msg.role == MessageRole.USER else "Asistente"
                history_text += f"{role_prefix}: {msg.content}\n\n"
        
        # Construir prompt completo
        full_prompt = f"""{system_prompt}

{history_text}Documento LaTeX actual:

```latex
{latex_content}
```

Usuario: {user_message}

Asistente:"""
        
        return full_prompt
    
    async def chat(
        self,
        user_message: str,
        latex_content: str,
        conversation_history: Optional[List[Message]] = None,
        stream: bool = False,
        model: Optional[str] = None
    ) -> dict:
        """
        Envía un mensaje al asistente de IA usando Ollama
        
        Args:
            user_message: Mensaje del usuario
            latex_content: Contenido completo del documento LaTeX
            conversation_history: Historial de conversación previo
            stream: Si se debe hacer streaming
            model: Modelo a usar (opcional, usa el por defecto si no se especifica)
        
        Returns:
            Dict con response y thinking (para modelos CoT como DeepSeek R1)
            En modo stream, retorna generador con chunks tipados
        """
        prompt = self._prepare_messages(user_message, latex_content, conversation_history)
        model_to_use = model or self.model
        
        try:
            if stream:
                async def generate():
                    """
                    Genera chunks tipados para streaming.
                    Cada chunk tiene: type ('thinking' o 'response'), content (texto)
                    """
                    # Ollama AsyncClient.generate with stream=True returns an async generator
                    stream_response = await self.client.generate(
                        model=model_to_use,
                        prompt=prompt,
                        stream=True,
                        options={
                            "temperature": settings.TEMPERATURE,
                            "num_predict": settings.MAX_TOKENS
                        }
                    )
                    async for chunk in stream_response:
                        # Para modelos CoT como DeepSeek R1, Ollama envía
                        # 'thinking' en chunks separados antes de 'response'
                        if chunk.get("thinking"):
                            yield {"type": "thinking", "content": chunk["thinking"]}
                        if chunk.get("response"):
                            yield {"type": "response", "content": chunk["response"]}
                return generate()
            else:
                response = await self.client.generate(
                    model=model_to_use,
                    prompt=prompt,
                    stream=False,
                    options={
                        "temperature": settings.TEMPERATURE,
                        "num_predict": settings.MAX_TOKENS
                    }
                )
                return {
                    "response": response.get("response", ""),
                    "thinking": response.get("thinking", None)  # CoT thinking tokens
                }
        except Exception as e:
            raise RuntimeError(f"Error al comunicarse con Ollama: {str(e)}")
    
    async def analyze_latex(self, latex_content: str, model: Optional[str] = None) -> dict:
        """
        Analiza un documento LaTeX y encuentra errores, advertencias y sugerencias
        
        Returns:
            Dict con errores, advertencias, sugerencias, estructura y estadísticas
        """
        analysis_prompt = f"""Eres un experto analizador de documentos LaTeX. Analiza el siguiente documento y proporciona un análisis detallado en formato JSON:

```latex
{latex_content}
```

Proporciona:
1. Errores de sintaxis o lógica (con línea y mensaje)
2. Advertencias sobre mejores prácticas
3. Sugerencias de mejora
4. Estructura del documento (secciones, ecuaciones, referencias, etc.)
5. Estadísticas (número de palabras, ecuaciones, figuras, etc.)

Responde SOLO con un JSON válido con esta estructura:
{{
    "errors": [{{"line": int, "message": str, "severity": "error|warning|info", "suggestion": str}}],
    "warnings": [{{"line": int, "message": str, "suggestion": str}}],
    "suggestions": [str],
    "structure": {{"sections": [], "equations": int, "figures": int, "tables": int}},
    "statistics": {{"words": int, "equations": int, "figures": int, "tables": int, "sections": int}}
}}"""
        
        model_to_use = model or self.model
        
        try:
            response = await self.client.generate(
                model=model_to_use,
                prompt=analysis_prompt,
                stream=False,
                options={
                    "temperature": 0.3,  # Más determinístico para análisis
                    "num_predict": settings.MAX_TOKENS
                }
            )
            
            response_text = response.get("response", "")
            # Extraer JSON de la respuesta
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return {"errors": [], "warnings": [], "suggestions": [], "structure": {}, "statistics": {}}
        except Exception as e:
            raise RuntimeError(f"Error al analizar documento: {str(e)}")
    
    async def improve_latex_stream(
        self,
        latex_content: str,
        improvement_type: str = "all",
        user_message: Optional[str] = None,
        focus_areas: Optional[List[str]] = None,
        model: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Mejora un documento LaTeX con streaming.
        Genera chunks con: type ('thinking', 'message', 'code'), content.
        """
        # Build the instruction based on user message or improvement type
        if user_message:
            instruction = user_message
        else:
            instruction = f"Improve the document (type: {improvement_type})"
        
        improvement_prompt = f"""You are an expert LaTeX assistant.
CURRENT DOCUMENT:
{latex_content}

USER REQUEST: {instruction}

INSTRUCTIONS:
1. First, provide a brief explanation of the changes you are going to make.
2. Then, provide the COMPLETE modified LaTeX document.
3. Wrap the LaTeX code in a markdown block: ```latex ... ```
4. The document must be complete (start with \\documentclass and end with \\end{{document}}).

Response structure:
<Explanation of changes without any headers>
```latex
[Complete modified LaTeX code]
```

IMPORTANT: Do not include headers like "[Explanation of changes]" or "**Explanation:**". Start directly with the explanation text.
"""
        model_to_use = model or self.model
        
        try:
            stream_response = await self.client.generate(
                model=model_to_use,
                prompt=improvement_prompt,
                stream=True,
                options={
                    "temperature": settings.TEMPERATURE,
                    "num_predict": settings.MAX_TOKENS
                }
            )
            
            buffer = ""
            header_checked = False
            
            async for chunk in stream_response:
                # Handle thinking tokens
                if chunk.get("thinking"):
                    yield {"type": "thinking", "content": chunk["thinking"]}
                
                # Handle response text
                if chunk.get("response"):
                    content = chunk["response"]
                    
                    if not header_checked:
                        buffer += content
                        # Wait for a reasonable buffer size or newline to check for headers
                        if len(buffer) > 100 or "\n" in buffer:
                            # List of headers to strip (case insensitive)
                            headers_to_strip = [
                                r'^\[Explanation of changes\]\s*',
                                r'^\*\*Explicació dels canvis:\*\*\s*',
                                r'^\*\*Explanation of changes:\*\*\s*',
                                r'^\*\*Explanation:\*\*\s*',
                                r'^\*\*Document modificado:\*\*\s*',
                                r'^\*\*Modified document:\*\*\s*'
                            ]
                            
                            cleaned_buffer = buffer
                            import re
                            for pattern in headers_to_strip:
                                cleaned_buffer = re.sub(pattern, '', cleaned_buffer, flags=re.IGNORECASE).lstrip()
                            
                            if cleaned_buffer:
                                yield {"type": "content", "content": cleaned_buffer}
                            
                            buffer = ""
                            header_checked = True
                    else:
                        yield {"type": "content", "content": content}

            # Flush any remaining buffer if we never hit the check condition (short response)
            if not header_checked and buffer:
                # Apply same cleaning just in case
                headers_to_strip = [
                    r'^\[Explanation of changes\]\s*',
                    r'^\*\*Explicació dels canvis:\*\*\s*',
                    r'^\*\*Explanation of changes:\*\*\s*',
                    r'^\*\*Explanation:\*\*\s*',
                    r'^\*\*Document modificado:\*\*\s*',
                    r'^\*\*Modified document:\*\*\s*'
                ]
                cleaned_buffer = buffer
                import re
                for pattern in headers_to_strip:
                    cleaned_buffer = re.sub(pattern, '', cleaned_buffer, flags=re.IGNORECASE).lstrip()
                if cleaned_buffer:
                    yield {"type": "content", "content": cleaned_buffer}
                    
        except Exception as e:
            raise RuntimeError(f"Error improving document: {str(e)}")

    # Mantener método antiguo por compatibilidad si es necesario, o eliminarlo/wrapper
    async def improve_latex(self, *args, **kwargs):
        """Deprecated: Use improve_latex_stream instead"""
        # Collect full stream for legacy callers
        full_response = ""
        full_thinking = ""
        generator = self.improve_latex_stream(*args, **kwargs)
        
        async for chunk in generator:
            if chunk["type"] == "content":
                full_response += chunk["content"]
            elif chunk["type"] == "thinking":
                full_thinking += chunk["content"]
        
        # Parse result similar to before
        improved_latex = None
        latex_blocks = re.findall(r'```(?:latex)?\s*\n?(.*?)\n?```', full_response, re.DOTALL)
        for block in latex_blocks:
             if '\\documentclass' in block:
                improved_latex = block.strip()
                break
        
        if not improved_latex:
             # Fallback logic...
             if '\\documentclass' in full_response:
                 improved_latex = full_response # Simplification for now
        
        explanation = full_response
        if improved_latex:
            explanation = full_response.replace(improved_latex, "[Code Block]").replace("```latex", "").replace("```", "")

        return {
            "improved_latex": improved_latex or kwargs.get("latex_content", ""),
            "changes": [],
            "explanation": explanation.strip()
        }
    
    def _generate_change_summary(self, original: str, modified: str) -> str:
        """Genera un resumen de los cambios realizados"""
        original_lines = set(original.split('\n'))
        modified_lines = set(modified.split('\n'))
        
        added = len(modified_lines - original_lines)
        removed = len(original_lines - modified_lines)
        
        if added == 0 and removed == 0:
            return "No significant changes detected."
        
        parts = []
        if added > 0:
            parts.append(f"{added} lines added")
        if removed > 0:
            parts.append(f"{removed} lines removed")
        
        return f"Changes: {', '.join(parts)}."


# Instancia global del servicio
ai_service = AIService()

