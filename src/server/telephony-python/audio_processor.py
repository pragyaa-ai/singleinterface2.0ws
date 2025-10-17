"""
Audio Processing with librosa
High-quality resampling for crystal-clear voice
"""
import numpy as np
import librosa
from typing import List
import base64

class AudioProcessor:
    """
    Audio processor using librosa for professional-grade resampling
    
    This is the KEY advantage over TypeScript - librosa provides
    superior audio quality that eliminates white noise.
    """
    
    def __init__(self, telephony_sr: int = 8000, openai_sr: int = 24000):
        """
        Initialize audio processor
        
        Args:
            telephony_sr: Sample rate from telephony vendor (8kHz)
            openai_sr: Sample rate for OpenAI Realtime API (24kHz)
        """
        self.telephony_sr = telephony_sr
        self.openai_sr = openai_sr
        self.resample_ratio_up = openai_sr / telephony_sr  # 3.0
        self.resample_ratio_down = telephony_sr / openai_sr  # 0.333...
        
        print(f"🎵 Audio Processor initialized:")
        print(f"   Telephony: {telephony_sr}Hz")
        print(f"   OpenAI: {openai_sr}Hz")
        print(f"   Upsampling ratio: {self.resample_ratio_up}x")
        print(f"   Downsampling ratio: {self.resample_ratio_down:.3f}x")
        print(f"   Method: librosa (kaiser_best)")
    
    def int16_to_float32(self, samples: np.ndarray) -> np.ndarray:
        """
        Convert int16 PCM to float32 [-1.0, 1.0]
        
        Args:
            samples: numpy array of int16 samples
            
        Returns:
            numpy array of float32 samples
        """
        return samples.astype(np.float32) / 32768.0
    
    def float32_to_int16(self, samples: np.ndarray) -> np.ndarray:
        """
        Convert float32 [-1.0, 1.0] to int16 PCM
        
        Args:
            samples: numpy array of float32 samples
            
        Returns:
            numpy array of int16 samples
        """
        # Clip to prevent overflow
        samples = np.clip(samples, -1.0, 1.0)
        return (samples * 32767.0).astype(np.int16)
    
    def upsample_8k_to_24k(self, samples_8k: np.ndarray) -> np.ndarray:
        """
        Upsample from 8kHz to 24kHz using librosa
        
        This is the INPUT audio processing:
        Telephony (8kHz) → OpenAI (24kHz)
        
        Args:
            samples_8k: numpy array of int16 samples at 8kHz
            
        Returns:
            numpy array of int16 samples at 24kHz
        """
        if len(samples_8k) == 0:
            return np.array([], dtype=np.int16)
        
        # Convert to float32
        samples_float = self.int16_to_float32(samples_8k)
        
        # Resample using librosa with highest quality
        # kaiser_best: Kaiser windowed sinc interpolation (best quality)
        samples_24k_float = librosa.resample(
            samples_float,
            orig_sr=self.telephony_sr,
            target_sr=self.openai_sr,
            res_type='kaiser_best'
        )
        
        # Convert back to int16
        samples_24k = self.float32_to_int16(samples_24k_float)
        
        return samples_24k
    
    def downsample_24k_to_8k(self, samples_24k: np.ndarray) -> np.ndarray:
        """
        Downsample from 24kHz to 8kHz using librosa
        
        This is the OUTPUT audio processing:
        OpenAI (24kHz) → Telephony (8kHz)
        
        Args:
            samples_24k: numpy array of int16 samples at 24kHz
            
        Returns:
            numpy array of int16 samples at 8kHz
        """
        if len(samples_24k) == 0:
            return np.array([], dtype=np.int16)
        
        # Convert to float32
        samples_float = self.int16_to_float32(samples_24k)
        
        # Resample using librosa with anti-aliasing
        samples_8k_float = librosa.resample(
            samples_float,
            orig_sr=self.openai_sr,
            target_sr=self.telephony_sr,
            res_type='kaiser_best'
        )
        
        # Convert back to int16
        samples_8k = self.float32_to_int16(samples_8k_float)
        
        return samples_8k
    
    def apply_fade(self, samples: np.ndarray, fade_samples: int = 16) -> np.ndarray:
        """
        Apply gentle fade in/out to prevent clicks
        
        Args:
            samples: audio samples
            fade_samples: number of samples for fade (default: 16 = ~2ms at 8kHz)
            
        Returns:
            faded audio samples
        """
        if len(samples) < fade_samples * 2:
            return samples
        
        # Create fade curve
        fade_in = np.linspace(0, 1, fade_samples)
        fade_out = np.linspace(1, 0, fade_samples)
        
        # Apply fade
        samples_faded = samples.copy()
        samples_faded[:fade_samples] = (samples_faded[:fade_samples] * fade_in).astype(np.int16)
        samples_faded[-fade_samples:] = (samples_faded[-fade_samples:] * fade_out).astype(np.int16)
        
        return samples_faded
    
    def process_input_audio(self, samples_8k: np.ndarray) -> str:
        """
        Process input audio from telephony: 8kHz → 24kHz → base64
        
        Args:
            samples_8k: int16 audio samples at 8kHz
            
        Returns:
            base64 encoded audio for OpenAI
        """
        # Upsample to 24kHz
        samples_24k = self.upsample_8k_to_24k(samples_8k)
        
        # Convert to bytes and encode to base64
        audio_bytes = samples_24k.tobytes()
        audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        return audio_b64
    
    def process_output_audio(self, audio_b64: str) -> List[int]:
        """
        Process output audio from OpenAI: base64 → 24kHz → 8kHz
        
        Args:
            audio_b64: base64 encoded audio from OpenAI
            
        Returns:
            list of int16 audio samples at 8kHz (for JSON serialization)
        """
        # Decode from base64
        audio_bytes = base64.b64decode(audio_b64)
        
        # Convert to numpy array (24kHz int16)
        samples_24k = np.frombuffer(audio_bytes, dtype=np.int16)
        
        # Downsample to 8kHz
        samples_8k = self.downsample_24k_to_8k(samples_24k)
        
        # Apply fade to prevent clicks
        samples_8k = self.apply_fade(samples_8k)
        
        # Convert to list for JSON serialization
        return samples_8k.tolist()
    
    def samples_to_array(self, samples: List[int]) -> np.ndarray:
        """Convert list of samples to numpy array"""
        return np.array(samples, dtype=np.int16)
    
    def array_to_samples(self, array: np.ndarray) -> List[int]:
        """Convert numpy array to list of samples"""
        return array.tolist()


# Global audio processor instance
_audio_processor = None

def get_audio_processor(telephony_sr: int = 8000, openai_sr: int = 24000) -> AudioProcessor:
    """
    Get global audio processor instance (singleton)
    
    Args:
        telephony_sr: Sample rate from telephony vendor
        openai_sr: Sample rate for OpenAI
        
    Returns:
        AudioProcessor instance
    """
    global _audio_processor
    if _audio_processor is None:
        _audio_processor = AudioProcessor(telephony_sr, openai_sr)
    return _audio_processor

