import os
from pathlib import Path
from dotenv import load_dotenv

# Tìm về thư mục gốc của dự án (Cha của thư mục src)
BASE_DIR = Path(__file__).resolve().parent.parent

# Load file .env
load_dotenv(BASE_DIR / ".env")

class Config:
    # API Keys
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

    SERPER_API_KEY = os.getenv("SERPER_API_KEY")
    # Paths
    DB_PATH = BASE_DIR / "store.db"
    RAW_DATA_PATH = BASE_DIR / "data" / "raw" / "products.json"
    VECTOR_DB_PATH = BASE_DIR / "data" / "vector_db"


settings = Config()