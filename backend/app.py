"""
Bhoomi Kavalu - Main FastAPI Application
Combines modular routers, WebSocket real-time streaming, and backwards-compatible
endpoints from the original main.py.
"""

import socket
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import Base, SessionLocal, engine, get_db
from backend.seed_data import seed_database
from backend.websocket_manager import ws_manager
from backend.routers import (
    auth_router,
    land_router,
    sensor_router,
    detection_router,
    fusion_router,
    alert_router,
    sms_router,
    dashboard_router,
    esp32_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables & seed demo data if empty
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Bhoomi Kavalu – Wildlife Monitoring & Early Warning API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register modular routers
app.include_router(auth_router.router)
app.include_router(land_router.router)
app.include_router(sensor_router.router)
app.include_router(detection_router.router)
app.include_router(fusion_router.router)
app.include_router(alert_router.router)
app.include_router(sms_router.router)
app.include_router(dashboard_router.router)
app.include_router(esp32_router.router)


@app.post("/esp32/audio")
async def root_esp32_audio(
    request: Request,
    node_id: str = "NODE_001",
    db: Session = Depends(get_db),
):
    return await esp32_router.esp32_audio(request=request, node_id=node_id, db=db)


@app.get("/api/health")
def health():
    return {
        "status": "online",
        "service": "Bhoomi Kavalu API",
        "demo_mode": settings.DEMO_MODE,
    }


@app.get("/api/network-info")
def network_info():
    """Return the laptop's LAN IPv4 address so smartphones can connect over Wi-Fi."""
    lan_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass
    return {"lan_ip": lan_ip}


# Backwards-compatible camera frame endpoints
@app.post("/api/detect-frame")
async def legacy_detect_frame(
    file: UploadFile = File(...),
    node_code: str = "NODE_001",
    db: Session = Depends(get_db),
):
    return await detection_router.detect_camera_frame(file=file, node_code=node_code, db=db)


@app.post("/detect/camera-frame")
async def root_detect_camera_frame(
    file: UploadFile = File(...),
    node_code: str = "NODE_001",
    db: Session = Depends(get_db),
):
    return await detection_router.detect_camera_frame(file=file, node_code=node_code, db=db)


@app.post("/api/lora-trigger")
def legacy_lora_trigger(node_id: str = "NODE_001", event: str = "SEISMIC_ACOUSTIC"):
    return {"status": "triggered", "node_id": node_id, "event": event}


@app.websocket("/ws/sensors/{node_id}")
async def sensor_websocket(websocket: WebSocket, node_id: str):
    await ws_manager.connect(websocket, node_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong", "node_id": node_id})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, node_id)
