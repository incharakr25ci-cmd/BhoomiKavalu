"""
Bhoomi Kavalu - Application Configuration
Uses pydantic-settings for environment-based configuration.
"""

import os
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file."""

    # Database
    DATABASE_URL: str = "sqlite:///./bhoomi_kavalu.db"

    # Security
    SECRET_KEY: str = "bhoomi-kavalu-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 24

    # SMS / GSM Module
    SMS_PROVIDER: str = "gsm"
    GSM_PORT: str = "COM3"
    GSM_BAUD_RATE: int = 9600

    # Demo Mode - when True, SMS is logged instead of sent
    DEMO_MODE: bool = True

    # ML Model Paths (relative to project root)
    YOLO_MODEL_PATH: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "bhoomi_kavalu_wildlife.pt",
    )
    WILD_BOAR_MODEL_PATH: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "models",
        "wild_boar_detector.pt",
    )
    AUDIO_MODEL_PATH: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "models",
        "wildlife_audio_classifier.pkl",
    )
    AUDIO_2CLASS_MODEL_PATH: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "models",
        "wildlife_audio_classifier_2class.pkl",
    )

    # Firebase Realtime Database
    FIREBASE_DATABASE_URL: str = (
        "https://bhoomikavalu-e8adc-default-rtdb.asia-southeast1.firebasedatabase.app"
    )

    # Upload paths
    UPLOAD_DIR: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "uploads",
    )

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "*",
    ]

    # Critical species that trigger high-level alerts
    CRITICAL_SPECIES: List[str] = [
        "tiger",
        "elephant",
        "leopard",
        "wildboar",
        "wild boar",
        "pig",
        "bear",
        "gaur",
    ]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
