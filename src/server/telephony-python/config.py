"""
Configuration management for Python Telephony Service
Reads environment variables and provides defaults
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Configuration class for telephony service"""
    
    # Server Configuration
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PYTHON_PORT', 8081))
    
    # OpenAI Configuration
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    VOICEAGENT_MODEL = os.getenv('VOICEAGENT_MODEL', 'gpt-realtime')
    
    # Waybeo Configuration
    WAYBEO_AUTH_TOKEN = os.getenv('WAYBEO_AUTH_TOKEN')
    WAYBEO_WEBHOOK_URL = os.getenv('WAYBEO_WEBHOOK_URL', 'https://pbx-uat.waybeo.com/bot-call')
    
    # Audio Configuration
    SAMPLE_RATE_TELEPHONY = 8000  # 8kHz from telephony vendors
    SAMPLE_RATE_OPENAI = 24000    # 24kHz for OpenAI Realtime API
    
    # VAD Configuration (matching TypeScript version)
    VAD_THRESHOLD = float(os.getenv('VAD_THRESHOLD', 0.5))
    VAD_PREFIX_PADDING_MS = int(os.getenv('VAD_PREFIX_PADDING_MS', 300))
    VAD_SILENCE_DURATION_MS = int(os.getenv('VAD_SILENCE_DURATION_MS', 600))
    
    # Paths
    DATA_DIR = 'data/calls'
    
    # Feature Flags
    ENABLE_CALL_TRANSFER = os.getenv('ENABLE_CALL_TRANSFER', 'true').lower() == 'true'
    
    @classmethod
    def validate(cls):
        """Validate required configuration"""
        if not cls.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        if cls.ENABLE_CALL_TRANSFER and not cls.WAYBEO_AUTH_TOKEN:
            print("⚠️  Warning: WAYBEO_AUTH_TOKEN not set - call transfer will be disabled")
            cls.ENABLE_CALL_TRANSFER = False
    
    @classmethod
    def print_config(cls):
        """Print configuration (for debugging)"""
        print("=" * 60)
        print("🐍 Python Telephony Service Configuration")
        print("=" * 60)
        print(f"🌐 Server: ws://{cls.HOST}:{cls.PORT}/ws")
        print(f"🤖 Model: {cls.VOICEAGENT_MODEL}")
        print(f"🎵 Audio: {cls.SAMPLE_RATE_TELEPHONY}Hz ↔ {cls.SAMPLE_RATE_OPENAI}Hz (librosa)")
        print(f"🔇 VAD: threshold={cls.VAD_THRESHOLD}, silence={cls.VAD_SILENCE_DURATION_MS}ms")
        print(f"📞 Call Transfer: {'✅ Enabled' if cls.ENABLE_CALL_TRANSFER else '❌ Disabled'}")
        print(f"📁 Data Directory: {cls.DATA_DIR}")
        print("=" * 60)

