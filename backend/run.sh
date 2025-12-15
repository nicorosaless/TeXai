#!/bin/bash

# Script para ejecutar el backend de LaTeX AI Companion
# Uso: ./run.sh

set -e  # Salir si hay algún error

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Directorio del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}=== LaTeX AI Backend ===${NC}\n"

# Verificar si Python está instalado
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 no está instalado${NC}"
    exit 1
fi

# Verificar versión de Python (necesita 3.10+)
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]); then
    echo -e "${RED}Error: Se requiere Python 3.10 o superior. Versión actual: $PYTHON_VERSION${NC}"
    exit 1
fi

echo -e "${GREEN}Python version: $PYTHON_VERSION${NC}"

# Verificar si existe entorno virtual
if [ -d "venv" ]; then
    echo -e "${YELLOW}Activando entorno virtual...${NC}"
    source venv/bin/activate
elif [ -d ".venv" ]; then
    echo -e "${YELLOW}Activando entorno virtual...${NC}"
    source .venv/bin/activate
else
    echo -e "${YELLOW}No se encontró entorno virtual. Creando uno...${NC}"
    python3 -m venv venv
    source venv/bin/activate
    echo -e "${GREEN}Entorno virtual creado${NC}"
fi

# Verificar si las dependencias están instaladas
if ! python3 -c "import fastapi" &> /dev/null; then
    echo -e "${YELLOW}Instalando dependencias...${NC}"
    pip install --upgrade pip
    pip install -r requirements.txt
    echo -e "${GREEN}Dependencias instaladas${NC}"
else
    echo -e "${GREEN}Dependencias verificadas${NC}"
fi

# Verificar si Ollama está instalado y corriendo
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}Advertencia: Ollama no está instalado o no está en el PATH${NC}"
    echo -e "${YELLOW}Instala Ollama desde: https://ollama.ai${NC}"
    echo -e "${YELLOW}El backend intentará conectarse de todas formas...${NC}\n"
else
    echo -e "${GREEN}Ollama encontrado${NC}"
    
    # Verificar si Ollama está corriendo
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}Ollama está corriendo${NC}"
    else
        echo -e "${YELLOW}Advertencia: Ollama no parece estar corriendo${NC}"
        echo -e "${YELLOW}Inicia Ollama con: ollama serve${NC}\n"
    fi
fi

# Cargar variables de entorno si existe .env
if [ -f ".env" ]; then
    echo -e "${GREEN}Cargando variables de entorno desde .env${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}No se encontró archivo .env, usando valores por defecto${NC}"
fi

echo -e "\n${GREEN}Iniciando servidor backend...${NC}"
echo -e "${GREEN}Servidor disponible en: http://localhost:8000${NC}"
echo -e "${GREEN}Documentación API en: http://localhost:8000/docs${NC}"
echo -e "${YELLOW}Presiona Ctrl+C para detener el servidor${NC}\n"

# Ejecutar el servidor
python3 main.py

