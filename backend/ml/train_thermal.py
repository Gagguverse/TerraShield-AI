"""Train MobileNetV3-Small for thermal fire classification on FLAME 2.

Usage (from repo root, with .ml_venv activated):
    python backend/ml/train_thermal.py \
        --path_ir "F:\\datasets\\FLAME2\\254p Thermal Images" \
        --manifest_out backend/ml/splits/flame2_thermal_manifest.json \
        --checkpoint_out backend/ml/models/thermal_mobilenetv3_best.pt \
        --epochs 20 --batch_size 32 --lr 1e-4 --input_size 224

The dataset is NOT bundled with this repo. You must download it from
IEEE DataPort (login required) and point --path_ir at the extracted
"254p Thermal Images" folder.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Tuple

import torch
import torch.nn as nn
import torch.optim as optim
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

# Ensure repo root is on path so backend.ml.data_pipeline is importable
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT))

from backend.ml.data_pipeline import (
    build_frame_index,
    assign_splits,
    save_split_manifest,
    make_dataloaders,
    CLASS_NO_FIRE,
    CLASS_FIRE,
)

LABEL_NAMES = {CLASS_NO_FIRE: "no_fire", CLASS_FIRE: "fire"}


def build_model(device: torch.device, freeze_backbone: bool = True) -> nn.Module:
    """Build MobileNetV3-Small with a binary classification head."""
    weights = MobileNet_V3_Small_Weights.DEFAULT
    model = mobilenet_v3_small(weights=weights)

    if freeze_backbone:
        for param in model.features.parameters():
            param.requires_grad = False

    # Replace classifier: MobileNetV3-Small classifier input is 576 features
    in_features = model.classifier[0].in_features
    model.classifier = nn.Sequential(
        nn.Linear(in_features, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(0.3),
        nn.Linear(512, 2),
    )
    model = model.to(device)
    return model


def train_one_epoch(
    model: nn.Module,
    loader: torch.utils.data.DataLoader,
    criterion: nn.Module,
    optimizer: optim.Optimizer,
    device: torch.device,
) -> Tuple[float, float]:
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    for inputs, targets in loader:
        inputs = inputs.to(device, non_blocking=True)
        targets = targets.to(device, non_blocking=True)

        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * inputs.size(0)
        _, predicted = outputs.max(1)
        total += targets.size(0)
        correct += predicted.eq(targets).sum().item()

    return running_loss / total, correct / total


def evaluate(
    model: nn.Module,
    loader: torch.utils.data.DataLoader,
    criterion: nn.Module,
    device: torch.device,
    split_name: str = "val",
) -> Dict:
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    all_targets: list[int] = []
    all_predicted: list[int] = []

    with torch.no_grad():
        for inputs, targets in loader:
            inputs = inputs.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)
            outputs = model(inputs)
            loss = criterion(outputs, targets)

            running_loss += loss.item() * inputs.size(0)
            _, predicted = outputs.max(1)
            total += targets.size(0)
            correct += predicted.eq(targets).sum().item()

            all_targets.extend(targets.cpu().numpy().tolist())
            all_predicted.extend(predicted.cpu().numpy().tolist())

    avg_loss = running_loss / total
    accuracy = correct / total

    precision = precision_score(all_targets, all_predicted, average="macro", zero_division=0)
    recall = recall_score(all_targets, all_predicted, average="macro", zero_division=0)
    f1 = f1_score(all_targets, all_predicted, average="macro", zero_division=0)
    cm = confusion_matrix(all_targets, all_predicted, labels=[0, 1])

    return {
        "split": split_name,
        "loss": round(avg_loss, 6),
        "accuracy": round(accuracy, 6),
        "precision_macro": round(precision, 6),
        "recall_macro": round(recall, 6),
        "f1_macro": round(f1, 6),
        "confusion_matrix": cm.tolist(),
        "n_samples": total,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train MobileNetV3-Small on FLAME 2 thermal data")
    parser.add_argument("--path_ir", required=True, help="Path to FLAME 2 '254p Thermal Images' folder")
    parser.add_argument(
        "--manifest_out",
        default="backend/ml/splits/flame2_thermal_manifest.json",
        help="Output path for split manifest JSON",
    )
    parser.add_argument(
        "--checkpoint_out",
        default="backend/ml/models/thermal_mobilenetv3_best.pt",
        help="Output path for best model checkpoint",
    )
    parser.add_argument(
        "--log_out",
        default="backend/ml/logs/training_log.jsonl",
        help="Output path for per-epoch training log (JSONL)",
    )
    parser.add_argument("--epochs", type=int, default=20, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size (6GB VRAM optimized)")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--input_size", type=int, default=224, help="Input image size")
    parser.add_argument("--num_workers", type=int, default=2, help="DataLoader workers")
    parser.add_argument("--train_ratio", type=float, default=0.70, help="Train split ratio")
    parser.add_argument("--val_ratio", type=float, default=0.15, help="Val split ratio")
    parser.add_argument(
        "--unfreeze_epoch",
        type=int,
        default=10,
        help="Epoch at which to unfreeze backbone (fine-tuning), or -1 to keep frozen",
    )
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    # ---- Build frame index and splits ----
    print(f"\nBuilding frame index from {args.path_ir} ...")
    index = build_frame_index(args.path_ir)
    print(f"Usable frames (classes NN + YY only, YN excluded): {len(index)}")

    index = assign_splits(
        index,
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        test_ratio=1.0 - args.train_ratio - args.val_ratio,
    )

    manifest_path = Path(args.manifest_out)
    save_split_manifest(index, manifest_path)

    # ---- DataLoaders ----
    loaders = make_dataloaders(
        index,
        batch_size=args.batch_size,
        input_size=args.input_size,
        num_workers=args.num_workers,
    )
    for split_name, loader in loaders.items():
        print(f"  {split_name}: {len(loader.dataset)} samples, {len(loader)} batches")

    # ---- Model, loss, optimizer ----
    model = build_model(device, freeze_backbone=True)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=args.lr)

    # ---- Training loop ----
    log_path = Path(args.log_out)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    checkpoint_path = Path(args.checkpoint_out)
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

    best_val_f1 = 0.0
    history: list[dict] = []

    print(f"\nStarting training for {args.epochs} epochs ...")
    for epoch in range(args.epochs):
        epoch_start = time.time()

        # Optional backbone unfreeze for fine-tuning
        if args.unfreeze_epoch >= 0 and epoch == args.unfreeze_epoch:
            print(f"  Unfreezing backbone at epoch {epoch + 1} for fine-tuning...")
            for param in model.features.parameters():
                param.requires_grad = True
            optimizer = optim.Adam(model.parameters(), lr=args.lr * 0.1)

        train_loss, train_acc = train_one_epoch(
            model, loaders["train"], criterion, optimizer, device
        )
        val_metrics = evaluate(model, loaders["val"], criterion, device, split_name="val")

        epoch_time = time.time() - epoch_start

        log_entry = {
            "epoch": epoch + 1,
            "train_loss": round(train_loss, 6),
            "train_acc": round(train_acc, 6),
            "val_loss": val_metrics["loss"],
            "val_acc": val_metrics["accuracy"],
            "val_precision": val_metrics["precision_macro"],
            "val_recall": val_metrics["recall_macro"],
            "val_f1": val_metrics["f1_macro"],
            "epoch_time_sec": round(epoch_time, 2),
        }
        history.append(log_entry)

        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")

        print(
            f"  Epoch {epoch+1:3d}/{args.epochs} | "
            f"train_loss={train_loss:.4f} train_acc={train_acc:.4f} | "
            f"val_loss={val_metrics['loss']:.4f} val_acc={val_metrics['accuracy']:.4f} | "
            f"val_f1={val_metrics['f1_macro']:.4f} | "
            f"{epoch_time:.1f}s"
        )

        if val_metrics["f1_macro"] > best_val_f1:
            best_val_f1 = val_metrics["f1_macro"]
            torch.save(
                {
                    "epoch": epoch + 1,
                    "model_state_dict": model.state_dict(),
                    "val_f1": best_val_f1,
                    "val_metrics": val_metrics,
                    "class_names": LABEL_NAMES,
                    "input_size": args.input_size,
                },
                checkpoint_path,
            )
            print(f"  *** New best checkpoint saved (val_f1={best_val_f1:.4f}) ***")

    # ---- Held-out test evaluation ----
    print("\nRunning held-out test evaluation...")
    test_metrics = evaluate(model, loaders["test"], criterion, device, split_name="test")
    print(json.dumps(test_metrics, indent=2))

    print("\nClassification report (test set):")
    # Re-run to get per-class report
    model.eval()
    all_targets: list[int] = []
    all_predicted: list[int] = []
    with torch.no_grad():
        for inputs, targets in loaders["test"]:
            inputs = inputs.to(device)
            targets = targets.to(device)
            outputs = model(inputs)
            _, predicted = outputs.max(1)
            all_targets.extend(targets.cpu().numpy().tolist())
            all_predicted.extend(predicted.cpu().numpy().tolist())

    print(
        classification_report(
            all_targets,
            all_predicted,
            target_names=[LABEL_NAMES[0], LABEL_NAMES[1]],
            zero_division=0,
        )
    )


if __name__ == "__main__":
    main()
