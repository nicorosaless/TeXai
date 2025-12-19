import httpx
import json
from typing import List, Dict

async def get_free_openrouter_models() -> List[Dict]:
    """
    Fetches the list of models from OpenRouter and filters for free ones.
    """
    url = "https://openrouter.ai/api/v1/models"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            data = response.json()
        
        models = data.get("data", [])
        free_models = []
        
        for model in models:
            pricing = model.get("pricing", {})
            # Check if prompt AND completion are free
            prompt_price = float(pricing.get("prompt", 0))
            completion_price = float(pricing.get("completion", 0))
            
            if prompt_price == 0 and completion_price == 0:
                free_models.append({
                    "id": model.get("id"),
                    "name": model.get("name"),
                    "description": model.get("description", ""),
                    "context_length": model.get("context_length", 0),
                    "provider": "openrouter"
                })
        
        return free_models
    except Exception as e:
        print(f"Error fetching OpenRouter models: {e}")
        return []

if __name__ == "__main__":
    import asyncio
    # Test script
    async def main():
        free_models = await get_free_openrouter_models()
        print(f"Found {len(free_models)} free models on OpenRouter:")
        for m in free_models:
            print(f"- {m['name']} ({m['id']})")
    
    asyncio.run(main())
