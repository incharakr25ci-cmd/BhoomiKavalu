import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import soundfile as sf
import numpy as np
from backend.services.audio_classifier_2class import classify_audio_buffer

with open("reference_segments/elephant.wav", "rb") as f:
    wav_bytes = f.read()

res = classify_audio_buffer(wav_bytes, "elephant.wav")
print("CLASSIFICATION RESULT:", res)
assert res["animal"] == "Asian Elephant" or res["raw_class"] == "Elephant"
assert res["is_wildlife"] is True
print("VERIFICATION SUCCESSFUL!")
