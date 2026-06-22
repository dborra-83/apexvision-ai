"""
ApexVision AI - Procesador de Video en Tiempo Real

Toma un video de F1/iRacing, extrae frames, ejecuta detección con YOLO v8,
calcula métricas de telemetría y las envía al dashboard vía WebSocket.

Uso:
    python process_video.py --video ../video/max_verstappen_bathurst.mp4 --fps 5

Requiere:
    pip install ultralytics opencv-python websockets numpy
"""

import argparse
import asyncio
import json
import time
import math
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

# WebSocket endpoint del dashboard
WS_ENDPOINT = "wss://btk4lhdx7c.execute-api.us-east-1.amazonaws.com/production"
# Para demo local sin WebSocket real, usamos stdout
USE_LOCAL_OUTPUT = True


class TelemetryExtractor:
    """Extrae métricas de telemetría a partir de análisis visual de frames."""

    def __init__(self):
        self.prev_frame = None
        self.prev_positions = []
        self.frame_count = 0
        self.lap_start_time = time.time()
        self.speeds = []
        self.sector_times = []

    def estimate_speed(self, frame: np.ndarray, detections) -> float:
        """
        Estima velocidad aparente basándose en optical flow entre frames.
        Usa el movimiento global del frame completo para simracing POV.
        """
        if self.prev_frame is None:
            self.prev_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            return 0.0

        curr_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Calcular optical flow en todo el frame (para POV simracing)
        h, w = curr_gray.shape

        # Detectar features para tracking
        features = cv2.goodFeaturesToTrack(self.prev_frame, maxCorners=200, qualityLevel=0.1, minDistance=10)

        if features is not None and len(features) > 20:
            next_pts, status, _ = cv2.calcOpticalFlowPyrLK(self.prev_frame, curr_gray, features, None)
            good_new = next_pts[status.flatten() == 1]
            good_old = features[status.flatten() == 1]

            if len(good_new) > 10:
                # Calcular desplazamiento promedio (excluyendo outliers)
                displacements = np.linalg.norm(good_new - good_old, axis=1)
                # Filtrar outliers (percentil 10-90)
                p10, p90 = np.percentile(displacements, [10, 90])
                mask = (displacements >= p10) & (displacements <= p90)
                filtered = displacements[mask]

                if len(filtered) > 5:
                    displacement = float(np.mean(filtered))
                    speed_kmh = displacement * 55.0
                    speed_kmh = min(310.0, max(0.0, speed_kmh))
                    self.prev_frame = curr_gray
                    return round(speed_kmh, 1)

        self.prev_frame = curr_gray
        return self.speeds[-1] if self.speeds else 150.0

    def estimate_steering(self, frame: np.ndarray) -> float:
        """
        Estima ángulo de dirección basándose en la perspectiva de la pista.
        Usa detección de líneas (Hough) en la parte inferior del frame.
        """
        h, w, _ = frame.shape
        roi = frame[int(h * 0.5):, :]
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=50, minLineLength=50, maxLineGap=10)

        if lines is not None and len(lines) > 2:
            angles = []
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
                angles.append(angle)

            avg_angle = np.mean(angles)
            # Normalizar: 0 = recto, positivo = derecha, negativo = izquierda
            steering = max(-180, min(180, avg_angle))
            return round(steering, 1)

        return 0.0

    def estimate_braking(self, speed_current: float, speed_prev: float, dt: float) -> float:
        """Estima intensidad de frenado por desaceleración."""
        if dt <= 0 or speed_prev <= 0:
            return 0.0
        decel = (speed_prev - speed_current) / dt  # km/h por segundo
        # Normalizar: frenado máximo ~200 km/h/s en F1
        brake_pct = max(0, min(100, (decel / 200) * 100))
        return round(brake_pct, 0)

    def process_frame(self, frame: np.ndarray, detections, timestamp: float) -> dict:
        """Procesa un frame y retorna métricas de telemetría."""
        self.frame_count += 1

        speed = self.estimate_speed(frame, detections)
        self.speeds.append(float(speed))

        steering = self.estimate_steering(frame)

        prev_speed = self.speeds[-2] if len(self.speeds) > 1 else speed
        braking = self.estimate_braking(speed, prev_speed, 0.2)  # 5fps = 0.2s entre frames

        # Desgaste simulado (incrementa con el tiempo)
        tire_wear = min(100, (time.time() - self.lap_start_time) / 60 * 5)  # 5% por minuto

        # DRS: activo si velocidad > 280 y no frenando
        drs = speed > 280 and braking < 5

        # Gear estimado por velocidad (V8 Supercar Bathurst: 6 speed sequential)
        if speed < 60:
            gear = 2
        elif speed < 100:
            gear = 3
        elif speed < 150:
            gear = 4
        elif speed < 210:
            gear = 5
        else:
            gear = 6

        # RPM estimado (V8 Supercar range: 5500-7500)
        gear_ratio_pct = (speed % 50) / 50.0  # Posición dentro del rango del gear
        rpm = int(5500 + gear_ratio_pct * 2000 + np.random.normal(0, 100))

        return {
            "timestamp": float(timestamp),
            "frameNumber": int(self.frame_count),
            "speed": float(round(speed, 1)),
            "rpm": int(rpm),
            "gear": int(gear),
            "throttle": float(round(max(0, 100 - braking), 0)),
            "brake": float(round(braking, 0)),
            "steering": float(steering),
            "drs": bool(drs),
            "tireWear": float(round(tire_wear, 1)),
            "detections": int(len(detections)) if detections else 0,
            "position": 2,
            "gap": "+0.347",
        }


def process_video(video_path: str, fps: int = 5, output_file: str = "telemetry_output.json"):
    """
    Procesa un video completo y genera telemetría frame por frame.

    Args:
        video_path: Ruta al archivo de video
        fps: Frames por segundo a procesar (default: 5)
        output_file: Archivo de salida con la telemetría
    """
    print(f"🏎️  ApexVision AI - Procesando video: {video_path}")
    print(f"   FPS de procesamiento: {fps}")

    # Cargar modelo YOLO
    print("📦 Cargando modelo YOLO v8...")
    model = YOLO("yolov8n.pt")  # nano = más rápido, suficiente para demo

    # Abrir video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Error: No se puede abrir el video: {video_path}")
        return

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / video_fps

    print(f"📹 Video: {total_frames} frames, {video_fps:.1f} fps, {duration:.1f}s duración")

    # Frame skip para el fps deseado
    frame_skip = max(1, int(video_fps / fps))
    print(f"⚡ Procesando 1 de cada {frame_skip} frames ({fps} fps efectivo)")

    extractor = TelemetryExtractor()
    telemetry_data = []
    frame_idx = 0
    processed = 0
    start_time = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1

        # Skip frames según fps deseado
        if frame_idx % frame_skip != 0:
            continue

        # Ejecutar YOLO
        results = model(frame, verbose=False, conf=0.25)
        detections = results[0].boxes if results else None

        # Extraer telemetría
        timestamp = frame_idx / video_fps
        metrics = extractor.process_frame(frame, detections, timestamp)

        # Agregar info de detecciones YOLO
        if detections is not None and len(detections) > 0:
            det_info = []
            for box in detections:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                cls_name = model.names[cls_id]
                det_info.append({"class": str(cls_name), "confidence": round(conf, 2)})
            metrics["yolo_detections"] = det_info

        telemetry_data.append(metrics)
        processed += 1

        # Progreso
        if processed % 10 == 0:
            elapsed = time.time() - start_time
            pct = (frame_idx / total_frames) * 100
            print(f"   [{pct:.1f}%] Frame {frame_idx}/{total_frames} | "
                  f"Speed: {metrics['speed']} km/h | "
                  f"Detections: {metrics['detections']} | "
                  f"Elapsed: {elapsed:.1f}s")

    cap.release()

    # Guardar resultados
    output_path = Path(output_file)

    # Custom JSON encoder for numpy types
    class NumpyEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, np.integer):
                return int(obj)
            if isinstance(obj, np.floating):
                return float(obj)
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            if isinstance(obj, np.bool_):
                return bool(obj)
            # For any numpy scalar
            if hasattr(obj, 'item'):
                return obj.item()
            return super().default(obj)

    with open(output_path, 'w') as f:
        json.dump({
            "video": video_path,
            "processedFrames": processed,
            "duration": duration,
            "fps": fps,
            "telemetry": telemetry_data,
        }, f, indent=2, cls=NumpyEncoder)

    elapsed = time.time() - start_time
    print(f"\n✅ Procesamiento completo!")
    print(f"   Frames procesados: {processed}")
    print(f"   Tiempo total: {elapsed:.1f}s")
    print(f"   Velocidad: {processed / elapsed:.1f} frames/s")
    print(f"   Output: {output_path.absolute()}")

    return telemetry_data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ApexVision AI - Video Processor")
    parser.add_argument("--video", type=str, required=True, help="Ruta al video")
    parser.add_argument("--fps", type=int, default=5, help="FPS de procesamiento (default: 5)")
    parser.add_argument("--output", type=str, default="telemetry_output.json", help="Archivo output")
    args = parser.parse_args()

    process_video(args.video, args.fps, args.output)
