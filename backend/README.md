# LaTeX AI Backend

Backend API para el asistente de IA especializado en documentos LaTeX. Proporciona funcionalidades similares a Cursor AI pero específicamente diseñadas para trabajar con LaTeX.

## 🚀 Características

- **Chat Inteligente**: Conversación contextual sobre documentos LaTeX
- **Análisis de Documentos**: Detección de errores, advertencias y sugerencias
- **Mejora Automática**: Optimización de escritura, formato, ecuaciones y estructura
- **Ollama Integration**: Usa modelos de IA locales ejecutados con Ollama
- **Listado de Modelos**: Endpoint para listar modelos disponibles usando `ollama list`
- **Streaming**: Respuestas en tiempo real mediante Server-Sent Events
- **API RESTful**: Endpoints bien documentados con FastAPI

## 📋 Requisitos

- Python 3.10 o superior
- pip para gestión de dependencias
- **Ollama instalado** (https://ollama.ai)
- Al menos un modelo de Ollama descargado (ej: `ollama pull llama2`)

## 🛠️ Instalación

1. **Clonar el repositorio** (si aún no lo has hecho):
```bash
cd /Users/testnico/Documents/GitHub/TeXai
```

2. **Crear entorno virtual**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

3. **Instalar dependencias**:
```bash
pip install -r requirements.txt
```

4. **Instalar y configurar Ollama**:
```bash
# Instalar Ollama desde https://ollama.ai
# O usando Homebrew (macOS):
brew install ollama

# Iniciar Ollama (si no está corriendo como servicio)
ollama serve

# Descargar un modelo (ejemplo con llama2)
ollama pull llama2
```

5. **Configurar variables de entorno**:
```bash
cp .env.example .env
# Editar .env si necesitas cambiar la URL o modelo por defecto
```

## 🏃 Ejecución

### Modo Desarrollo
```bash
python main.py
```

O usando uvicorn directamente:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

El servidor estará disponible en: `http://localhost:8000`

### Documentación de la API
Una vez ejecutando, puedes acceder a:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 📡 Endpoints Principales

### 1. Chat con el Asistente
```http
POST /api/v1/chat
Content-Type: application/json

{
  "message": "Mejora la introducción de mi documento",
  "latex_content": "\\documentclass{article}...",
  "conversation_history": [],
  "stream": false
}
```

### 2. Análisis de Documento
```http
POST /api/v1/analyze
Content-Type: application/json

{
  "latex_content": "\\documentclass{article}..."
}
```

### 3. Mejora de Documento
```http
POST /api/v1/improve
Content-Type: application/json

{
  "latex_content": "\\documentclass{article}...",
  "improvement_type": "writing",
  "focus_areas": ["abstract", "introduction"]
}
```

### 4. Listar Modelos Disponibles
```http
GET /api/v1/models
```

### 5. Obtener Modelo Actual
```http
GET /api/v1/models/current
```

### 6. Health Check
```http
GET /health
```

## 🔧 Configuración

### Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `HOST` | Host del servidor | `0.0.0.0` |
| `PORT` | Puerto del servidor | `8000` |
| `DEBUG` | Modo debug | `False` |
| `OLLAMA_BASE_URL` | URL base de Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Modelo de Ollama por defecto | `llama2` |
| `MAX_TOKENS` | Máximo de tokens en respuesta | `4000` |
| `TEMPERATURE` | Temperatura del modelo | `0.7` |
| `MAX_LATEX_LENGTH` | Longitud máxima del documento | `50000` |

## 🏗️ Estructura del Proyecto

```
backend/
├── app/
│   ├── core/
│   │   └── config.py          # Configuración de la aplicación
│   ├── models/
│   │   └── schemas.py          # Modelos Pydantic
│   ├── routers/
│   │   ├── chat.py            # Endpoints de chat
│   │   ├── analyze.py         # Endpoints de análisis
│   │   └── improve.py         # Endpoints de mejora
│   └── services/
│       └── ai_service.py      # Servicio de IA
├── main.py                     # Aplicación principal
├── requirements.txt            # Dependencias
├── .env.example                # Ejemplo de variables de entorno
└── README.md                   # Este archivo
```

## 🧪 Testing

```bash
# Instalar dependencias de desarrollo
pip install pytest pytest-asyncio

# Ejecutar tests
pytest
```

## 🔌 Integración con Frontend

El frontend debe hacer requests a:
- Base URL: `http://localhost:8000`
- Endpoints: `/api/v1/chat`, `/api/v1/analyze`, `/api/v1/improve`

Ejemplo de integración en el frontend:
```typescript
const response = await fetch('http://localhost:8000/api/v1/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: userMessage,
    latex_content: latexContent,
    conversation_history: history,
    stream: false
  })
});

const data = await response.json();
```

## 🚀 Despliegue

### Docker (próximamente)
```bash
docker build -t latex-ai-backend .
docker run -p 8000:8000 --env-file .env latex-ai-backend
```

### Producción
Para producción, usar un servidor ASGI como:
- **Gunicorn + Uvicorn workers**
- **Docker + Nginx**
- **Cloud platforms** (Railway, Render, Fly.io)

## 📝 Notas

- **Ollama debe estar ejecutándose** antes de iniciar el backend
- Los modelos se ejecutan localmente, no requiere conexión a internet (excepto para descargar modelos)
- Para mejores resultados, se recomienda usar modelos grandes como `llama2`, `mistral`, `codellama`, etc.
- Puedes listar modelos disponibles con `ollama list` o usando el endpoint `/api/v1/models`
- Para cambiar el modelo, edita `OLLAMA_MODEL` en el archivo `.env` o usa el endpoint de modelos

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado.

## 🆘 Soporte

Para problemas o preguntas, abre un issue en el repositorio.

