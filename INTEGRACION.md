# Integración Frontend-Backend

## ✅ Integración Completada

El frontend y backend están completamente conectados. El modelo local de Ollama puede ahora modificar código LaTeX directamente.

## 🚀 Cómo Usar

### 1. Iniciar el Backend

```bash
cd backend
./run.sh
```

O manualmente:
```bash
cd backend
source venv/bin/activate
python main.py
```

El backend estará disponible en `http://localhost:8000`

### 2. Iniciar el Frontend

```bash
cd frontend
npm install  # Solo la primera vez
npm run dev
```

El frontend estará disponible en `http://localhost:8080`

### 3. Usar el Asistente

1. **Chat Normal**: Escribe preguntas sobre tu documento LaTeX
2. **Mejoras Automáticas**: 
   - Haz clic en "Improve writing" para mejorar la escritura
   - Haz clic en "Fix errors" para corregir errores automáticamente
   - Escribe comandos como "mejora la introducción" o "fix errors"
3. **Aplicar Cambios**: Cuando el modelo devuelva código modificado, aparecerá un botón "Aplicar" para aplicar los cambios automáticamente

## 🔧 Funcionalidades Implementadas

### Frontend (`frontend/src/`)

- ✅ **Servicio API** (`services/api.ts`): Cliente para comunicarse con el backend
- ✅ **ChatPanel actualizado**: 
  - Conexión real con el backend
  - Detección automática de código LaTeX modificado
  - Botones para aplicar cambios
  - Manejo de errores y estados de carga
- ✅ **Proxy configurado**: Vite proxy para evitar problemas de CORS
- ✅ **Sugerencias inteligentes**: Las sugerencias ejecutan acciones automáticamente

### Backend (`backend/app/`)

- ✅ **Prompt mejorado**: El sistema ahora instruye al modelo a devolver código completo
- ✅ **Extracción de código**: Mejorada la extracción de código LaTeX de las respuestas
- ✅ **Endpoints funcionales**:
  - `/api/v1/chat` - Chat con el asistente
  - `/api/v1/analyze` - Análisis de documentos
  - `/api/v1/improve` - Mejora de documentos
  - `/api/v1/models` - Listar modelos disponibles

## 📝 Flujo de Trabajo

1. **Usuario escribe mensaje** → Frontend envía a `/api/v1/chat`
2. **Backend procesa con Ollama** → Modelo genera respuesta
3. **Backend extrae código LaTeX** → Si hay código modificado, lo extrae
4. **Frontend recibe respuesta** → Muestra mensaje y código modificado
5. **Usuario aplica cambios** → Código LaTeX se actualiza en el editor

## 🎯 Ejemplos de Uso

### Mejorar Escritura
```
Usuario: "Mejora la introducción de mi documento"
→ El modelo devuelve código LaTeX mejorado
→ Usuario hace clic en "Aplicar"
→ El código se actualiza automáticamente
```

### Corregir Errores
```
Usuario: Clic en "Fix errors"
→ Backend analiza el documento
→ Encuentra errores
→ Mejora el código para corregirlos
→ Usuario aplica los cambios
```

### Agregar Ecuaciones
```
Usuario: "Agrega una ecuación para el gradiente descendente"
→ Modelo genera código LaTeX con la ecuación
→ Código se muestra en el chat
→ Usuario puede aplicar o copiar manualmente
```

## ⚙️ Configuración

### Variables de Entorno

**Backend** (`.env`):
```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
```

**Frontend** (`.env`):
```env
VITE_API_URL=http://localhost:8000
```

## 🐛 Solución de Problemas

### El backend no responde
- Verifica que Ollama esté corriendo: `ollama serve`
- Verifica que el modelo esté instalado: `ollama list`
- Revisa los logs del backend

### Los cambios no se aplican
- Verifica que el modelo devuelva código en formato ````latex`
- Revisa la consola del navegador para errores
- Verifica que el backend esté accesible

### Errores de CORS
- El proxy de Vite debería manejar esto automáticamente
- Si persisten, verifica que el backend tenga CORS configurado correctamente

## 📚 Próximos Pasos

- [ ] Agregar streaming de respuestas en tiempo real
- [ ] Implementar historial de conversación persistente
- [ ] Agregar selección de modelo desde el frontend
- [ ] Mejorar la UI para mostrar cambios antes de aplicar
- [ ] Agregar modo de vista previa de cambios (diff)

