import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

app = FastAPI(title="Bhoomi Kavalu Wildlife API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("bhoomi_kavalu_wildlife.pt")

# Normalize dataset labels and define high-risk species
CRITICAL_SPECIES = {"tiger", "elephant", "leopard", "wildboar", "bear", "gaur"}
latest_state = {
    "species": "NONE",
    "confidence": 0.0,
    "alert_level": "CLEAR",
    "lora_trigger": False,
}

@app.get("/api/health")
def health():
    return {"status": "online", "classes": list(model.names.values())}

@app.post("/api/detect-frame")
async def detect_frame(file: UploadFile = File(...)):
    global latest_state
    contents = await file.read()
    img_array = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    results = model.predict(source=frame, conf=0.55, imgsz=640, verbose=False)[0]
    detections = []

    for box in results.boxes:
        cls_id = int(box.cls[0])
        raw_name = model.names[cls_id].strip()
        if raw_name in {"0", "otherentities"}:
            continue

        species = raw_name.upper()
        conf = float(box.conf[0])
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        is_critical = raw_name.lower() in CRITICAL_SPECIES

        detections.append({
            "species": species,
            "confidence": round(conf, 2),
            "alert_level": "CRITICAL" if is_critical else "MONITOR",
            "bbox": [x1, y1, x2, y2],
        })

    if detections:
        top = max(detections, key=lambda d: d["confidence"])
        latest_state = {
            "species": top["species"],
            "confidence": top["confidence"],
            "alert_level": top["alert_level"],
            "lora_trigger": latest_state["lora_trigger"],
        }

    return {
        "detections": detections,
        "frame_width": frame.shape[1],
        "frame_height": frame.shape[0],
    }

@app.post("/api/lora-trigger")
def lora_trigger(node_id: str = "NODE_01", event: str = "SEISMIC_ACOUSTIC"):
    latest_state["lora_trigger"] = True
    return {"status": "triggered", "node_id": node_id, "event": event}

@app.get("/api/latest-alert")
def get_latest_alert():
    return latest_state