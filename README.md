# Bhoomi Kavalu — Multi-Sensor Wildlife Monitoring & Early Warning System

**Bhoomi Kavalu** is a full-stack wildlife intrusion detection and early-warning platform designed to protect agricultural lands and forest-border communities. It combines **YOLOv8 computer vision**, **acoustic wildlife classification** (Asian Elephant, Tiger, Wild Boar), **ground vibration telemetry**, **ESP32 + INMP441 IoT hardware**, **Firebase Realtime Database**, and a **React + TypeScript dashboard** with real-time WebSocket alerts.

---

## Problem Statement

Human-wildlife conflict near forest fringes causes severe crop loss and safety risks for farmers and forest officers. Manual monitoring is unreliable, especially at night or across large perimeters. Bhoomi Kavalu provides automated, multi-modal detection (vision + audio + vibration) with instant alerts and threat fusion.

---

## Key Features

- **Dual-Model Wildlife Vision Detection (`YOLOv8`)**:
  - Multi-animal detection (`bhoomi_kavalu_wildlife.pt`) + specialized Wild Boar detection (`models/wild_boar_detector.pt`) with IoU deduplication.
  - Supports local webcam streaming, uploaded frames, and smartphone camera streaming via QR code.
- **3-Species Wildlife Acoustic Classification**:
  - Classifies **Asian Elephant** & **Tiger** (`models/wildlife_audio_classifier_2class.pkl`, log-mel spectrogram RandomForest) and **Wild Boar** (`models/wild_boar_audio_classifier.pkl`, MFCC + Mel + spectral RandomForest).
  - Supports live browser microphone streaming (3.5s PCM WAV chunks), file uploads (`.wav`, `.mp3`, `.mpeg`), and ESP32 + INMP441 HTTP POST audio streams.
- **ESP32 + INMP441 Hardware Integration (HTTP Architecture)**:
  - Streams 22.05 kHz 16-bit mono WAV chunks over Wi-Fi via HTTP POST to the FastAPI backend (replacing legacy UDP).
- **Multi-Sensor Fusion & Early Warning**:
  - Correlates camera, audio, and vibration detections into fused threat levels (`normal`, `warning`, `high`, `critical`) and logs alerts + SMS dispatch status.
- **Role-Based React Dashboard**:
  - Separate views for **Landowners** (Overview, Live Monitoring, Camera Detection, Audio Detection, Alerts, Detection History, Overall Analysis) and **Forest Officers** (Regional Overview, Landowners, Alerts).
  - Real-time WebSocket updates (`/ws/sensors/{node_id}`) and Firebase Realtime Database sync.

---

## System Architecture

```text
ESP32 + INMP441 Mic / Browser Mic / Camera
        │
        ▼  (HTTP POST / WebSocket)
Python FastAPI Backend (backend/app.py)
   ├── YOLOv8 Vision (bhoomi_kavalu_wildlife.pt + models/wild_boar_detector.pt)
   ├── Audio ML (wildlife_audio_classifier_2class.pkl + wild_boar_audio_classifier.pkl)
   ├── Multi-Sensor Fusion & SQLite DB (SQLAlchemy)
   └── Firebase RTDB Sync (backend/services/firebase_service.py)
        │
        ▼  (REST API + WebSockets)
React + Vite + TypeScript Dashboard (frontend/)
```

---

## Technologies Used

- **Backend**: Python, FastAPI, Uvicorn, SQLAlchemy, Pydantic Settings, OpenCV, Ultralytics YOLOv8, Librosa, SoundFile, Scikit-learn, Joblib, HTTPX, WebSockets
- **Frontend**: React 19, TypeScript, Vite (with `@vitejs/plugin-basic-ssl` for HTTPS camera/mic access), Tailwind CSS v4, Zustand, Recharts, Leaflet, QRCode.react
- **Hardware**: ESP32 DevKit + INMP441 I2S MEMS Microphone (Arduino IDE / ESP32 Core)
- **Database & Cloud**: SQLite (`bhoomi_kavalu.db`, auto-seeded on startup), Firebase Realtime Database

---

## Repository Structure

```text
bhoomi-kavalu/
├── backend/
│   ├── app.py                     # FastAPI app entry & router registration
│   ├── config.py                  # Settings & model path configuration
│   ├── database.py                # SQLAlchemy engine & session setup
│   ├── models.py                  # Database ORM models
│   ├── schemas.py                 # Pydantic request/response schemas
│   ├── auth.py                    # JWT & password hashing utilities
│   ├── seed_data.py               # Initial demo users, lands & sensor nodes
│   ├── websocket_manager.py       # Real-time WebSocket broadcast manager
│   ├── routers/                   # auth, dashboard, detection, esp32, fusion, alert, land, sensor, sms
│   └── services/                  # audio_classifier_2class, firebase_service, sensor_fusion, sms_service
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Landowner, Officer & Auth pages
│   │   ├── components/            # Charts, layout, maps, alerts
│   │   ├── services/api.ts        # Backend REST client
│   │   ├── hooks/useWebSocket.ts  # WebSocket hook
│   │   └── utils/                 # Formatters, constants
│   ├── package.json
│   └── vite.config.ts             # Dev server & /api, /ws proxy to :8000
├── firmware/
│   └── esp32_inmp441_http/        # ESP32 + INMP441 HTTP POST Arduino sketch
├── models/
│   ├── wild_boar_detector.pt
│   ├── wild_boar_audio_classifier.pkl
│   ├── wildlife_audio_classifier_2class.pkl
│   └── wildlife_audio_classifier.pkl
├── reference_segments/            # Reference .wav samples for verification
├── scripts/                       # Backend/audio verification scripts
├── bhoomi_kavalu_wildlife.pt      # Multi-animal YOLOv8 weights
├── server.py                      # Backend launcher (prints LAN IP & ESP32 URL)
├── main.py                        # Legacy/compat entry point
├── requirements.txt               # Python dependencies
├── .env.example                   # Environment variable template
└── README.md
```

---

## Model Setup

All required inference models are included directly in the repository (each under 7 MB):
- `bhoomi_kavalu_wildlife.pt` — Multi-animal YOLOv8 model
- `models/wild_boar_detector.pt` — Specialized Wild Boar YOLOv8 model
- `models/wildlife_audio_classifier_2class.pkl` — Elephant / Tiger log-mel RandomForest model
- `models/wild_boar_audio_classifier.pkl` — Wild Boar MFCC/Mel/spectral RandomForest model
- `models/wildlife_audio_classifier.pkl` — Legacy 3-class audio classifier

---

## Installation & Startup

### 1. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your SECRET_KEY and FIREBASE_DATABASE_URL
```

### 2. Backend Setup
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
```

Start the FastAPI backend:
```bash
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
# or: python server.py
```
- API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/health`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
- Dashboard: `https://localhost:5173/` (HTTPS enabled for browser camera/microphone permissions; `/api` and `/ws` are proxied to `http://127.0.0.1:8000`).

---

## ESP32 + INMP441 Hardware Setup

Open `firmware/esp32_inmp441_http/esp32_inmp441_http.ino` in Arduino IDE:
1. Update `WIFI_SSID`, `WIFI_PASSWORD`, and `SERVER_HOST` (your machine's LAN IP).
2. Wire the INMP441 microphone to the ESP32:
   - `VDD` → `3.3V`
   - `GND` → `GND`
   - `L/R` → `GND`
   - `SCK` → `GPIO 14`
   - `WS` → `GPIO 15`
   - `SD` → `GPIO 32`
3. Flash to your ESP32 board. It streams 3-second 22.05 kHz 16-bit mono WAV chunks via HTTP POST to `/api/esp32/audio?node_id=NODE_001`.

---

## Key API Endpoints

- `GET /api/health` — Backend health check
- `POST /api/auth/login` & `POST /api/auth/register` — JWT authentication
- `POST /api/detect/camera-frame?node_code=NODE_001` — Dual-YOLO frame detection
- `POST /api/detect/audio?node_code=NODE_001` — Live microphone audio classification
- `POST /api/detect/audio-upload?node_code=NODE_001` — Uploaded audio clip classification (`.wav`, `.mp3`, `.mpeg`)
- `POST /api/esp32/audio?node_id=NODE_001` — ESP32 HTTP WAV ingestion
- `POST /api/detect/esp32/heartbeat?node_id=NODE_001` — ESP32 device & mic status heartbeat
- `GET /api/detect/history` & `GET /api/alerts` — Detection logs & active alerts
- `WS /ws/sensors/{node_id}` — Real-time detection & camera frame stream

---

## Testing Camera & Audio Detection

1. **Camera Detection**: Open **Camera Detection** in the dashboard, click **Start Local Camera** (or scan the QR code on your phone on the same Wi-Fi), and verify bounding boxes, species labels (including `WILD BOAR`), and threat levels appear.
2. **Audio Detection**: Open **Audio Detection**, click **Start Live Audio** or upload a sample `.wav`/`.mp3`/`.mpeg` file (e.g., from `reference_segments/`), and verify classification results and confidence scores update in real time.
3. **Automated Backend Verification**:
   ```bash
   python scripts/test_direct_router.py
   ```
