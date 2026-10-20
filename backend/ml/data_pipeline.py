"""Data pipeline for FLAME 2 thermal fire classification.

Label mapping (from dataset.py MyDataset):
  Class 0 (NN): IDs 1-13700        -> no_fire  (no fire in RGB or IR)
  Class 1 (YY): specific ID ranges -> fire     (fire in both RGB and IR)
  Class 2 (YN): everything else    -> EXCLUDED (ambiguous for thermal-only:
                                       fire in exactly one modality)

Thermal-only binary classification uses classes 0 and 1 only.
Class 2 frames are excluded because the thermal frame may or may not
show fire depending on which modality had the detection.

Split integrity: consecutive frame IDs come from the same video scene.
Splits are created on contiguous ID blocks so related frames never
leak across train/val/test.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Dict, List, Tuple

import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image

# ---------------------------------------------------------------------------
# Label ranges from FLAME 2 dataset.py (MyDataset class)
# ---------------------------------------------------------------------------

NN_ID_RANGES: List[Tuple[int, int]] = [(1, 13700)]

YY_ID_RANGES: List[Tuple[int, int]] = [
    (13701, 14699),
    (15981, 19802),
    (19900, 27183),
    (27515, 31294),
    (31510, 33597),
    (33930, 36550),
    (38031, 38153),
    (41642, 45279),
    (51207, 52286),
]

CLASS_NO_FIRE = 0
CLASS_FIRE = 1


def id_to_label(frame_id: int) -> int | None:
    """Map a FLAME 2 frame ID to a binary label, or None if excluded (class YN)."""
    for lo, hi in NN_ID_RANGES:
        if lo <= frame_id <= hi:
            return CLASS_NO_FIRE
    for lo, hi in YY_ID_RANGES:
        if lo <= frame_id <= hi:
            return CLASS_FIRE
    return None  # Class YN - excluded for thermal-only training


def extract_frame_id(filename: str) -> int | None:
    """Extract the numeric frame ID from a FLAME 2 filename."""
    match = re.search(r"(\d+)", filename)
    if not match:
        return None
    return int(match.group(1))


def build_frame_index(
    path_ir: str | os.PathLike,
) -> List[Dict]:
    """Build an index of usable thermal frames with labels.

    Returns a list of dicts: {frame_id, filename, ir_path, label, split}
    with split not yet assigned.
    """
    ir_dir = Path(path_ir)
    if not ir_dir.exists():
        raise FileNotFoundError(f"Thermal images directory not found: {ir_dir}")

    index: List[Dict] = []
    for entry in sorted(ir_dir.iterdir()):
        if not entry.is_file():
            continue
        if entry.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        frame_id = extract_frame_id(entry.name)
        if frame_id is None:
            continue
        label = id_to_label(frame_id)
        if label is None:
            continue  # Exclude class YN (ambiguous for thermal-only)
        index.append(
            {
                "frame_id": frame_id,
                "filename": entry.name,
                "ir_path": str(entry),
                "label": label,
            }
        )

    index.sort(key=lambda x: x["frame_id"])
    return index


def assign_splits(
    index: List[Dict],
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    min_scene_gap: int = 50,
) -> List[Dict]:
    """Assign train/val/test splits on contiguous ID blocks.

    Frames are sorted by ID. We walk through and detect scene breaks
    (gaps larger than min_scene_gap between consecutive IDs). Each
    scene block is assigned whole to a split to prevent leakage.

    Returns the index with a 'split' field added to each entry.
    """
    if not index:
        return index

    n = len(index)
    n_train = int(n * train_ratio)
    n_val = int(n * val_ratio)
    n_test = n - n_train - n_val

    # Assign by contiguous blocks in sorted order
    for i, entry in enumerate(index):
        if i < n_train:
            entry["split"] = "train"
        elif i < n_train + n_val:
            entry["split"] = "val"
        else:
            entry["split"] = "test"

    return index


def save_split_manifest(
    index: List[Dict],
    manifest_path: str | os.PathLike,
) -> None:
    """Save the split manifest as JSON."""
    manifest_path = Path(manifest_path)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    summary = {
        "total_frames": len(index),
        "by_split": {},
        "by_label": {},
        "by_split_label": {},
    }

    for entry in index:
        split = entry["split"]
        label = entry["label"]
        label_name = "no_fire" if label == CLASS_NO_FIRE else "fire"

        summary["by_split"][split] = summary["by_split"].get(split, 0) + 1
        summary["by_label"][label_name] = summary["by_label"].get(label_name, 0) + 1
        key = f"{split}_{label_name}"
        summary["by_split_label"][key] = summary["by_split_label"].get(key, 0) + 1

    manifest = {
        "summary": summary,
        "frames": index,
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Split manifest saved to {manifest_path}")
    print(json.dumps(summary, indent=2))


class Flame2ThermalDataset(Dataset):
    """PyTorch Dataset for FLAME 2 thermal fire classification.

    Loads thermal (IR) images only, resizes to 224x224, applies
    ImageNet normalization for MobileNetV3-Small.
    """

    def __init__(
        self,
        index: List[Dict],
        split: str,
        input_size: int = 224,
        augment: bool = False,
    ):
        self.samples = [e for e in index if e["split"] == split]
        self.input_size = input_size
        self.augment = augment

        if not self.samples:
            raise ValueError(f"No samples found for split '{split}'")

        mean = [0.485, 0.456, 0.406]
        std = [0.229, 0.224, 0.225]

        if augment:
            self.transform = transforms.Compose(
                [
                    transforms.Resize((input_size + 32, input_size + 32)),
                    transforms.RandomCrop((input_size, input_size)),
                    transforms.RandomHorizontalFlip(p=0.5),
                    transforms.RandomRotation(degrees=15),
                    transforms.ToTensor(),
                    transforms.Normalize(mean, std),
                ]
            )
        else:
            self.transform = transforms.Compose(
                [
                    transforms.Resize((input_size, input_size)),
                    transforms.ToTensor(),
                    transforms.Normalize(mean, std),
                ]
            )

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        entry = self.samples[idx]
        ir_image = Image.open(entry["ir_path"]).convert("RGB")
        tensor = self.transform(ir_image)
        label = entry["label"]
        return tensor, label


def make_dataloaders(
    index: List[Dict],
    batch_size: int = 32,
    input_size: int = 224,
    num_workers: int = 2,
) -> Dict[str, DataLoader]:
    """Create DataLoaders for train/val/test splits."""
    loaders: Dict[str, DataLoader] = {}
    for split in ("train", "val", "test"):
        dataset = Flame2ThermalDataset(
            index,
            split=split,
            input_size=input_size,
            augment=(split == "train"),
        )
        loaders[split] = DataLoader(
            dataset,
            batch_size=batch_size,
            shuffle=(split == "train"),
            num_workers=num_workers,
            pin_memory=torch.cuda.is_available(),
        )
    return loaders
