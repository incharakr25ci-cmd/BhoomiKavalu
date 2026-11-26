    import os
    import time
    import numpy as np
    import librosa
    import sounddevice as sd
    import joblib
    import requests

    # ================= CONFIGURATION =================

    MODEL_PATH = "wildlife_audio_classifier_2class.pkl"

    SAMPLE_RATE = 22050
    DURATION = 5
    N_MELS = 128

    CONFIDENCE_THRESHOLD = 60
    SILENCE_THRESHOLD = 0.002

    FIREBASE_URL = (
        "https://bhoomikavalu-cb186-default-rtdb."
        "asia-southeast1.firebasedatabase.app"
        "/forestMonitoring/node1/aiDetection.json"
    )

    # ================= LOAD MODEL =================

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}"
        )

    model = joblib.load(MODEL_PATH)

    print("Model loaded successfully.")
    print("Classes:", model.classes_)

    # ================= FEATURE EXTRACTION =================

    def extract_features(audio):

        mel = librosa.feature.melspectrogram(
            y=audio,
            sr=SAMPLE_RATE,
            n_fft=2048,
            hop_length=512,
            n_mels=N_MELS,
            power=2.0
        )

        features = np.concatenate([
            np.mean(mel, axis=1),
            np.std(mel, axis=1)
        ])

        return np.nan_to_num(features).reshape(1, -1)


    # ================= FIREBASE =================

    def send_to_firebase(animal, confidence, status):

        data = {
            "animal": str(animal),
            "confidence": round(float(confidence), 2),
            "status": status,
            "timestamp": int(time.time() * 1000)
        }

        try:

            response = requests.put(
                FIREBASE_URL,
                json=data,
                timeout=10
            )

            print(
                "Firebase:",
                response.status_code
            )

            if response.status_code != 200:
                print(response.text)

        except Exception as error:
            print("Firebase error:", error)


    # ================= LIVE PREDICTION =================

    def listen_and_predict():

        print("\n======================================")
        print("       BHOOMI KAVALU")
        print("       NODE 1 AI MONITORING")
        print("======================================")

        print("\nListening for wildlife sounds...")
        print("Prediction interval:", DURATION, "seconds\n")

        while True:

            try:

                print("Listening...")

                recording = sd.rec(
                    int(DURATION * SAMPLE_RATE),
                    samplerate=SAMPLE_RATE,
                    channels=1,
                    dtype="float32"
                )

                sd.wait()

                audio = recording.flatten()

                # Calculate audio RMS
                rms = float(
                    np.sqrt(np.mean(audio ** 2))
                )

                print("Audio RMS:", rms)

                # Ignore silence
                if rms < SILENCE_THRESHOLD:

                    print("No significant sound detected.")

                    send_to_firebase(
                        "None",
                        0,
                        "IDLE"
                    )

                    continue

                # Extract features
                features = extract_features(audio)

                # Prediction
                prediction = model.predict(features)[0]

                probabilities = model.predict_proba(features)[0]

                classes = model.classes_

                confidence = float(
                    np.max(probabilities) * 100
                )

                print("\n--------------------------------")
                print("NODE 1 AI RESULT")
                print("--------------------------------")

                print(
                    "Detected:",
                    prediction
                )

                print(
                    "Confidence:",
                    round(confidence, 2),
                    "%"
                )

                for animal, probability in zip(
                    classes,
                    probabilities
                ):

                    print(
                        animal,
                        ":",
                        round(probability * 100, 2),
                        "%"
                    )

                # Determine status
                if confidence >= CONFIDENCE_THRESHOLD:

                    status = "ANIMAL_DETECTED"

                    print(
                        "STATUS: ANIMAL DETECTED"
                    )

                else:

                    status = "LOW_CONFIDENCE"

                    print(
                        "STATUS: LOW CONFIDENCE"
                    )

                # Send result to Firebase
                send_to_firebase(
                    prediction,
                    confidence,
                    status
                )

                print("--------------------------------\n")

                time.sleep(0.5)

            except KeyboardInterrupt:

                print(
                    "\nNode 1 AI monitoring stopped."
                )

                break

            except Exception as error:

                print(
                    "Error:",
                    error
                )

                time.sleep(2)


    # ================= START =================

    if __name__ == "__main__":

        print("Available microphones:")

        print(sd.query_devices())

        listen_and_predict()