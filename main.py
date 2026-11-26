
import cv2
import numpy as np

from datetime import datetime, timezone
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(title="Bhoomi Kavalu Wildlife API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# LOAD ML MODELS
# ============================================================

# Existing multi-animal YOLO model
wildlife_model = YOLO("bhoomi_kavalu_wildlife.pt")

# Specialized Wild Boar YOLO model
wild_boar_model = YOLO("models/wild_boar_detector.pt")


# ============================================================
# CONFIGURATION
# ============================================================

CRITICAL_SPECIES = {
    "tiger",
    "elephant",
    "leopard",
    "wildboar",
    "wild boar",
    "bear",
    "gaur",
    "buffalo",
}

latest_state = {
    "species": "NONE",
    "confidence": 0.0,
    "alert_level": "CLEAR",
    "lora_trigger": False,
    "node_code": "NODE_001",
    "timestamp": None,
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def calculate_iou(box1, box2):
    """Calculate Intersection over Union of two bounding boxes."""

    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    intersection_width = max(0, x2 - x1)
    intersection_height = max(0, y2 - y1)

    intersection_area = (
        intersection_width * intersection_height
    )

    area1 = (
        max(0, box1[2] - box1[0])
        * max(0, box1[3] - box1[1])
    )

    area2 = (
        max(0, box2[2] - box2[0])
        * max(0, box2[3] - box2[1])
    )

    union_area = area1 + area2 - intersection_area

    if union_area == 0:
        return 0.0

    return intersection_area / union_area


def decode_image(contents):
    """Convert uploaded image bytes into an OpenCV frame."""

    img_array = np.frombuffer(contents, np.uint8)
    return cv2.imdecode(img_array, cv2.IMREAD_COLOR)


def run_wildlife_detection(frame):
    """
    Run both YOLO models.
    Prefer the specialized Wild Boar model when detections overlap.
    """

    wildlife_detections = []
    boar_detections = []

    # --------------------------------------------------------
    # 1. EXISTING MULTI-ANIMAL MODEL
    # --------------------------------------------------------

    wildlife_results = wildlife_model.predict(
        source=frame,
        conf=0.55,
        imgsz=640,
        verbose=False,
    )[0]

    for box in wildlife_results.boxes:

        cls_id = int(box.cls[0])
        raw_name = wildlife_model.names[cls_id].strip()

        if raw_name.lower() in {"0", "otherentities"}:
            continue

        species = raw_name.upper()
        confidence = float(box.conf[0])

        x1, y1, x2, y2 = map(int, box.xyxy[0])
        bbox = [x1, y1, x2, y2]

        is_critical = raw_name.lower() in CRITICAL_SPECIES

        wildlife_detections.append({
            "species": species,
            "confidence": round(confidence, 2),
            "alert_level": (
                "CRITICAL" if is_critical else "MONITOR"
            ),
            "bbox": bbox,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "multi_animal_model",
        })

    # --------------------------------------------------------
    # 2. SPECIALIZED WILD BOAR MODEL
    # --------------------------------------------------------

    boar_results = wild_boar_model.predict(
        source=frame,
        conf=0.50,
        imgsz=640,
        verbose=False,
    )[0]

    for box in boar_results.boxes:

        cls_id = int(box.cls[0])
        raw_name = wild_boar_model.names[cls_id].strip()

        confidence = float(box.conf[0])

        x1, y1, x2, y2 = map(int, box.xyxy[0])
        bbox = [x1, y1, x2, y2]

        # Roboflow dataset class Pig represents Wild Boar
        if raw_name.lower() == "pig":
            species = "WILD BOAR"
        else:
            species = raw_name.upper()

        boar_detections.append({
            "species": species,
            "confidence": round(confidence, 2),
            "alert_level": "CRITICAL",
            "bbox": bbox,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "wild_boar_specialized_model",
        })

    # --------------------------------------------------------
    # 3. REMOVE DUPLICATE WILD BOAR DETECTIONS
    # --------------------------------------------------------

    final_detections = []

    for wildlife_detection in wildlife_detections:

        normalized_species = (
            wildlife_detection["species"]
            .lower()
            .replace(" ", "")
        )

        if normalized_species == "wildboar":

            duplicate_found = False

            for boar_detection in boar_detections:

                iou = calculate_iou(
                    wildlife_detection["bbox"],
                    boar_detection["bbox"],
                )

                if iou >= 0.5:
                    duplicate_found = True
                    break

            if duplicate_found:
                continue

        final_detections.append(wildlife_detection)

    # Add specialized Wild Boar detections
    final_detections.extend(boar_detections)

    return final_detections


def update_latest_state(detections, node_code="NODE_001"):
    """Update the latest detection information."""

    global latest_state

    timestamp = datetime.now(timezone.utc).isoformat()

    if detections:

        top = max(
            detections,
            key=lambda detection: detection["confidence"],
        )

        latest_state = {
            "species": top["species"],
            "confidence": top["confidence"],
            "alert_level": top["alert_level"],
            "lora_trigger": latest_state["lora_trigger"],
            "node_code": node_code,
            "timestamp": timestamp,
        }

    else:

        latest_state = {
            "species": "NONE",
            "confidence": 0.0,
            "alert_level": "CLEAR",
            "lora_trigger": latest_state["lora_trigger"],
            "node_code": node_code,
            "timestamp": timestamp,
        }


async def process_uploaded_frame(file):
    """Read and validate an uploaded image."""

    contents = await file.read()
    frame = decode_image(contents)

    if frame is None:
        return None

    return frame


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health():

    return {
        "status": "online",

        # Kept for existing dashboard compatibility
        "classes": list(wildlife_model.names.values()),

        "wildlife_classes": list(
            wildlife_model.names.values()
        ),

        "wild_boar_classes": list(
            wild_boar_model.names.values()
        ),
    }


# ============================================================
# API: EXISTING FRAME DETECTION
# POST /api/detect-frame
# ============================================================

@app.post("/api/detect-frame")
async def detect_frame(file: UploadFile = File(...)):

    frame = await process_uploaded_frame(file)

    if frame is None:
        return {"error": "Invalid image"}

    detections = run_wildlife_detection(frame)

    update_latest_state(detections)

    return {
        "detections": detections,
        "frame_width": frame.shape[1],
        "frame_height": frame.shape[0],
    }


# ============================================================
# API: DASHBOARD CAMERA DETECTION
# POST /detect/camera-frame
# ============================================================

@app.post("/detect/camera-frame")
async def detect_camera_frame(
    file: UploadFile = File(...),
    node_code: str = "NODE_001",
):

    frame = await process_uploaded_frame(file)

    if frame is None:
        return {"error": "Invalid image"}

    detections = run_wildlife_detection(frame)

    update_latest_state(detections, node_code)

    return {
        "node_code": node_code,
        "detections": detections,
        "frame_width": frame.shape[1],
        "frame_height": frame.shape[0],
    }


# ============================================================
# API: LORA TRIGGER
# POST /api/lora-trigger
# ============================================================

@app.post("/api/lora-trigger")
def lora_trigger(
    node_id: str = "NODE_01",
    event: str = "SEISMIC_ACOUSTIC",
):

    latest_state["lora_trigger"] = True

    return {
        "status": "triggered",
        "node_id": node_id,
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================
# API: LATEST ALERT
# GET /api/latest-alert
# ============================================================

@app.get("/api/latest-alert")
def get_latest_alert():

    return latest_state


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "project": "Bhoomi Kavalu",
        "message": "Wildlife Detection API is running",
        "status": "online",
    }
