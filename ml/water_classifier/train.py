"""Train and evaluate a binary water/non-water classifier on EuroSAT RGB.

Water is defined as the EuroSAT River and SeaLake classes. All remaining EuroSAT
classes are non-water. This is a benchmark experiment, not a project-area model.
"""

from __future__ import annotations

import csv
import json
import random
from dataclasses import asdict, dataclass
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import torch
from PIL import Image
from sklearn.metrics import ConfusionMatrixDisplay, accuracy_score, classification_report, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms


ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = ROOT / "data" / "raw" / "2750"
OUT = ROOT / "ml" / "water_classifier" / "artifacts"
SEED = 26167
IMAGE_SIZE = 64
BATCH_SIZE = 128
EPOCHS = 10
LEARNING_RATE = 1e-3


@dataclass
class Example:
    path: str
    label: int
    source_class: str


class EuroSATWaterDataset(Dataset):
    def __init__(self, items: list[Example], transform: transforms.Compose):
        self.items = items
        self.transform = transform

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, index: int):
        item = self.items[index]
        image = Image.open(item.path).convert("RGB")
        return self.transform(image), item.label, item.path


class WaterCNN(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, padding=1), nn.BatchNorm2d(32), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1), nn.BatchNorm2d(64), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, kernel_size=3, padding=1), nn.BatchNorm2d(128), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(128, 128, kernel_size=3, padding=1), nn.BatchNorm2d(128), nn.ReLU(), nn.AdaptiveAvgPool2d(1),
        )
        self.classifier = nn.Sequential(nn.Flatten(), nn.Dropout(0.25), nn.Linear(128, 2))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(x))


def setup_seed() -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)


def collect_examples() -> list[Example]:
    if not DATA_ROOT.exists():
        raise FileNotFoundError(f"EuroSAT images not found at {DATA_ROOT}")
    water_classes = {"River", "SeaLake"}
    water, non_water = [], []
    for class_dir in sorted(DATA_ROOT.iterdir()):
        if not class_dir.is_dir():
            continue
        records = [Example(str(path), int(class_dir.name in water_classes), class_dir.name) for path in sorted(class_dir.glob("*.jpg"))]
        (water if class_dir.name in water_classes else non_water).extend(records)
    if not water or not non_water:
        raise RuntimeError("Expected both water and non-water classes in EuroSAT.")
    # Balance classes before splitting to avoid a high but misleading non-water accuracy.
    random.shuffle(non_water)
    selected = water + non_water[: len(water)]
    random.shuffle(selected)
    return selected


def split_examples(items: list[Example]):
    labels = [item.label for item in items]
    train, temporary = train_test_split(items, test_size=0.30, random_state=SEED, stratify=labels)
    temporary_labels = [item.label for item in temporary]
    validation, test = train_test_split(temporary, test_size=0.50, random_state=SEED, stratify=temporary_labels)
    return train, validation, test


def run_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss, correct, count = 0.0, 0, 0
    for images, labels, _ in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * labels.size(0)
        correct += (outputs.argmax(dim=1) == labels).sum().item()
        count += labels.size(0)
    return total_loss / count, correct / count


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss, count = 0.0, 0
    truth, predictions, probabilities, paths = [], [], [], []
    for images, labels, file_paths in loader:
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        total_loss += criterion(outputs, labels).item() * labels.size(0)
        probs = torch.softmax(outputs, dim=1)[:, 1]
        truth.extend(labels.cpu().tolist())
        predictions.extend(outputs.argmax(dim=1).cpu().tolist())
        probabilities.extend(probs.cpu().tolist())
        paths.extend(file_paths)
        count += labels.size(0)
    return total_loss / count, truth, predictions, probabilities, paths


def save_examples(test_items, predictions, probabilities):
    chosen = list(range(min(12, len(test_items))))
    fig, axes = plt.subplots(3, 4, figsize=(10, 7.5))
    for axis, index in zip(axes.flatten(), chosen):
        item = test_items[index]
        image = Image.open(item.path).convert("RGB")
        predicted = "water" if predictions[index] else "non-water"
        actual = "water" if item.label else "non-water"
        color = "#00796b" if predictions[index] == item.label else "#c62828"
        axis.imshow(image)
        axis.set_title(f"Actual: {actual}\nPredicted: {predicted} ({probabilities[index]:.0%})", color=color, fontsize=8)
        axis.axis("off")
    fig.suptitle("Held-out EuroSAT test predictions", fontsize=14, fontweight="bold")
    fig.tight_layout()
    fig.savefig(OUT / "test-predictions.png", dpi=180, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    setup_seed()
    OUT.mkdir(parents=True, exist_ok=True)
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Using device: {device}")
    items = collect_examples()
    train_items, validation_items, test_items = split_examples(items)
    print(f"Dataset sizes - train: {len(train_items)}, validation: {len(validation_items)}, test: {len(test_items)}")

    train_transform = transforms.Compose([
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.RandomRotation(20),
        transforms.ToTensor(),
        transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
    ])
    evaluation_transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
    ])
    train_loader = DataLoader(EuroSATWaterDataset(train_items, train_transform), batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    validation_loader = DataLoader(EuroSATWaterDataset(validation_items, evaluation_transform), batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    test_loader = DataLoader(EuroSATWaterDataset(test_items, evaluation_transform), batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    model = WaterCNN().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss()
    history, best_state, best_f1 = [], None, -1.0

    for epoch in range(1, EPOCHS + 1):
        train_loss, train_accuracy = run_epoch(model, train_loader, optimizer, criterion, device)
        validation_loss, validation_truth, validation_predictions, _, _ = evaluate(model, validation_loader, criterion, device)
        validation_f1 = f1_score(validation_truth, validation_predictions, zero_division=0)
        row = {"epoch": epoch, "train_loss": train_loss, "train_accuracy": train_accuracy, "validation_loss": validation_loss, "validation_f1": validation_f1}
        history.append(row)
        print("epoch {epoch:02d} | train accuracy {train_accuracy:.3f} | validation F1 {validation_f1:.3f}".format(**row))
        if validation_f1 > best_f1:
            best_f1 = validation_f1
            best_state = {name: value.detach().cpu().clone() for name, value in model.state_dict().items()}

    model.load_state_dict(best_state)
    test_loss, truth, predictions, probabilities, paths = evaluate(model, test_loader, criterion, device)
    metrics = {
        "experiment": "EuroSAT RGB binary water vs non-water",
        "dataset_note": "Water = River + SeaLake; remaining eight EuroSAT RGB land-cover classes = non-water. This benchmark result is not a target-area deployment score.",
        "device": str(device),
        "seed": SEED,
        "train_examples": len(train_items),
        "validation_examples": len(validation_items),
        "test_examples": len(test_items),
        "best_validation_f1": best_f1,
        "test_loss": test_loss,
        "test_accuracy": accuracy_score(truth, predictions),
        "water_precision": precision_score(truth, predictions, zero_division=0),
        "water_recall": recall_score(truth, predictions, zero_division=0),
        "water_f1": f1_score(truth, predictions, zero_division=0),
        "confusion_matrix": confusion_matrix(truth, predictions, labels=[0, 1]).tolist(),
    }
    with (OUT / "metrics.json").open("w") as stream:
        json.dump(metrics, stream, indent=2)
    with (OUT / "training-history.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=history[0].keys())
        writer.writeheader()
        writer.writerows(history)
    torch.save({"model_state_dict": model.state_dict(), "metrics": metrics, "classes": ["non-water", "water"]}, OUT / "water-cnn-eurosat.pt")
    np.savez(OUT / "held-out-predictions.npz", truth=np.array(truth), predictions=np.array(predictions), probabilities=np.array(probabilities), paths=np.array(paths))
    report = classification_report(truth, predictions, target_names=["non-water", "water"], digits=4, zero_division=0)
    (OUT / "classification-report.txt").write_text(report)
    display = ConfusionMatrixDisplay(confusion_matrix=np.asarray(metrics["confusion_matrix"]), display_labels=["non-water", "water"])
    display.plot(cmap="Blues", values_format="d")
    plt.title("Held-out EuroSAT test set")
    plt.savefig(OUT / "confusion-matrix.png", dpi=180, bbox_inches="tight")
    plt.close()
    save_examples(test_items, predictions, probabilities)
    (OUT / "run-specification.json").write_text(json.dumps({"image_size": IMAGE_SIZE, "batch_size": BATCH_SIZE, "epochs": EPOCHS, "learning_rate": LEARNING_RATE}, indent=2))
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
