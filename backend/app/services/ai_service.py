"""
Servicio de IA para procesamiento de documentos LaTeX
Usa Ollama para ejecutar modelos de IA localmente
"""

import os
import json
import re
import subprocess
from typing import List, Optional, AsyncGenerator
from app.core.config import settings
from app.models.schemas import Message, MessageRole


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
        return """Eres un asistente experto en LaTeX especializado en ayudar a usuarios a crear, mejorar y corregir documentos LaTeX.

Tu objetivo es:
1. Entender el contexto del documento LaTeX proporcionado
2. Responder preguntas sobre el documento
3. Sugerir mejoras en escritura, formato y estructura
4. Corregir errores de sintaxis y lógica
5. Generar código LaTeX cuando sea necesario
6. Explicar conceptos de LaTeX de manera clara

IMPORTANTE:
- Siempre mantén el contexto del documento completo
- Cuando el usuario solicite mejoras, correcciones o cambios, SIEMPRE proporciona el código LaTeX completo modificado dentro de un bloque de código con formato: ```latex\n[código completo]\n```
- El código LaTeX modificado debe ser el documento COMPLETO, no solo fragmentos
- Sé preciso y técnico, pero también claro y educativo
- Si el usuario pide mejoras específicas, aplica los cambios directamente al código
- Responde en español si el usuario escribe en español, en inglés si escribe en inglés
- Cuando proporciones código modificado, incluye también una breve explicación de los cambios realizados"""
    
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
    ) -> str:
        """
        Envía un mensaje al asistente de IA usando Ollama
        
        Args:
            user_message: Mensaje del usuario
            latex_content: Contenido completo del documento LaTeX
            conversation_history: Historial de conversación previo
            stream: Si se debe hacer streaming
            model: Modelo a usar (opcional, usa el por defecto si no se especifica)
        
        Returns:
            Respuesta del asistente o generador si stream=True
        """
        prompt = self._prepare_messages(user_message, latex_content, conversation_history)
        model_to_use = model or self.model
        
        try:
            if stream:
                async def generate():
                    async for chunk in self.client.generate(
                        model=model_to_use,
                        prompt=prompt,
                        stream=True,
                        options={
                            "temperature": settings.TEMPERATURE,
                            "num_predict": settings.MAX_TOKENS
                        }
                    ):
                        if chunk.get("response"):
                            yield chunk["response"]
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
                return response.get("response", "")
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
    
    async def improve_latex(
        self,
        latex_content: str,
        improvement_type: str = "all",
        focus_areas: Optional[List[str]] = None,
        model: Optional[str] = None
    ) -> dict:
        """
        Mejora un documento LaTeX según el tipo solicitado
        
        Returns:
            Dict con el LaTeX mejorado, cambios realizados y explicación
        """
        improvement_prompt = f"""You are an expert LaTeX document improver. Improve the following document.

CURRENT DOCUMENT:
{latex_content}

Improvement type: {improvement_type}

INSTRUCTIONS:
1. Make improvements to the LaTeX document based on the improvement type.
2. Return ONLY the improved LaTeX code, nothing else.
3. The response must start with \\documentclass and end with \\end{{document}}
4. Do not include any explanations, just the LaTeX code.
5. Keep the same document structure but improve the content.

Return the complete improved LaTeX document now:"""
        
        model_to_use = model or self.model
        
        try:
            response = await self.client.generate(
                model=model_to_use,
                prompt=improvement_prompt,
                stream=False,
                options={
                    "temperature": settings.TEMPERATURE,
                    "num_predict": settings.MAX_TOKENS
                }
            )
            
            response_text = response.get("response", "").strip()
            
            # Extraer el código LaTeX mejorado
            improved_latex = None
            
            # Método 1: Buscar bloques de código
            latex_blocks = re.findall(r'```(?:latex)?\s*\n?(.*?)\n?```', response_text, re.DOTALL)
            for block in latex_blocks:
                if '\\documentclass' in block or '\\begin{document}' in block:
                    improved_latex = block.strip()
                    break
            
            # Método 2: Si no hay bloques, buscar directamente el documento
            if not improved_latex:
                # Buscar desde \documentclass hasta \end{document}
                doc_match = re.search(r'(\\documentclass.*?\\end\{document\})', response_text, re.DOTALL)
                if doc_match:
                    improved_latex = doc_match.group(1).strip()
            
            # Método 3: Si la respuesta completa parece ser LaTeX
            if not improved_latex and '\\documentclass' in response_text:
                improved_latex = response_text.strip()
                # Limpiar posibles artefactos
                improved_latex = re.sub(r'^```(?:latex)?\s*\n?', '', improved_latex)
                improved_latex = re.sub(r'\n?```\s*$', '', improved_latex)
            
            # Limpiar el código
            if improved_latex:
                improved_latex = improved_latex.strip()
                # Asegurar que empieza y termina correctamente
                if not improved_latex.startswith('\\documentclass'):
                    # Intentar encontrar el inicio
                    start_idx = improved_latex.find('\\documentclass')
                    if start_idx >= 0:
                        improved_latex = improved_latex[start_idx:]
            
            # Si no se encontró código válido, usar el original
            if not improved_latex or '\\documentclass' not in improved_latex:
                return {
                    "improved_latex": latex_content,
                    "changes": [],
                    "explanation": "Could not generate improvements. Document unchanged."
                }
            
            # Generar explicación basada en los cambios
            explanation = self._generate_change_summary(latex_content, improved_latex)
            
            return {
                "improved_latex": improved_latex,
                "changes": [],
                "explanation": explanation
            }
        except Exception as e:
            raise RuntimeError(f"Error improving document: {str(e)}")
    
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

