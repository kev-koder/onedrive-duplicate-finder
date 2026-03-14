import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    azure_client_id: str = os.getenv("AZURE_CLIENT_ID", "")

settings = Settings()
