
from pathlib import Path
import random
import joblib
import librosa
import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# ---------------- CONFIGURATION ----------------

SAMPLE_RATE = 22050
WINDOW_SECONDS = 3
HOP_SECONDS = 1.5
N_MELS = 128
MAX_WINDOWS_PER_FILE = 8
RANDOM_STATE = 42

DATASETS = {
    "Elephant": Path("elephant_audio"),
    "Tiger": Path("tiger_audio")
}

MODEL_PATH = Path("models/wildlife_audio_classifier_2class.pkl")

SUPPORTED_EXTENSIONS = {
    ".mp3", ".mpeg", ".mpg", ".wav", ".m4a", ".ogg", ".flac"
}

random.seed(RANDOM_STATE)
np.random.seed(RANDOM_STATE)


# ---------------- AUDIO FEATURES ----------------

def extract_features(audio):
    mel = librosa.feature.melspectrogram(
        y=audio,
        sr=SAMPLE_RATE,
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


def get_windows(audio):
    window_size = int(WINDOW_SECONDS * SAMPLE_RATE)
    hop_size = int(HOP_SECONDS * SAMPLE_RATE)

    if len(audio) < window_size:
        audio = np.pad(audio, (0, window_size - len(audio)))

    windows = []

    for start in range(0, len(audio) - window_size + 1, hop_size):
        windows.append(audio[start:start + window_size])

    if len(windows) > MAX_WINDOWS_PER_FILE:
        indices = np.linspace(
            0, len(windows) - 1,
            MAX_WINDOWS_PER_FILE,
            dtype=int
        )
        windows = [windows[i] for i in indices]

    return windows


# ---------------- LOAD DATASET ----------------

print("\nBHOOMI KAVALU - TWO CLASS AUDIO MODEL")
print("=" * 60)

recordings = {}

for animal, folder in DATASETS.items():
    files = sorted(
        f for f in folder.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    if len(files) < 3:
        raise ValueError(f"Not enough recordings for {animal}")

    recordings[animal] = files
    print(f"{animal}: {len(files)} recordings found")

# Split by original recording, not by audio window.
train_files = []
test_files = []

for animal, files in recordings.items():
    shuffled = files.copy()
    random.shuffle(shuffled)

    test_files.extend((animal, f) for f in shuffled[:2])
    train_files.extend((animal, f) for f in shuffled[2:])

print("\nTraining recordings:", len(train_files))
print("Testing recordings:", len(test_files))


def build_features(file_list):
    X = []
    y = []
    file_groups = []

    for animal, file in file_list:
        print(f"Processing {animal}: {file.name}")

        try:
            audio, _ = librosa.load(
                str(file),
                sr=SAMPLE_RATE,
                mono=True
            )

            if len(audio) == 0:
                print("Skipping empty file")
                continue

            windows = get_windows(audio)

            for window in windows:
                features = extract_features(window)
                X.append(features)
                y.append(animal)
                file_groups.append(file.name)

        except Exception as error:
            print(f"Could not process {file.name}: {error}")

    return np.array(X), np.array(y), np.array(file_groups)


# ---------------- TRAIN / TEST DATA ----------------

print("\nExtracting training features...")
X_train, y_train, _ = build_features(train_files)

print("\nExtracting testing features...")
X_test, y_test, test_groups = build_features(test_files)

if len(X_train) == 0 or len(X_test) == 0:
    raise RuntimeError("Training or testing data is empty.")

if len(set(y_train)) != 2:
    raise RuntimeError("Training data must contain both animal classes.")

print("\nTraining windows:", len(X_train))
print("Testing windows:", len(X_test))


# ---------------- TRAIN MODEL ----------------

model = Pipeline([
    ("scaler", StandardScaler()),
    ("classifier", RandomForestClassifier(
        n_estimators=300,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        min_samples_leaf=2
    ))
])

print("\nTraining Random Forest...")
model.fit(X_train, y_train)


# ---------------- RECORDING LEVEL EVALUATION ----------------

print("\nEVALUATING HELD-OUT RECORDINGS")
print("=" * 60)

classes = list(model.named_steps["classifier"].classes_)

recording_predictions = []
recording_actual = []

for animal, file in test_files:
    try:
        audio, _ = librosa.load(
            str(file),
            sr=SAMPLE_RATE,
            mono=True
        )

        windows = get_windows(audio)
        features = np.array([
            extract_features(w) for w in windows
        ])

        probabilities = model.predict_proba(features)
        average_probabilities = np.mean(probabilities, axis=0)

        predicted = classes[np.argmax(average_probabilities)]

        recording_actual.append(animal)
        recording_predictions.append(predicted)

        print(f"\nFile: {file.name}")
        print("Actual:", animal)
        print("Predicted:", predicted)
        print("Average probabilities:")

        for label, probability in zip(classes, average_probabilities):
            print(f"  {label}: {probability * 100:.2f}%")

    except Exception as error:
        print(f"Evaluation failed for {file.name}: {error}")

if not recording_actual:
    raise RuntimeError("No test recordings could be evaluated.")

print("\nRECORDING LEVEL ACCURACY:",
      f"{accuracy_score(recording_actual, recording_predictions) * 100:.2f}%")

print("\nCLASSIFICATION REPORT:")
print(classification_report(
    recording_actual,
    recording_predictions,
    labels=classes,
    zero_division=0
))

print("CONFUSION MATRIX:")
print(confusion_matrix(
    recording_actual,
    recording_predictions,
    labels=classes
))


# ---------------- FINAL TRAINING ON ALL RECORDINGS ----------------

print("\nTraining final model using all recordings...")

all_files = [
    (animal, file)
    for animal, files in recordings.items()
    for file in files
]

X_all, y_all, _ = build_features(all_files)

final_model = Pipeline([
    ("scaler", StandardScaler()),
    ("classifier", RandomForestClassifier(
        n_estimators=300,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        min_samples_leaf=2
    ))
])

final_model.fit(X_all, y_all)

MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

joblib.dump({
    "model": final_model,
    "classes": list(final_model.named_steps["classifier"].classes_),
    "sample_rate": SAMPLE_RATE,
    "window_seconds": WINDOW_SECONDS,
    "hop_seconds": HOP_SECONDS,
    "n_mels": N_MELS,
    "feature_type": "log_mel_mean_std"
}, MODEL_PATH)

print("\n" + "=" * 60)
print("FINAL MODEL SAVED SUCCESSFULLY")
print("Location:", MODEL_PATH)
print("Classes:", list(final_model.named_steps["classifier"].classes_))
print("Total source recordings:", len(all_files))
print("Total training windows:", len(X_all))
print("=" * 60)
