import os
import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import classification_report, accuracy_score
import joblib

DATASET_DIR = "wildlife_features"

animals = ["Tiger", "Elephant", "Leopard"]

X = []
y = []

for animal in animals:

    folder = os.path.join(DATASET_DIR, animal)

    for file in os.listdir(folder):

        if not file.endswith(".npy"):
            continue

        feature = np.load(os.path.join(folder, file))

        # Convert variable-length Mel spectrogram
        # into fixed-size statistical features
        feature_vector = np.concatenate([
            np.mean(feature, axis=1),
            np.std(feature, axis=1)
        ])

        X.append(feature_vector)
        y.append(animal)

X = np.array(X)
y = np.array(y)

print("Dataset shape:", X.shape)
print("Classes:", np.unique(y))

# Because the dataset is very small, use a simple split
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.3,
    random_state=42,
    stratify=y
)

model = make_pipeline(
    StandardScaler(),
    RandomForestClassifier(
        n_estimators=100,
        random_state=42
    )
)

model.fit(X_train, y_train)

predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("\nAccuracy:", round(accuracy * 100, 2), "%")

print("\nClassification Report:")
print(classification_report(y_test, predictions, zero_division=0))

os.makedirs("models", exist_ok=True)

joblib.dump(
    model,
    "models/wildlife_audio_classifier.pkl"
)

print("\nModel saved:")
print("models/wildlife_audio_classifier.pkl")
