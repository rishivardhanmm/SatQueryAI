"""Create report images from the saved held-out predictions without retraining."""

import json
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import ConfusionMatrixDisplay
import matplotlib.pyplot as plt

sys.path.insert(0, str(Path(__file__).parent))
from train import OUT, collect_examples, split_examples, save_examples, setup_seed  # noqa: E402


def main():
    setup_seed()
    data = np.load(OUT / "held-out-predictions.npz", allow_pickle=True)
    metrics = json.loads((OUT / "metrics.json").read_text())
    _, _, test_items = split_examples(collect_examples())
    display = ConfusionMatrixDisplay(
        confusion_matrix=np.asarray(metrics["confusion_matrix"]),
        display_labels=["non-water", "water"],
    )
    display.plot(cmap="Blues", values_format="d")
    plt.title("Held-out EuroSAT test set")
    plt.savefig(OUT / "confusion-matrix.png", dpi=180, bbox_inches="tight")
    plt.close()
    save_examples(test_items, data["predictions"], data["probabilities"])


if __name__ == "__main__":
    main()
