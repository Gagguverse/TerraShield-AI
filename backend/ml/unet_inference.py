"""U-Net thermal hot-region segmentation inference.

Loads the trained U-Net checkpoint from IGNITE-fire-dataset and runs
binary segmentation (hot region >= 80°C vs background) on thermal TIFF images.

Honest disclosure: the model did not converge well (test Dice ~0.28, IoU ~0.19
on held-out sequence 0004). Results are an initial baseline, not production-ready.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms

from backend.ml.unet import UNet

DEFAULT_CHECKPOINT_PATH = os.getenv(
    "THERMAL_UNET_CHECKPOINT",
    "backend/ml/models/unet_ignite_best.pt",
)
INPUT_SIZE = 256

_img_transform = transforms.Compose(
    [
        transforms.Resize((INPUT_SIZE, INPUT_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.5], [0.5]),
    ]
)


class UNetThermalSegmenter:
    """Lazy-loaded U-Net thermal hot-region segmenter."""

    def __init__(self, checkpoint_path: Optional[str] = None):
        self.checkpoint_path = checkpoint_path or DEFAULT_CHECKPOINT_PATH
        self._model: Optional[UNet] = None
        self._device: Optional[torch.device] = None
        self._loaded = False
        self._load_error: Optional[str] = None
        self._val_dice: Optional[float] = None
        self._val_iou: Optional[float] = None

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
        if self._loaded:
            return True

        ckpt_path = Path(self.checkpoint_path)
        if not ckpt_path.exists():
            self._load_error = f"Checkpoint not found: {ckpt_path}"
            return False

        try:
            self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            model = UNet(n_channels=1, n_classes=1, bilinear=True)
            checkpoint = torch.load(ckpt_path, map_location=self._device)
            model.load_state_dict(checkpoint["model_state_dict"])
            model.to(self._device)
            model.eval()

            self._model = model
            self._val_dice = checkpoint.get("val_dice")
            self._val_iou = checkpoint.get("val_iou")
            self._loaded = True
            self._load_error = None

            print(
                f"U-Net thermal segmenter loaded from {ckpt_path} "
                f"(epoch {checkpoint.get('epoch', '?')}, "
                f"val_dice {self._val_dice}, val_iou {self._val_iou})"
            )
            return True

        except Exception as exc:  # noqa: BLE001
            self._load_error = str(exc)
            print(f"Failed to load U-Net model: {exc}")
            return False

    def predict(self, image_path: str | Path, threshold: float = 0.5) -> dict:
        """Run segmentation on a thermal image.

        Returns a dict with:
          - status: "ok" | "model_unavailable" | "error"
          - hot_pixel_fraction: fraction of pixels predicted as hot region
          - hot_pixel_count: count of pixels predicted as hot
          - mask_path: path to saved visualization PNG (if saved)
          - val_dice: validation Dice from training (for reference)
          - val_iou: validation IoU from training (for reference)
          - error: str | None
        """
        if not self._loaded:
            ok = self.load()
            if not ok:
                return {
                    "status": "model_unavailable",
                    "hot_pixel_fraction": None,
                    "hot_pixel_count": None,
                    "mask_path": None,
                    "val_dice": self._val_dice,
                    "val_iou": self._val_iou,
                    "error": self._load_error or "Model not loaded",
                }

        image_path = Path(image_path)
        if not image_path.exists():
            return {
                "status": "error",
                "hot_pixel_fraction": None,
                "hot_pixel_count": None,
                "mask_path": None,
                "val_dice": self._val_dice,
                "val_iou": self._val_iou,
                "error": f"Image not found: {image_path}",
            }

        try:
            image = Image.open(image_path).convert("L")
            tensor = _img_transform(image).unsqueeze(0).to(self._device)

            with torch.no_grad():
                logits = self._model(tensor)
                probs = torch.sigmoid(logits)[0, 0]  # (H, W)
                pred = (probs > threshold).float()

            hot_pixel_count = int(pred.sum().item())
            hot_pixel_fraction = float(hot_pixel_count / pred.numel())

            # Save visualization
            viz_dir = Path("backend/ml/logs")
            viz_dir.mkdir(parents=True, exist_ok=True)
            viz_path = viz_dir / f"unet_pred_{image_path.stem}.png"

            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt

            fig, axes = plt.subplots(1, 3, figsize=(12, 4))
            # Input (denormalize)
            inp = tensor[0, 0].cpu() * 0.5 + 0.5
            axes[0].imshow(inp, cmap="hot")
            axes[0].set_title("Thermal Input")
            axes[0].axis("off")
            # Probability map
            axes[1].imshow(probs.cpu(), cmap="hot", vmin=0, vmax=1)
            axes[1].set_title("Hot-Region Probability")
            axes[1].axis("off")
            # Binary prediction
            axes[2].imshow(pred.cpu(), cmap="gray", vmin=0, vmax=1)
            axes[2].set_title(f"Prediction (thr={threshold})")
            axes[2].axis("off")
            plt.tight_layout()
            plt.savefig(viz_path, dpi=100, bbox_inches="tight")
            plt.close()

            return {
                "status": "ok",
                "hot_pixel_fraction": round(hot_pixel_fraction, 6),
                "hot_pixel_count": hot_pixel_count,
                "mask_path": str(viz_path),
                "val_dice": self._val_dice,
                "val_iou": self._val_iou,
                "error": None,
            }

        except Exception as exc:  # noqa: BLE001
            return {
                "status": "error",
                "hot_pixel_fraction": None,
                "hot_pixel_count": None,
                "mask_path": None,
                "val_dice": self._val_dice,
                "val_iou": self._val_iou,
                "error": str(exc),
            }


# Singleton instance
unet_segmenter = UNetThermalSegmenter()
