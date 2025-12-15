"""
Ejemplo de uso de la API de LaTeX AI Backend
"""

import requests
import json

BASE_URL = "http://localhost:8000"

# Ejemplo de documento LaTeX
sample_latex = """\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}

\\title{Introduction to Machine Learning}
\\author{Maria Garcia}
\\date{December 2024}

\\begin{document}

\\maketitle

\\begin{abstract}
This document presents an introduction to the fundamental concepts of machine learning.
\\end{abstract}

\\section{Introduction}

Machine learning is a branch of artificial intelligence.

\\end{document}"""


def test_health():
    """Prueba el endpoint de health check"""
    response = requests.get(f"{BASE_URL}/health")
    print("Health Check:", response.json())


def test_list_models():
    """Lista los modelos disponibles"""
    response = requests.get(f"{BASE_URL}/api/v1/models")
    print("\nModelos disponibles:")
    print(json.dumps(response.json(), indent=2))


def test_chat():
    """Prueba el endpoint de chat"""
    payload = {
        "message": "Mejora la introducción de mi documento",
        "latex_content": sample_latex,
        "conversation_history": [],
        "stream": False
    }
    response = requests.post(f"{BASE_URL}/api/v1/chat", json=payload)
    print("\nRespuesta del chat:")
    print(response.json()["message"])


def test_analyze():
    """Prueba el endpoint de análisis"""
    payload = {
        "latex_content": sample_latex
    }
    response = requests.post(f"{BASE_URL}/api/v1/analyze", json=payload)
    print("\nAnálisis del documento:")
    print(json.dumps(response.json(), indent=2))


def test_improve():
    """Prueba el endpoint de mejora"""
    payload = {
        "latex_content": sample_latex,
        "improvement_type": "writing",
        "focus_areas": ["abstract", "introduction"]
    }
    response = requests.post(f"{BASE_URL}/api/v1/improve", json=payload)
    print("\nDocumento mejorado:")
    result = response.json()
    print("Explicación:", result["explanation"])
    print("\nLaTeX mejorado:")
    print(result["improved_latex"])


if __name__ == "__main__":
    print("=== Pruebas de LaTeX AI Backend ===\n")
    
    try:
        test_health()
        test_list_models()
        # Descomenta las siguientes líneas para probar los otros endpoints
        # test_chat()
        # test_analyze()
        # test_improve()
    except requests.exceptions.ConnectionError:
        print("Error: No se pudo conectar al servidor. Asegúrate de que el backend esté ejecutándose.")
    except Exception as e:
        print(f"Error: {e}")

