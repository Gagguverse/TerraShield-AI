"""YOLO fire/smoke detection inference.

Loads a pretrained fire/smoke YOLO checkpoint (NOT trained by TerraShield).
Classes: smoke (0), fire (1).

Provenance: rahabdev/fire-smoke-yolov8n on Hugging Face (AGPL-3.0),
2,378 downloads. Base architecture: YOLOv8n via Ultralytics.

Clearly labeled as pretrained — not trained by TerraShield.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import torch
from ultralytics import YOLO

DEFAULT_CHECKPOINT_PATH = os.getenv(
    "THERMAL_YOLO_CHECKPOINT",
    "backend/ml/models/yolo_pretrained/best.pt",
)
IMG_SIZE = 640


class YOLOFireSmokeDetector:
    """Lazy-loaded YOLO fire/smoke detector (pretrained checkpoint)."""

    def __init__(self, checkpoint_path: Optional[str] = None):
        self.checkpoint_path = checkpoint_path or DEFAULT_CHECKPOINT_PATH
        self._model: Optional[YOLO] = None
        self._device: Optional[str] = None
        self._loaded = False
        self._load_error: Optional[str] = None
        self._class_names: dict[int, str] = {}

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def load_error(self) -> Optional[str]:
        return self._load_error

    @property
    def device(self) -> Optional[str]:
        return self._device

    def load(self) -> bool:
        if self._loaded:
            return True

        ckpt_path = Path(self.checkpoint_path)
        if not ckpt_path.exists():
            self._load_error = f"Checkpoint not found: {ckpt_path}"
            return False

        try:
            self._device = "cuda" if torch.cuda.is_available() else "cpu"
            model = YOLO(str(ckpt_path))
            self._model = model
            self._class_names = dict(model.names)
            self._loaded = True
            self._load_error = None

            print(
                f"YOLO fire/smoke detector loaded from {ckpt_path} "
                f"(classes: {self._class_names}, device: {self._device})"
            )
            return True

        except Exception as exc:  # noqa: BLE001
            self._load_error = str(exc)
            print(f"Failed to load YOLO model: {exc}")
            return False

    def predict(
        self,
        image_path: str | Path,
        confidence_threshold: float = 0.25,
    ) -> dict:
        """Run fire/smoke detection on an image.

        Returns a dict with:
          - status: "ok" | "model_unavailable" | "error"
          - detections: list of {label, confidence, box: [x1, y1, x2, y2]}
          - detection_count: number of detections above threshold
          - class_names: mapping of class id to name
          - error: str | None
        """
        if not self._loaded:
            ok = self.load()
            if not ok:
                return {
                    "status": "model_unavailable",
                    "detections": [],
                    "detection_count": 0,
                    "class_names": self._class_names,
                    "error": self._load_error or "Model not loaded",
                }

        image_path = Path(image_path)
        if not image_path.exists():
            return {
                "status": "error",
                "detections": [],
                "detection_count": 0,
                "class_names": self._class_names,
                "error": f"Image not found: {image_path}",
            }

        try:
            results = self._model(
                str(image_path),
                device=self._device,
                conf=confidence_threshold,
                imgsz=IMG_SIZE,
                verbose=False,
            )

            detections = []
            for r in results:
                boxes = r.boxes
                if boxes is None:
                    continue
                for box in boxes:
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].tolist()
                    label = self._class_names.get(cls, str(cls))
                    detections.append(
                        {
                            "label": label,
                            "confidence": round(conf, 6),
                            "box": [round(x, 2) for x in xyxy],
                        }
                    )

            # Save annotated visualization frame
            viz_path = None
            if len(results) > 0:
                try:
                    viz_dir = Path("backend/ml/logs")
                    viz_dir.mkdir(parents=True, exist_ok=True)
                    target_viz = viz_dir / f"yolo_pred_{image_path.stem}.jpg"
                    plotted = results[0].plot(line_width=3, conf=True, labels=True, boxes=True)
                    import cv2
                    cv2.imwrite(str(target_viz), plotted)
                    viz_path = str(target_viz)
                except Exception as exc:  # noqa: BLE001
                    print(f"Failed to save YOLO visualization: {exc}")

            return {
                "status": "ok",
                "detections": detections,
                "detection_count": len(detections),
                "class_names": self._class_names,
                "annotated_image_path": viz_path,
                "error": None,
            }

        except Exception as exc:  # noqa: BLE001
            return {
                "status": "error",
                "detections": [],
                "detection_count": 0,
                "class_names": self._class_names,
                "error": str(exc),
            }


# Singleton instance
yolo_detector = YOLOFireSmokeDetector()
