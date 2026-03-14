import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

class Settings:
    azure_client_id: str = os.getenv("AZURE_CLIENT_ID", "")

settings = Settings()
