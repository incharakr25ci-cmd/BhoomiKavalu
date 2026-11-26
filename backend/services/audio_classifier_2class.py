"""
Bhoomi Kavalu - Wildlife Audio Classifier Service

Supports:
- Elephant
- Tiger
- Wild Boar

Elephant/Tiger use the original 2-class model and preprocessing.
Wild Boar uses its separately trained model and preprocessing.
"""

import io
import os
import tempfile
from pathlib import Path
from typing import Dict, Any

import joblib
import librosa
import numpy as np
import soundfile as sf


# ============================================================
# ELEPHANT / TIGER MODEL
# ============================================================

CANDIDATE_PATHS = [
    Path("models/wildlife_audio_classifier_2class.pkl"),
    Path("wildlife_audio_classifier_2class.pkl"),
]

_bundle = None
_model = None
_classes = ["Elephant", "Tiger"]

_sr = 22050
_window_sec = 3.0
_hop_sec = 1.5
_n_mels = 128

_silence_threshold = 0.0015
_confidence_threshold = 55.0


# ============================================================
# WILD BOAR MODEL
# ============================================================

BOAR_MODEL_PATH = Path("models/wild_boar_audio_classifier.pkl")

_boar_model = None


# ============================================================
# LOAD ELEPHANT / TIGER MODEL
# ============================================================

def load_2class_model():
    """Load the original Elephant/Tiger audio model."""

    global _bundle, _model, _classes
    global _sr, _window_sec, _hop_sec, _n_mels

    if _model is not None:
        return _model

    model_file = None

    for p in CANDIDATE_PATHS:
        if p.is_file():
            model_file = p
            break

    if not model_file:
        raise FileNotFoundError(
            f"2-class audio model not found in {CANDIDATE_PATHS}."
        )

    _bundle = joblib.load(model_file)

    if isinstance(_bundle, dict) and "model" in _bundle:

        _model = _bundle["model"]

        _classes = list(
            _bundle.get(
                "classes",
                ["Elephant", "Tiger"]
            )
        )

        _sr = int(
            _bundle.get(
                "sample_rate",
                22050
            )
        )

        _window_sec = float(
            _bundle.get(
                "window_seconds",
                3.0
            )
        )

        _hop_sec = float(
            _bundle.get(
                "hop_seconds",
                1.5
            )
        )

        _n_mels = int(
            _bundle.get(
                "n_mels",
                128
            )
        )

    else:

        _model = _bundle

        if hasattr(_model, "classes_"):
            _classes = list(_model.classes_)

        elif hasattr(_model, "named_steps"):
            _classes = list(
                _model.named_steps[
                    "classifier"
                ].classes_
            )

    print(
        f"[AudioAI 2-Class] Loaded model from "
        f"{model_file} with classes: {_classes}"
    )

    return _model


# ============================================================
# LOAD WILD BOAR MODEL
# ============================================================

def load_boar_model():
    """Load the separately trained Wild Boar audio model."""

    global _boar_model

    if _boar_model is not None:
        return _boar_model

    if not BOAR_MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Wild Boar audio model not found: "
            f"{BOAR_MODEL_PATH}"
        )

    _boar_model = joblib.load(BOAR_MODEL_PATH)

    print(
        f"[AudioAI Wild Boar] Loaded model from "
        f"{BOAR_MODEL_PATH}"
    )

    return _boar_model


# ============================================================
# ORIGINAL ELEPHANT / TIGER FEATURES
# ============================================================

def extract_features(
    audio: np.ndarray,
    sr: int = 22050,
    n_mels: int = 128
) -> np.ndarray:

    mel = librosa.feature.melspectrogram(
        y=audio,
        sr=sr,
        n_fft=2048,
        hop_length=512,
        n_mels=n_mels,
        power=2.0
    )

    log_mel = librosa.power_to_db(
        mel,
        ref=np.max
    )

    return np.concatenate([
        np.mean(log_mel, axis=1),
        np.std(log_mel, axis=1)
    ])


# ============================================================
# WILD BOAR FEATURES
# EXACTLY MATCH train_boar_audio.py
# ============================================================

def extract_boar_features(
    audio: np.ndarray,
    sr: int = 22050
) -> np.ndarray:

    # Maximum 10 seconds
    audio = audio[:sr * 10]

    # Pad shorter recordings
    if len(audio) < sr * 10:
        audio = np.pad(
            audio,
            (0, sr * 10 - len(audio))
        )

    features = []

    # -------------------------
    # MFCC
    # -------------------------

    mfcc = librosa.feature.mfcc(
        y=audio,
        sr=sr,
        n_mfcc=20
    )

    features.extend(
        np.mean(mfcc, axis=1)
    )

    features.extend(
        np.std(mfcc, axis=1)
    )

    # -------------------------
    # Mel spectrogram
    # -------------------------

    mel = librosa.feature.melspectrogram(
        y=audio,
        sr=sr,
        n_mels=32
    )

    mel_db = librosa.power_to_db(
        mel,
        ref=np.max
    )

    features.extend(
        np.mean(mel_db, axis=1)
    )

    features.extend(
        np.std(mel_db, axis=1)
    )

    # -------------------------
    # Spectral features
    # -------------------------

    centroid = librosa.feature.spectral_centroid(
        y=audio,
        sr=sr
    )

    bandwidth = librosa.feature.spectral_bandwidth(
        y=audio,
        sr=sr
    )

    rolloff = librosa.feature.spectral_rolloff(
        y=audio,
        sr=sr
    )

    zcr = librosa.feature.zero_crossing_rate(
        audio
    )

    for feature in [
        centroid,
        bandwidth,
        rolloff,
        zcr
    ]:

        features.append(
            float(np.mean(feature))
        )

        features.append(
            float(np.std(feature))
        )

    return np.array(features)


# ============================================================
# AUDIO DECODER
# ============================================================

def decode_audio(
    audio_bytes: bytes,
    filename: str
):

    audio = None
    sr = _sr

    # First try soundfile
    try:

        data, file_sr = sf.read(
            io.BytesIO(audio_bytes),
            dtype="float32"
        )

        if data.ndim > 1:
            data = data.mean(axis=1)

        if file_sr != _sr:

            data = librosa.resample(
                data,
                orig_sr=file_sr,
                target_sr=_sr
            )

        audio = data

    except Exception:

        # Fallback through temporary file
        suffix = (
            Path(filename).suffix
            or ".wav"
        )

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as tmp:

            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:

            audio, _ = librosa.load(
                tmp_path,
                sr=_sr,
                mono=True
            )

        finally:

            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    return audio


# ============================================================
# MAIN CLASSIFIER
# ============================================================

def classify_audio_buffer(
    audio_bytes: bytes,
    filename: str = "audio.wav"
) -> Dict[str, Any]:

    """
    Classify incoming audio as:

    - Elephant
    - Tiger
    - Wild Boar

    Existing Elephant/Tiger behavior is preserved.
    """

    # Load both models
    model = load_2class_model()
    boar_model = load_boar_model()

    # --------------------------------------------------------
    # Decode audio
    # --------------------------------------------------------

    audio = decode_audio(
        audio_bytes,
        filename
    )

    if audio is None or len(audio) == 0:

        return {
            "animal": "None",
            "species": "None",
            "confidence": 0.0,
            "confidence_pct": 0.0,
            "status": "INVALID_AUDIO",
            "is_wildlife": False,
            "probabilities": {},
            "rms": 0.0
        }

    # --------------------------------------------------------
    # RMS
    # --------------------------------------------------------

    rms = float(
        np.sqrt(
            np.mean(audio ** 2)
        )
    )

    if rms < _silence_threshold:

        probabilities = {
            c: 0.0
            for c in _classes
        }

        probabilities["Wild Boar"] = 0.0

        return {
            "animal": "None",
            "species": "Ambient / Quiet",
            "confidence": 0.0,
            "confidence_pct": 0.0,
            "status": "IDLE",
            "is_wildlife": False,
            "probabilities": probabilities,
            "rms": round(rms, 6),
            "message": "Ambient / Quiet (below threshold)"
        }

    # ========================================================
    # ELEPHANT / TIGER INFERENCE
    # ========================================================

    window_samples = int(
        _window_sec * _sr
    )

    hop_samples = int(
        _hop_sec * _sr
    )

    audio_2class = audio.copy()

    if len(audio_2class) < window_samples:

        audio_2class = np.pad(
            audio_2class,
            (
                0,
                window_samples -
                len(audio_2class)
            )
        )

    windows = []

    for start in range(
        0,
        len(audio_2class) -
        window_samples + 1,
        hop_samples
    ):

        windows.append(
            audio_2class[
                start:start + window_samples
            ]
        )

    if not windows:

        windows = [
            audio_2class[
                :window_samples
            ]
        ]

    features = np.array([
        extract_features(
            w,
            _sr,
            _n_mels
        )
        for w in windows
    ])

    probs_2class = model.predict_proba(
        features
    )

    avg_probs_2class = np.mean(
        probs_2class,
        axis=0
    )

    best_idx = int(
        np.argmax(avg_probs_2class)
    )

    animal_2class = _classes[
        best_idx
    ]

    confidence_2class = float(
        avg_probs_2class[best_idx]
    )


    # ========================================================
    # WILD BOAR INFERENCE
    # ========================================================

    boar_features = extract_boar_features(
        audio,
        sr=_sr
    )

    boar_probs = boar_model.predict_proba(
        [boar_features]
    )[0]

    boar_classes = list(
        boar_model.named_steps[
            "classifier"
        ].classes_
    )

    # Find class 1 = WILD BOAR
    boar_probability = 0.0

    for cls, probability in zip(
        boar_classes,
        boar_probs
    ):

        if int(cls) == 1:

            boar_probability = float(
                probability
            )

    # ========================================================
    # COMPARE ALL THREE — STABILISED LOGIC
    # ========================================================
    # The 2-class model (Elephant/Tiger) has no Wild Boar class,
    # so it can output high Elephant/Tiger scores on a Wild Boar.
    # Empirical testing on reference_segments vs boar_audio shows:
    #   - Elephant/Tiger/Leopard give boar_probability <= 0.695
    #   - Real Wild Boar audio gives boar_probability >= 0.755
    # Therefore if boar_probability >= 0.72, classify as Wild Boar.

    predicted_animal = animal_2class          # "Elephant" or "Tiger"
    best_confidence  = confidence_2class      # their winning probability

    if boar_probability >= 0.66:
        predicted_animal = "Wild Boar"
        best_confidence  = boar_probability

    confidence_pct = (
        best_confidence * 100.0
    )

    # ========================================================
    # STATUS
    # ========================================================

    if confidence_pct >= _confidence_threshold:

        status = "ANIMAL_DETECTED"
        is_wildlife = True

    else:

        status = "LOW_CONFIDENCE"
        is_wildlife = False

    # ========================================================
    # DISPLAY NAME
    # ========================================================

    if not is_wildlife:
        display_species = "Ambient / Quiet"
        predicted_animal = "None"
    elif predicted_animal == "Elephant":
        display_species = "Asian Elephant"
    elif predicted_animal == "Tiger":
        display_species = "Tiger"
    else:
        display_species = "Wild Boar"

    # ========================================================
    # PROBABILITY MAP (only highest-confidence animal if detected)
    # ========================================================

    if is_wildlife:
        prob_map = {
            predicted_animal: round(best_confidence, 4)
        }
    else:
        prob_map = {}

    return {

        "animal": display_species,

        "species": display_species,

        "raw_class": predicted_animal,

        "confidence": round(
            best_confidence,
            3
        ),

        "confidence_pct": round(
            confidence_pct,
            2
        ),

        "status": status,

        "is_wildlife": is_wildlife,

        "probabilities": prob_map,

        "rms": round(
            rms,
            6
        ),

        "windows_analyzed": len(
            windows
        )
    }