"""
Bhoomi Kavalu - Main Server Entry Point
Runs the integrated FastAPI application with modular routers, WebSocket support,
and backward-compatible endpoints for Camera and ESP32 HTTP Audio.
"""

import uvicorn
import socket

def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

if __name__ == "__main__":
    lan_ip = get_lan_ip()
    print("=" * 60)
    print("        BHOOMI KAVALU - INTEGRATED BACKEND SERVER")
    print("=" * 60)
    print(f" * Local URL:   http://127.0.0.1:8000")
    print(f" * Network URL: http://{lan_ip}:8000")
    print(f" * ESP32 Audio Endpoint: http://{lan_ip}:8000/api/esp32/audio?node_id=NODE_001")
    print(f" * Swagger Docs: http://127.0.0.1:8000/docs")
    print("=" * 60)
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=False)
