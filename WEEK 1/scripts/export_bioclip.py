#!/usr/bin/env python3
"""
BioCLIP ONNX Exporter & Label Embedding Generator
Exports BioCLIP vision encoder to ONNX and pre-computes text embeddings for 50 common Indian species.
Model: imageomics/bioclip (OpenCLIP ViT-B/16 trained on TreeOfLife-10M)
"""

import json
import os
import sys
from typing import List, Dict, Any

# Curated list of 50 common Indian plants, insects, and snakes found along trails.
# Scientific names match BioCLIP training taxonomy for highest retrieval accuracy.
SPECIES_LABELS: List[Dict[str, str]] = [
    # --- Plants (20) ---
    {"label": "Tulsi / Holy Basil (Ocimum tenuiflorum)", "scientific_name": "Ocimum tenuiflorum", "category": "plant", "danger": "harmless"},
    {"label": "Neem Tree (Azadirachta indica)", "scientific_name": "Azadirachta indica", "category": "plant", "danger": "harmless"},
    {"label": "Banyan Tree (Ficus benghalensis)", "scientific_name": "Ficus benghalensis", "category": "plant", "danger": "harmless"},
    {"label": "Peepal / Sacred Fig (Ficus religiosa)", "scientific_name": "Ficus religiosa", "category": "plant", "danger": "harmless"},
    {"label": "Curry Leaf Plant (Murraya koenigii)", "scientific_name": "Murraya koenigii", "category": "plant", "danger": "harmless"},
    {"label": "Lantana Camara (Lantana camara)", "scientific_name": "Lantana camara", "category": "plant", "danger": "caution"},
    {"label": "Congress Grass / Parthenium (Parthenium hysterophorus)", "scientific_name": "Parthenium hysterophorus", "category": "plant", "danger": "caution"},
    {"label": "Crown Flower / Madar (Calotropis gigantea)", "scientific_name": "Calotropis gigantea", "category": "plant", "danger": "dangerous"},
    {"label": "Castor Bean (Ricinus communis)", "scientific_name": "Ricinus communis", "category": "plant", "danger": "dangerous"},
    {"label": "Datura / Thorn Apple (Datura stramonium)", "scientific_name": "Datura stramonium", "category": "plant", "danger": "dangerous"},
    {"label": "Oleander (Nerium oleander)", "scientific_name": "Nerium oleander", "category": "plant", "danger": "dangerous"},
    {"label": "Touch-Me-Not / Sensitive Plant (Mimosa pudica)", "scientific_name": "Mimosa pudica", "category": "plant", "danger": "harmless"},
    {"label": "Flame of the Forest / Palash (Butea monosperma)", "scientific_name": "Butea monosperma", "category": "plant", "danger": "harmless"},
    {"label": "Indian Gooseberry / Amla (Phyllanthus emblica)", "scientific_name": "Phyllanthus emblica", "category": "plant", "danger": "harmless"},
    {"label": "Gulmohar / Royal Poinciana (Delonix regia)", "scientific_name": "Delonix regia", "category": "plant", "danger": "harmless"},
    {"label": "Tamarind Tree (Tamarindus indica)", "scientific_name": "Tamarindus indica", "category": "plant", "danger": "harmless"},
    {"label": "Aloe Vera (Aloe vera)", "scientific_name": "Aloe vera", "category": "plant", "danger": "harmless"},
    {"label": "Bamboo (Bambusoideae)", "scientific_name": "Bambusoideae", "category": "plant", "danger": "harmless"},
    {"label": "Teak Tree (Tectona grandis)", "scientific_name": "Tectona grandis", "category": "plant", "danger": "harmless"},
    {"label": "Water Hyacinth (Pontederia crassipes)", "scientific_name": "Pontederia crassipes", "category": "plant", "danger": "harmless"},

    # --- Insects & Arachnids (15) ---
    {"label": "Asian Giant Hornet (Vespa mandarinia)", "scientific_name": "Vespa mandarinia", "category": "insect", "danger": "dangerous"},
    {"label": "Paper Wasp (Polistes)", "scientific_name": "Polistes", "category": "insect", "danger": "caution"},
    {"label": "Indian Honey Bee (Apis cerana indica)", "scientific_name": "Apis cerana indica", "category": "insect", "danger": "harmless"},
    {"label": "Red Weaver Ant (Oecophylla smaragdina)", "scientific_name": "Oecophylla smaragdina", "category": "insect", "danger": "caution"},
    {"label": "Carpenter Ant (Camponotus)", "scientific_name": "Camponotus", "category": "insect", "danger": "harmless"},
    {"label": "Plain Tiger Butterfly (Danaus chrysippus)", "scientific_name": "Danaus chrysippus", "category": "insect", "danger": "harmless"},
    {"label": "Common Mormon Butterfly (Papilio polytes)", "scientific_name": "Papilio polytes", "category": "insect", "danger": "harmless"},
    {"label": "Blue Mormon Butterfly (Papilio polymnestor)", "scientific_name": "Papilio polymnestor", "category": "insect", "danger": "harmless"},
    {"label": "Indian Blister Beetle (Mylabris phalerata)", "scientific_name": "Mylabris phalerata", "category": "insect", "danger": "caution"},
    {"label": "Praying Mantis (Mantodea)", "scientific_name": "Mantodea", "category": "insect", "danger": "harmless"},
    {"label": "Green Darner Dragonfly (Anax junius)", "scientific_name": "Anax junius", "category": "insect", "danger": "harmless"},
    {"label": "Dung Beetle (Scarabaeinae)", "scientific_name": "Scarabaeinae", "category": "insect", "danger": "harmless"},
    {"label": "Yellow Paper Wasp (Ropalidia marginata)", "scientific_name": "Ropalidia marginata", "category": "insect", "danger": "caution"},
    {"label": "Indian Red Scorpion (Hottentotta tamulus)", "scientific_name": "Hottentotta tamulus", "category": "arachnid", "danger": "dangerous"},
    {"label": "Signature Spider (Argiope anasuja)", "scientific_name": "Argiope anasuja", "category": "arachnid", "danger": "harmless"},

    # --- Snakes & Reptiles (15) ---
    {"label": "Spectacled Cobra (Naja naja)", "scientific_name": "Naja naja", "category": "snake", "danger": "dangerous"},
    {"label": "Russell's Viper (Daboia russelii)", "scientific_name": "Daboia russelii", "category": "snake", "danger": "dangerous"},
    {"label": "Saw-Scaled Viper (Echis carinatus)", "scientific_name": "Echis carinatus", "category": "snake", "danger": "dangerous"},
    {"label": "Common Krait (Bungarus caeruleus)", "scientific_name": "Bungarus caeruleus", "category": "snake", "danger": "dangerous"},
    {"label": "King Cobra (Ophiophagus hannah)", "scientific_name": "Ophiophagus hannah", "category": "snake", "danger": "dangerous"},
    {"label": "Bamboo Pit Viper (Craspedocephalus gramineus)", "scientific_name": "Craspedocephalus gramineus", "category": "snake", "danger": "dangerous"},
    {"label": "Hump-Nosed Pit Viper (Hypnale hypnale)", "scientific_name": "Hypnale hypnale", "category": "snake", "danger": "dangerous"},
    {"label": "Indian Rock Python (Python molurus)", "scientific_name": "Python molurus", "category": "snake", "danger": "caution"},
    {"label": "Green Vine Snake (Ahaetulla nasuta)", "scientific_name": "Ahaetulla nasuta", "category": "snake", "danger": "harmless"},
    {"label": "Indian Rat Snake (Ptyas mucosa)", "scientific_name": "Ptyas mucosa", "category": "snake", "danger": "harmless"},
    {"label": "Checkered Keelback (Fowlea piscator)", "scientific_name": "Fowlea piscator", "category": "snake", "danger": "harmless"},
    {"label": "Striped Keelback (Amphiesma stolatum)", "scientific_name": "Amphiesma stolatum", "category": "snake", "danger": "harmless"},
    {"label": "Common Wolf Snake (Lycodon aulicus)", "scientific_name": "Lycodon aulicus", "category": "snake", "danger": "harmless"},
    {"label": "Common Trinket Snake (Coelognathus helena)", "scientific_name": "Coelognathus helena", "category": "snake", "danger": "harmless"},
    {"label": "Indian Garden Lizard / Calotes (Calotes versicolor)", "scientific_name": "Calotes versicolor", "category": "reptile", "danger": "harmless"},
]

def export_onnx(model, output_path: str):
    import torch

    class BioCLIPVisionWrapper(torch.nn.Module):
        def __init__(self, visual_encoder):
            super().__init__()
            self.visual_encoder = visual_encoder

        def forward(self, image):
            embedding = self.visual_encoder(image)
            return embedding / embedding.norm(dim=-1, keepdim=True)

    vision_model = BioCLIPVisionWrapper(model.visual)
    vision_model.eval()

    dummy_input = torch.randn(1, 3, 224, 224, dtype=torch.float32)
    print(f"Exporting vision encoder to ONNX: {output_path}...")
    torch.onnx.export(
        vision_model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=18,
        do_constant_folding=True,
        input_names=["image"],
        output_names=["embedding"],
        dynamic_axes={"image": {0: "batch_size"}, "embedding": {0: "batch_size"}},
    )
    import onnx
    consolidated = onnx.load(output_path, load_external_data=True)
    onnx.save_model(consolidated, output_path, save_as_external_data=False)
    data_file = output_path + ".data"
    if os.path.exists(data_file):
        os.remove(data_file)
    print("ONNX export complete (self-contained).")


def compute_label_embeddings(model, tokenizer, output_json_path: str):
    import torch

    model.eval()
    results = []

    print(f"Computing text embeddings for {len(SPECIES_LABELS)} species using scientific name prompts...")
    with torch.no_grad():
        for item in SPECIES_LABELS:
            prompt = f"a photo of {item['scientific_name']}"
            tokens = tokenizer([prompt])
            text_feature = model.encode_text(tokens)
            text_feature = text_feature / text_feature.norm(dim=-1, keepdim=True)
            embedding_list = text_feature.squeeze(0).cpu().tolist()

            results.append({
                "label": item["label"],
                "scientific_name": item["scientific_name"],
                "category": item["category"],
                "danger": item["danger"],
                "embedding": [round(x, 6) for x in embedding_list],
            })

    logit_scale = round(float(model.logit_scale.exp().item()), 4)
    payload = {
        "logit_scale": logit_scale,
        "labels": results,
    }

    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"Saved {len(results)} label embeddings (logit_scale={logit_scale}) to {output_json_path}")


def main():
    try:
        import open_clip
        import torch
    except ImportError:
        print("Please install dependencies: pip install open_clip_torch torch onnx")
        sys.exit(1)

    print("Loading imageomics/bioclip model...")
    model, _, preprocess = open_clip.create_model_and_transforms('hf-hub:imageomics/bioclip')
    tokenizer = open_clip.get_tokenizer('hf-hub:imageomics/bioclip')

    os.makedirs("models", exist_ok=True)
    os.makedirs("assets", exist_ok=True)

    onnx_path = os.path.join("models", "bioclip_vision.onnx")
    labels_path = os.path.join("assets", "bioclip_labels.json")

    if not os.path.exists(onnx_path) or os.path.getsize(onnx_path) < 100_000_000:
        export_onnx(model, onnx_path)
    else:
        print(f"ONNX model exists at {onnx_path} ({os.path.getsize(onnx_path)} bytes), skipping re-export.")

    compute_label_embeddings(model, tokenizer, labels_path)


if __name__ == "__main__":
    main()
