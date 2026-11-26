import glob
import joblib
import librosa
import numpy as np

model = joblib.load("models/wild_boar_audio_classifier.pkl")

files = glob.glob("boar_audio/*")

# Pick first audio file automatically
audio_file = files[0]

print("Testing:", audio_file)

y, sr = librosa.load(audio_file, sr=22050, mono=True)

y = y[:sr * 10]

if len(y) < sr * 10:
    y = np.pad(y, (0, sr * 10 - len(y)))

features = []

mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
features.extend(np.mean(mfcc, axis=1))
features.extend(np.std(mfcc, axis=1))

mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=32)
mel_db = librosa.power_to_db(mel, ref=np.max)

features.extend(np.mean(mel_db, axis=1))
features.extend(np.std(mel_db, axis=1))

centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
zcr = librosa.feature.zero_crossing_rate(y)

for f in [centroid, bandwidth, rolloff, zcr]:
    features.append(float(np.mean(f)))
    features.append(float(np.std(f)))

features = np.array(features).reshape(1, -1)

prediction = model.predict(features)[0]
probability = model.predict_proba(features)[0]

print()
print("=" * 40)
print("WILD BOAR AUDIO TEST")
print("=" * 40)
print("Prediction:", "WILD BOAR" if prediction == 1 else "BACKGROUND")
print("Confidence:", round(max(probability) * 100, 2), "%")
print("=" * 40)