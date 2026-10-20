"""Train U-Net for thermal hot-region segmentation on IGNITE-fire-dataset.

Dataset: https://huggingface.co/datasets/Kyoma001/IGNITE-fire-dataset (CC BY 4.0)
Input: thermal TIFF (640x640), resized to 256x256
Target: mask_80c PNG (binary mask, pixels >= 80°C), resized to 256x256

Split strategy: 4 source sequences (0001-0004).
  Train: sequences 0001, 0002
  Val:   sequence 0003
  Test:  sequence 0004

Limitation: Only 4 independent sequences, so held-out test set is small
(one sequence). Results should be treated as an initial baseline.

Usage (from repo root, with .ml_venv activated):
    python backend/ml/train_unet_ignite.py \
        --data_root "F:\\screenshots\\datasets\\IGNITE" \
        --epochs 30 --batch_size 8 --lr 1e-4 --input_size 256
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from torchvision import transforms

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.ml.unet import UNet


class IGNITEThermalDataset(Dataset):
    """IGNITE thermal hot-region segmentation dataset.

    Loads thermal TIFF images and mask_80c binary masks.
    """

    def __init__(self, pairs: List[Dict], input_size: int = 256, augment: bool = False):
        self.pairs = pairs
        self.input_size = input_size
        self.augment = augment

        self.img_transform = transforms.Compose(
            [
                transforms.Resize((input_size, input_size)),
                transforms.ToTensor(),
                # Normalize to [0,1] - thermal TIFFs are single channel
                transforms.Normalize([0.5], [0.5]),
            ]
        )

        self.mask_transform = transforms.Compose(
            [
                transforms.Resize((input_size, input_size), interpolation=transforms.InterpolationMode.NEAREST),
                transforms.ToTensor(),
            ]
        )

        if augment:
            self.augment_transform = transforms.Compose(
                [
                    transforms.RandomHorizontalFlip(p=0.5),
                    transforms.RandomVerticalFlip(p=0.5),
                    transforms.RandomRotation(degrees=15),
                ]
            )

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        pair = self.pairs[idx]

        # Load thermal TIFF - convert to grayscale (single channel)
        img = Image.open(pair["tiff"]).convert("L")
        mask = Image.open(pair["mask"]).convert("L")

        if self.augment:
            # Apply same random transform to both image and mask
            seed = np.random.randint(0, 2**31 - 1)
            torch.manual_seed(seed)
            img = self.augment_transform(img)
            torch.manual_seed(seed)
            mask = self.augment_transform(mask)

        img = self.img_transform(img)
        mask = self.mask_transform(mask)

        # Binarize mask: >0 means hot region (>=80°C)
        mask = (mask > 0.5).float()

        return img, mask


def build_pairs(data_root: str) -> List[Dict]:
    """Build list of image-mask pairs from IGNITE dataset directory."""
    root = Path(data_root)
    pairs: List[Dict] = []

    for seq_dir in sorted(root.iterdir()):
        if not seq_dir.is_dir():
            continue
        aligned = seq_dir / "processed" / "aligned"
        if not aligned.exists():
            continue
        for pair_dir in sorted(aligned.iterdir()):
            if not pair_dir.is_dir():
                continue
            tiff = pair_dir / "thermal.tiff"
            mask = pair_dir / "mask_80c.png"
            if tiff.exists() and mask.exists():
                pairs.append(
                    {
                        "seq": seq_dir.name,
                        "tiff": str(tiff),
                        "mask": str(mask),
                        "name": pair_dir.name,
                    }
                )

    pairs.sort(key=lambda p: (p["seq"], p["name"]))
    return pairs


def split_by_sequence(pairs: List[Dict]) -> Dict[str, List[Dict]]:
    """Split pairs by sequence ID to prevent leakage.

    Train: sequences 0001, 0002
    Val:   sequence 0003
    Test:  sequence 0004
    """
    splits = {"train": [], "val": [], "test": []}
    for p in pairs:
        seq = p["seq"]
        if seq in ("0001", "0002"):
            splits["train"].append(p)
        elif seq == "0003":
            splits["val"].append(p)
        elif seq == "0004":
            splits["test"].append(p)
    return splits


def save_split_manifest(splits: Dict[str, List[Dict]], manifest_path: str) -> None:
    """Save split manifest as JSON."""
    manifest_path = Path(manifest_path)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    summary = {
        "total_pairs": sum(len(v) for v in splits.values()),
        "by_split": {k: len(v) for k, v in splits.items()},
        "by_sequence": {},
    }

    for split_name, pair_list in splits.items():
        seq_counts = Counter(p["seq"] for p in pair_list)
        summary["by_sequence"][split_name] = dict(seq_counts)

    manifest = {"summary": summary, "splits": splits}

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(json.dumps(summary, indent=2))


class BCEDiceLoss(nn.Module):
    """Combined Binary Cross-Entropy with logits + Soft Dice loss.

    Handles severe class imbalance (hot pixels << background pixels)
    via pos_weight on BCE and the Dice term which is insensitive to
    background dominance.
    """

    def __init__(self, pos_weight: float = 1.0, bce_weight: float = 0.5, dice_weight: float = 0.5):
        super().__init__()
        self.pos_weight = pos_weight
        self.bce_weight = bce_weight
        self.dice_weight = dice_weight
        self.bce = nn.BCEWithLogitsLoss(pos_weight=torch.tensor(pos_weight))

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        bce = self.bce(logits, targets)
        probs = torch.sigmoid(logits)
        smooth = 1e-6
        intersection = (probs * targets).sum()
        union = probs.sum() + targets.sum()
        dice = 1.0 - (2.0 * intersection + smooth) / (union + smooth)
        return self.bce_weight * bce + self.dice_weight * dice


def dice_score(pred: torch.Tensor, target: torch.Tensor, smooth: float = 1e-6) -> float:
    """Compute Dice coefficient."""
    pred = (pred > 0.5).float()
    target = (target > 0.5).float()
    intersection = (pred * target).sum()
    return ((2.0 * intersection + smooth) / (pred.sum() + target.sum() + smooth)).item()


def iou_score(pred: torch.Tensor, target: torch.Tensor, smooth: float = 1e-6) -> float:
    """Compute IoU (Jaccard) coefficient."""
    pred = (pred > 0.5).float()
    target = (target > 0.5).float()
    intersection = (pred * target).sum()
    union = pred.sum() + target.sum() - intersection
    return ((intersection + smooth) / (union + smooth)).item()


def compute_pos_weight(masks: torch.Tensor) -> float:
    """Estimate pos_weight = num_negative / num_positive from mask statistics."""
    total = masks.numel()
    positive = masks.sum().item()
    if positive == 0:
        return 1.0
    negative = total - positive
    return negative / positive


def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: optim.Optimizer,
    device: torch.device,
) -> Tuple[float, float, float, float]:
    model.train()
    running_loss = 0.0
    dice_total = 0.0
    iou_total = 0.0
    n = 0

    for imgs, masks in loader:
        imgs = imgs.to(device, non_blocking=True)
        masks = masks.to(device, non_blocking=True)

        optimizer.zero_grad()
        outputs = model(imgs)
        loss = criterion(outputs, masks)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * imgs.size(0)

        with torch.no_grad():
            probs = torch.sigmoid(outputs)
            dice_total += dice_score(probs, masks) * imgs.size(0)
            iou_total += iou_score(probs, masks) * imgs.size(0)
            n += imgs.size(0)

    return running_loss / n, dice_total / n, iou_total / n


def evaluate(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> Dict:
    model.eval()
    running_loss = 0.0
    dice_total = 0.0
    iou_total = 0.0
    n = 0

    with torch.no_grad():
        for imgs, masks in loader:
            imgs = imgs.to(device, non_blocking=True)
            masks = masks.to(device, non_blocking=True)
            outputs = model(imgs)
            loss = criterion(outputs, masks)

            running_loss += loss.item() * imgs.size(0)
            probs = torch.sigmoid(outputs)
            dice_total += dice_score(probs, masks) * imgs.size(0)
            iou_total += iou_score(probs, masks) * imgs.size(0)
            n += imgs.size(0)

    return {
        "loss": round(running_loss / n, 6),
        "dice": round(dice_total / n, 6),
        "iou": round(iou_total / n, 6),
        "n_samples": n,
    }


def save_prediction_visualization(
    model: nn.Module,
    loader: DataLoader,
    device: torch.device,
    output_path: str,
    num_samples: int = 4,
) -> None:
    """Save side-by-side visualization: input, ground truth, prediction."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    model.eval()
    saved = 0
    fig, axes = plt.subplots(num_samples, 3, figsize=(9, 3 * num_samples))
    if num_samples == 1:
        axes = axes.reshape(1, 3)

    with torch.no_grad():
        for imgs, masks in loader:
            imgs = imgs.to(device)
            masks = masks.to(device)
            outputs = model(imgs)
            probs = torch.sigmoid(outputs)
            preds = (probs > 0.5).float()

            for i in range(min(imgs.size(0), num_samples - saved)):
                row = saved
                # Input (denormalize from [-1,1] to [0,1])
                inp = imgs[i].cpu().squeeze() * 0.5 + 0.5
                axes[row, 0].imshow(inp, cmap="hot")
                axes[row, 0].set_title("Thermal Input")
                axes[row, 0].axis("off")

                # Ground truth
                gt = masks[i].cpu().squeeze()
                axes[row, 1].imshow(gt, cmap="gray")
                axes[row, 1].set_title("Ground Truth (mask_80c)")
                axes[row, 1].axis("off")

                # Prediction
                pr = preds[i].cpu().squeeze()
                axes[row, 2].imshow(pr, cmap="gray")
                axes[row, 2].set_title("U-Net Prediction")
                axes[row, 2].axis("off")

                saved += 1
                if saved >= num_samples:
                    break
            if saved >= num_samples:
                break

    plt.tight_layout()
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"Prediction visualization saved to {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train U-Net on IGNITE thermal data")
    parser.add_argument("--data_root", required=True, help="Path to IGNITE dataset root")
    parser.add_argument(
        "--manifest_out",
        default="backend/ml/splits/ignite_thermal_manifest.json",
        help="Output path for split manifest JSON",
    )
    parser.add_argument(
        "--checkpoint_out",
        default="backend/ml/models/unet_ignite_best.pt",
        help="Output path for best model checkpoint",
    )
    parser.add_argument(
        "--log_out",
        default="backend/ml/logs/unet_training_log.jsonl",
        help="Output path for per-epoch training log (JSONL)",
    )
    parser.add_argument(
        "--viz_out",
        default="backend/ml/logs/unet_prediction_viz.png",
        help="Output path for prediction visualization",
    )
    parser.add_argument("--epochs", type=int, default=30, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=8, help="Batch size (6GB VRAM optimized)")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--input_size", type=int, default=256, help="Input image size")
    parser.add_argument("--num_workers", type=int, default=2, help="DataLoader workers")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    # ---- Build pairs and splits ----
    print(f"\nBuilding pairs from {args.data_root} ...")
    pairs = build_pairs(args.data_root)
    print(f"Total pairs: {len(pairs)}")

    splits = split_by_sequence(pairs)
    save_split_manifest(splits, args.manifest_out)

    for split_name, pair_list in splits.items():
        print(f"  {split_name}: {len(pair_list)} pairs")

    # ---- DataLoaders ----
    train_dataset = IGNITEThermalDataset(splits["train"], input_size=args.input_size, augment=True)
    val_dataset = IGNITEThermalDataset(splits["val"], input_size=args.input_size, augment=False)
    test_dataset = IGNITEThermalDataset(splits["test"], input_size=args.input_size, augment=False)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True,
                              num_workers=args.num_workers, pin_memory=torch.cuda.is_available())
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False,
                            num_workers=args.num_workers, pin_memory=torch.cuda.is_available())
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False,
                             num_workers=args.num_workers, pin_memory=torch.cuda.is_available())

    # ---- Compute pos_weight from training masks ----
    print("\nComputing pos_weight from training masks...")
    pos_sum = 0
    total_pixels = 0
    for pair in splits["train"]:
        mask = Image.open(pair["mask"]).convert("L")
        mask_arr = np.array(mask.resize((args.input_size, args.input_size), Image.Resampling.NEAREST))
        pos_sum += int((mask_arr > 0).sum())
        total_pixels += mask_arr.size
    pos_weight = (total_pixels - pos_sum) / max(pos_sum, 1)
    print(f"  Positive pixels: {pos_sum:,} / {total_pixels:,} ({100*pos_sum/total_pixels:.4f}%)")
    print(f"  pos_weight: {pos_weight:.2f}")

    # ---- Model, loss, optimizer ----
    model = UNet(n_channels=1, n_classes=1, bilinear=True).to(device)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Model parameters: {total_params:,}")

    criterion = BCEDiceLoss(pos_weight=pos_weight, bce_weight=0.5, dice_weight=0.5).to(device)
    optimizer = optim.Adam(model.parameters(), lr=args.lr)

    # ---- Training loop ----
    log_path = Path(args.log_out)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    checkpoint_path = Path(args.checkpoint_out)
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

    best_dice = 0.0
    history: List[dict] = []

    print(f"\nStarting training for {args.epochs} epochs ...")
    for epoch in range(args.epochs):
        epoch_start = time.time()

        train_loss, train_dice, train_iou = train_one_epoch(
            model, train_loader, criterion, optimizer, device
        )
        val_metrics = evaluate(model, val_loader, criterion, device)

        epoch_time = time.time() - epoch_start

        log_entry = {
            "epoch": epoch + 1,
            "train_loss": round(train_loss, 6),
            "train_dice": round(train_dice, 6),
            "train_iou": round(train_iou, 6),
            "val_loss": val_metrics["loss"],
            "val_dice": val_metrics["dice"],
            "val_iou": val_metrics["iou"],
            "epoch_time_sec": round(epoch_time, 2),
        }
        history.append(log_entry)

        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")

        print(
            f"  Epoch {epoch+1:3d}/{args.epochs} | "
            f"train_loss={train_loss:.4f} train_dice={train_dice:.4f} train_iou={train_iou:.4f} | "
            f"val_loss={val_metrics['loss']:.4f} val_dice={val_metrics['dice']:.4f} val_iou={val_metrics['iou']:.4f} | "
            f"{epoch_time:.1f}s"
        )

        if val_metrics["dice"] > best_dice:
            best_dice = val_metrics["dice"]
            torch.save(
                {
                    "epoch": epoch + 1,
                    "model_state_dict": model.state_dict(),
                    "val_dice": best_dice,
                    "val_iou": val_metrics["iou"],
                    "input_size": args.input_size,
                },
                checkpoint_path,
            )
            print(f"  *** New best checkpoint saved (val_dice={best_dice:.4f}) ***")

    # ---- Held-out test evaluation ----
    print("\nRunning held-out test evaluation...")
    test_metrics = evaluate(model, test_loader, criterion, device)
    print(json.dumps(test_metrics, indent=2))

    # Save prediction visualization on test set
    save_prediction_visualization(model, test_loader, device, args.viz_out, num_samples=4)

    print(f"\nTraining complete. Best val Dice: {best_dice:.4f}")
    print(f"Test Dice: {test_metrics['dice']:.4f}, Test IoU: {test_metrics['iou']:.4f}")
    print(f"Checkpoint: {checkpoint_path}")
    print(f"Manifest: {args.manifest_out}")
    print(f"Log: {log_path}")
    print(f"Visualization: {args.viz_out}")


if __name__ == "__main__":
    main()
