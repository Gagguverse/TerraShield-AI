"""Thermal fire inference wrapper for FastAPI integration.

Loads a trained MobileNetV3-Small checkpoint and runs binary
fire/no-fire classification on a thermal (IR) image.

No temperatures, bounding boxes, or confidence scores are fabricated.
Returns the model's actual prediction and score only.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights
from torchvision import transforms
from PIL import Image

LABEL_NAMES = {0: "no_fire", 1: "fire"}

DEFAULT_CHECKPOINT_PATH = os.getenv(
    "THERMAL_MODEL_CHECKPOINT", "backend/ml/models/thermal_mobilenetv3_best.pt"
)
INPUT_SIZE = 224

_transform = transforms.Compose(
    [
        transforms.Resize((INPUT_SIZE, INPUT_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]
)


class ThermalModel:
    """Lazy-loaded thermal fire classification model."""

    def __init__(self, checkpoint_path: Optional[str] = None):
        self.checkpoint_path = checkpoint_path or DEFAULT_CHECKPOINT_PATH
        self._model: Optional[nn.Module] = None
        self._device: Optional[torch.device] = None
        self._loaded = False
        self._load_error: Optional[str] = None
        self._class_names: dict[int, str] = {}
        self._input_size: int = INPUT_SIZE

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def load_error(self) -> Optional[str]:
        return self._load_error

    @property
    def device(self) -> Optional[torch.device]:
        return self._device

    def load(self) -> bool:
        """Load the checkpoint if it exists. Returns True on success."""
        if self._loaded:
            return True

        ckpt_path = Path(self.checkpoint_path)
        if not ckpt_path.exists():
            self._load_error = f"Checkpoint not found: {ckpt_path}"
            return False

        try:
            self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

            # Build model architecture (same as training)
            weights = MobileNet_V3_Small_Weights.DEFAULT
            model = mobilenet_v3_small(weights=weights)
            in_features = model.classifier[0].in_features
            model.classifier = nn.Sequential(
                nn.Linear(in_features, 512),
                nn.ReLU(inplace=True),
                nn.Dropout(0.3),
                nn.Linear(512, 2),
            )

            checkpoint = torch.load(ckpt_path, map_location=self._device)
            model.load_state_dict(checkpoint["model_state_dict"])
            model.to(self._device)
            model.eval()

            self._model = model
            self._class_names = checkpoint.get("class_names", LABEL_NAMES)
            self._input_size = checkpoint.get("input_size", INPUT_SIZE)
            self._loaded = True
            self._load_error = None

            print(
                f"Thermal model loaded from {ckpt_path} "
                f"(epoch {checkpoint.get('epoch', '?')}, "
                f"val_f1 {checkpoint.get('val_f1', '?')})"
            )
            return True

        except Exception as exc:  # noqa: BLE001
            self._load_error = str(exc)
            print(f"Failed to load thermal model: {exc}")
            return False

    def predict(self, image_path: str | Path) -> dict:
        """Run inference on a thermal image file.

        Returns a dict with:
          - status: "ok" | "model_unavailable" | "error"
          - label: "no_fire" | "fire" | None
          - confidence: float (softmax probability for predicted class) | None
          - probabilities: dict of class -> probability | None
          - error: str | None
        """
        if not self._loaded:
            ok = self.load()
            if not ok:
                return {
                    "status": "model_unavailable",
                    "label": None,
                    "confidence": None,
                    "probabilities": None,
                    "error": self._load_error or "Model not loaded",
                }

        image_path = Path(image_path)
        if not image_path.exists():
            return {
                "status": "error",
                "label": None,
                "confidence": None,
                "probabilities": None,
                "error": f"Image not found: {image_path}",
            }

        try:
            image = Image.open(image_path).convert("RGB")
            tensor = _transform(image).unsqueeze(0).to(self._device)

            with torch.no_grad():
                logits = self._model(tensor)
                probs = torch.softmax(logits, dim=1)[0]
                predicted_idx = int(probs.argmax().item())

            confidence = float(probs[predicted_idx].item())
            label = self._class_names.get(str(predicted_idx), str(predicted_idx))
            probabilities = {
                self._class_names.get(str(i), str(i)): float(probs[i].item())
                for i in range(len(probs))
            }

            return {
                "status": "ok",
                "label": label,
                "confidence": round(confidence, 6),
                "probabilities": {k: round(v, 6) for k, v in probabilities.items()},
                "error": None,
            }

        except Exception as exc:  # noqa: BLE001
            return {
                "status": "error",
                "label": None,
                "confidence": None,
                "probabilities": None,
                "error": str(exc),
            }


# Singleton instance
thermal_model = ThermalModel()
