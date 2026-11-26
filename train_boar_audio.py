import os
import glob
import joblib
import librosa
import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report

AUDIO_DIR = "boar_audio"
MODEL_PATH = "models/wild_boar_audio_classifier.pkl"

os.makedirs("models", exist_ok=True)


def extract_features(path):
    y, sr = librosa.load(path, sr=22050, mono=True)

    # Use maximum 10 seconds
    y = y[:sr * 10]

    # Pad shorter recordings
    if len(y) < sr * 10:
        y = np.pad(y, (0, sr * 10 - len(y)))

    features = []

    # MFCC
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    features.extend(np.mean(mfcc, axis=1))
    features.extend(np.std(mfcc, axis=1))

    # Mel spectrogram
    mel = librosa.feature.melspectrogram(
        y=y,
        sr=sr,
        n_mels=32
    )
    mel_db = librosa.power_to_db(mel, ref=np.max)

    features.extend(np.mean(mel_db, axis=1))
    features.extend(np.std(mel_db, axis=1))

    # Spectral features
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
    zcr = librosa.feature.zero_crossing_rate(y)

    for f in [centroid, bandwidth, rolloff, zcr]:
        features.append(float(np.mean(f)))
        features.append(float(np.std(f)))

    return np.array(features)


# ---------------------------------------------------------
# LOAD BOAR AUDIO
# ---------------------------------------------------------

files = []

for ext in ["*.wav", "*.mp3", "*.mpeg", "*.ogg", "*.flac"]:
    files.extend(glob.glob(os.path.join(AUDIO_DIR, ext)))

print("\nBHOOMI KAVALU - WILD BOAR AUDIO MODEL")
print("=" * 55)
print("Boar recordings:", len(files))

if len(files) < 5:
    raise SystemExit("Not enough recordings.")


X_boar = []

for i, file in enumerate(files, 1):
    print(f"[{i}/{len(files)}] {os.path.basename(file)}")

    try:
        X_boar.append(extract_features(file))
    except Exception as e:
        print("ERROR:", e)


X_boar = np.array(X_boar)

print("\nBoar feature matrix:", X_boar.shape)


# ---------------------------------------------------------
# CREATE BACKGROUND/NEGATIVE PROTOTYPE DATA
# ---------------------------------------------------------

rng = np.random.default_rng(42)

X_background = []

for x in X_boar:
    noise = rng.normal(
        0,
        np.maximum(np.abs(x) * 0.25, 0.01),
        size=x.shape
    )

    X_background.append(x + noise)

X_background = np.array(X_background)


# ---------------------------------------------------------
# COMBINE DATA
# ---------------------------------------------------------

X = np.vstack([
    X_boar,
    X_background
])

y = np.array(
    [1] * len(X_boar) +
    [0] * len(X_background)
)

print("\nTotal training samples:", len(X))
print("WILD BOAR:", len(X_boar))
print("BACKGROUND:", len(X_background))


# ---------------------------------------------------------
# TRAIN
# ---------------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.25,
    random_state=42,
    stratify=y
)

model = Pipeline([
    ("scaler", StandardScaler()),

    ("classifier", RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        class_weight="balanced"
    ))
])

print("\nTraining Random Forest...")

model.fit(X_train, y_train)


# ---------------------------------------------------------
# EVALUATE
# ---------------------------------------------------------

pred = model.predict(X_test)

accuracy = accuracy_score(y_test, pred)

print("\nAccuracy:", round(accuracy * 100, 2), "%")

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        pred,
        target_names=["BACKGROUND", "WILD BOAR"],
        zero_division=0
    )
)


# ---------------------------------------------------------
# SAVE
# ---------------------------------------------------------

joblib.dump(model, MODEL_PATH)

print("\n" + "=" * 55)
print("TRAINING COMPLETE")
print("=" * 55)
print("Saved model:")
print(MODEL_PATH)