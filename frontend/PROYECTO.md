# LaTeX Companion - Editor de LaTeX con Asistente de IA

## Descripción del Proyecto

**LaTeX Companion** (también conocido como **LaTeX Copilot**) es una aplicación web moderna que proporciona un entorno completo para la edición de documentos LaTeX con asistencia de inteligencia artificial. La aplicación combina un editor de código avanzado, una vista previa en tiempo real y un panel de chat con IA para ayudar a los usuarios a crear, mejorar y corregir documentos LaTeX.

## Características Principales

### 1. **Editor de LaTeX** (`LatexEditor`)
- Editor de código con resaltado de sintaxis personalizado
- Numeración de líneas
- Resaltado de comandos LaTeX, corchetes y comentarios
- Sincronización de scroll entre el editor y el resaltado
- Funcionalidades adicionales:
  - **Copiar código**: Copia el contenido LaTeX al portapapeles
  - **Descargar archivo**: Exporta el documento como archivo `.tex`
  - **Gestión de imágenes**: Panel para subir y gestionar imágenes
  - **Drag & Drop**: Arrastra y suelta imágenes directamente en el editor
  - **Inserción automática**: Genera referencias LaTeX (`\includegraphics`) automáticamente

### 2. **Vista Previa en Tiempo Real** (`LatexPreview`)
- Renderizado en tiempo real del documento LaTeX a HTML
- Soporte para ecuaciones matemáticas usando **KaTeX**
- Renderizado de:
  - Títulos, autores y fechas (`\maketitle`)
  - Secciones y subsecciones
  - Abstract
  - Ecuaciones en línea y en bloque
  - Listas (itemize, enumerate)
  - Tablas básicas
  - Formato de texto (negrita, cursiva, subrayado)
  - Figuras e imágenes
- Controles de zoom (50% - 200%)
- Indicador de compilación en tiempo real

### 3. **Panel de Chat con IA** (`ChatPanel`)
- Asistente de IA integrado para ayudar con documentos LaTeX
- Sugerencias rápidas:
  - "Improve writing" (Mejorar escritura)
  - "Add equations" (Agregar ecuaciones)
  - "Fix errors" (Corregir errores)
- Interfaz de chat con mensajes del usuario y del asistente
- Panel colapsable para maximizar el espacio de trabajo
- Indicador de carga durante el procesamiento

## Arquitectura Técnica

### Stack Tecnológico

- **Frontend Framework**: React 18.3.1
- **Lenguaje**: TypeScript 5.8.3
- **Build Tool**: Vite 5.4.19
- **UI Components**: shadcn-ui (basado en Radix UI)
- **Estilos**: Tailwind CSS 3.4.17
- **Renderizado Matemático**: KaTeX 0.16.27
- **Routing**: React Router DOM 6.30.1
- **State Management**: React Query (TanStack Query) 5.83.0
- **Fuentes**: 
  - Inter (para UI)
  - JetBrains Mono (para código)

### Estructura del Proyecto

```
latex-companion/
├── src/
│   ├── components/
│   │   ├── ChatPanel.tsx          # Panel de chat con IA
│   │   ├── LatexEditor.tsx        # Editor de código LaTeX
│   │   ├── LatexPreview.tsx       # Vista previa renderizada
│   │   └── ui/                     # Componentes UI de shadcn
│   ├── pages/
│   │   ├── Index.tsx              # Página principal
│   │   └── NotFound.tsx           # Página 404
│   ├── hooks/                     # Hooks personalizados
│   ├── lib/                       # Utilidades
│   ├── App.tsx                    # Componente raíz
│   └── index.css                  # Estilos globales
├── public/                        # Archivos estáticos
└── package.json                   # Dependencias
```

### Componentes Principales

#### `Index.tsx`
- Componente principal que orquesta los tres paneles
- Maneja el estado del contenido LaTeX
- Gestiona la colapsión del panel de chat
- Proporciona un documento LaTeX de ejemplo por defecto

#### `ChatPanel.tsx`
- Interfaz de chat con mensajes
- Manejo de entrada de texto con soporte para Enter
- Sugerencias rápidas para acciones comunes
- Integración con el asistente de IA (actualmente con respuesta simulada)

#### `LatexEditor.tsx`
- Editor de texto con resaltado de sintaxis personalizado
- Sistema de gestión de imágenes con drag & drop
- Funciones de copiar y descargar
- Vista alterna entre editor e imágenes

#### `LatexPreview.tsx`
- Compilador LaTeX a HTML personalizado
- Renderizado de ecuaciones con KaTeX
- Soporte para múltiples elementos LaTeX
- Sistema de zoom y controles de vista

## Funcionalidades Detalladas

### Gestión de Imágenes
- Subida de imágenes mediante drag & drop o selección de archivos
- Vista previa de imágenes subidas
- Generación automática de referencias LaTeX
- Inserción automática en el documento
- Eliminación de imágenes

### Resaltado de Sintaxis
- Comandos LaTeX resaltados en azul
- Corchetes resaltados en naranja
- Comentarios en gris e itálica
- Numeración de líneas

### Renderizado LaTeX
El compilador personalizado soporta:
- Estructura básica de documentos (`\documentclass`, `\begin{document}`)
- Metadatos (`\title`, `\author`, `\date`)
- Secciones y subsecciones
- Formato de texto (`\textbf`, `\textit`, `\emph`, `\underline`)
- Ecuaciones matemáticas (inline y display)
- Listas ordenadas y no ordenadas
- Tablas básicas
- Figuras e imágenes
- Abstract

## Interfaz de Usuario

### Diseño
- Tema oscuro por defecto con colores personalizados
- Tres paneles principales en disposición horizontal:
  1. Panel de Chat (colapsable, 320px o 48px cuando está colapsado)
  2. Editor de LaTeX (flexible)
  3. Vista Previa (flexible)
- Scrollbars personalizados y delgados
- Animaciones suaves para transiciones

### Paleta de Colores
- Fondo oscuro con tonos cálidos (HSL)
- Acento primario en tonos dorados/amarillos
- Contraste adecuado para legibilidad
- Variables CSS personalizadas para fácil personalización

## Estado Actual

### Funcionalidades Implementadas
✅ Editor de código con resaltado de sintaxis  
✅ Vista previa en tiempo real  
✅ Panel de chat con interfaz completa  
✅ Gestión de imágenes con drag & drop  
✅ Exportación de archivos  
✅ Renderizado de ecuaciones matemáticas  
✅ Soporte para múltiples elementos LaTeX  

### Funcionalidades Pendientes/Mejoras
- Integración real con API de IA (actualmente simulado)
- Compilación LaTeX completa (actualmente renderizado parcial)
- Soporte para más comandos LaTeX
- Autocompletado en el editor
- Búsqueda y reemplazo
- Historial de cambios/undo-redo
- Exportación a PDF
- Temas personalizables
- Modo de pantalla completa

## Scripts Disponibles

```bash
npm run dev        # Inicia el servidor de desarrollo
npm run build      # Construye para producción
npm run build:dev  # Construye en modo desarrollo
npm run lint       # Ejecuta el linter
npm run preview    # Previsualiza la build de producción
```

## Configuración

- **Puerto de desarrollo**: 8080
- **Host**: `::` (todas las interfaces)
- **Alias de rutas**: `@` apunta a `./src`

## Dependencias Principales

- **React & React DOM**: Framework UI
- **Vite**: Build tool y dev server
- **TypeScript**: Tipado estático
- **Tailwind CSS**: Estilos utilitarios
- **Radix UI**: Componentes accesibles base
- **KaTeX**: Renderizado de matemáticas
- **React Router**: Navegación
- **React Query**: Gestión de estado del servidor
- **Lucide React**: Iconos

## Notas de Desarrollo

- El proyecto utiliza **Lovable** como plataforma de desarrollo
- Componentes UI basados en **shadcn-ui**
- Fuentes de Google Fonts (Inter y JetBrains Mono)
- Sistema de diseño consistente con variables CSS
- Componentes completamente tipados con TypeScript

## Uso

1. Instalar dependencias: `npm install`
2. Iniciar servidor de desarrollo: `npm run dev`
3. Abrir navegador en `http://localhost:8080`
4. Comenzar a editar el documento LaTeX de ejemplo
5. Usar el panel de chat para solicitar mejoras o correcciones
6. Ver la vista previa en tiempo real mientras editas

---

**Versión**: 0.0.0  
**Estado**: En desarrollo  
**Licencia**: Privada

