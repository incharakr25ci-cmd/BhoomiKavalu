"""
Bhoomi Kavalu - WebSocket Connection Manager
Manages real-time sensor and alert subscriptions per node and globally.
"""

from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    """Manages active WebSocket connections grouped by node_id or channel."""

    def __init__(self) -> None:
        self.node_connections: Dict[str, List[WebSocket]] = {}
        self.global_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, node_id: str = "all") -> None:
        await websocket.accept()
        if node_id == "all":
            self.global_connections.append(websocket)
        else:
            self.node_connections.setdefault(node_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, node_id: str = "all") -> None:
        if node_id == "all":
            if websocket in self.global_connections:
                self.global_connections.remove(websocket)
        else:
            conns = self.node_connections.get(node_id, [])
            if websocket in conns:
                conns.remove(websocket)

    async def broadcast_to_node(self, node_id: str, message: dict) -> None:
        """Send JSON payload to subscribers of a specific node and global listeners."""
        dead_node: List[WebSocket] = []
        for ws in self.node_connections.get(node_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead_node.append(ws)
        for ws in dead_node:
            self.disconnect(ws, node_id)

        dead_global: List[WebSocket] = []
        for ws in self.global_connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead_global.append(ws)
        for ws in dead_global:
            self.disconnect(ws, "all")


ws_manager = ConnectionManager()
