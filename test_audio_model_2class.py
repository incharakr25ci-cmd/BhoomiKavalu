
from pathlib import Path
import joblib
import librosa
import numpy as np

MODEL_PATH = Path("models/wildlife_audio_classifier_2class.pkl")

bundle = joblib.load(MODEL_PATH)
model = bundle["model"]

SR = bundle["sample_rate"]
WINDOW = int(bundle["window_seconds"] * SR)
HOP = int(bundle["hop_seconds"] * SR)
N_MELS = bundle["n_mels"]

def extract_features(audio):
    mel = librosa.feature.melspectrogram(
        y=audio,
        sr=SR,
        n_fft=2048,
        hop_length=512,
        n_mels=N_MELS,
        power=2.0
    )

    log_mel = librosa.power_to_db(mel, ref=np.max)

    return np.concatenate([
        np.mean(log_mel, axis=1),
        np.std(log_mel, axis=1)
    ])

def predict_audio(file_path):
    audio, _ = librosa.load(file_path, sr=SR, mono=True)

    if len(audio) < WINDOW:
        audio = np.pad(audio, (0, WINDOW - len(audio)))

    windows = [
        audio[i:i + WINDOW]
        for i in range(0, len(audio) - WINDOW + 1, HOP)
    ]

    features = np.array([extract_features(w) for w in windows])
    probabilities = model.predict_proba(features).mean(axis=0)

    classes = model.named_steps["classifier"].classes_
    predicted = classes[np.argmax(probabilities)]

    print("\nFILE:", file_path)
    print("PREDICTION:", predicted)

    for label, probability in zip(classes, probabilities):
        print(f"{label}: {probability * 100:.2f}%")

if __name__ == "__main__":
    path = input("Enter audio file path: ").strip().strip('"')

    if not Path(path).is_file():
        print("File not found.")
    else:
        predict_audio(path)
