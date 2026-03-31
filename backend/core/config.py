"""
Global configuration constants for Ads Hub backend.
"""
import os
from pathlib import Path

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "meta_ads.db")
FRONTEND_DIR = Path(os.path.join(BASE_DIR, "frontend"))
DATABASE_URL = os.getenv("DATABASE_URL", "")
SESSION_SECRET = os.getenv("SESSION_SECRET", "")  # Set on Render for stateless tokens

META_API = "https://graph.facebook.com/v19.0"

# In-memory tracker for background launch threads
_launch_threads: dict = {}

# Google Sheets API (optional — graceful degradation if not installed)
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build as google_build
    GOOGLE_AVAILABLE = True
except ImportError:
    GOOGLE_AVAILABLE = False
