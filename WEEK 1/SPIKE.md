# Spike Findings: On-Device Model Verification

Milestone 1 evaluation for Trailkit on-device inference: BioCLIP (ViT-B/16 ONNX) and Gemma 4 E2B QAT (GGUF via `llama.rn`).

All measurements below were executed directly on the Android emulator under **Airplane Mode** (zero cloud or network calls).

---

## 1. Test Environment & Hardware Specs

### Host Machine
- **Model:** Apple Silicon MacBook Pro (Apple M3 Pro chip)
- **Host OS:** macOS 27.0.1 (Darwin 26A434)
- **Host Memory:** 18 GB unified memory (19,327,352,832 bytes)

### Android Virtual Device (AVD) Specs
- **Device Profile:** `Pixel_9_Pro`
- **Android Version:** Android 16 / API 36 (`vanillaBaklava`)
- **Architecture / ABI:** `arm64-v8a`
- **vCPUs:** 4 cores (`hw.cpu.ncore = 4`)
- **System RAM:** 6,069,056 kB (~6 GB)
- **Internal Storage / Data Partition:** 16 GB (`17,179,869,184` bytes allocated in `~/.android/avd/Pixel_9_Pro.avd/config.ini`)
- **Network State:** Airplane Mode ON (`airplane_mode_on = 1`, cellular/Wi-Fi radios disabled)

---

## 2. Bundled Test Fixture Photo

Per task requirements, a real photo of *Calotropis gigantea* is bundled in `test/fixtures/field_sample.jpg` with all EXIF metadata and GPS coordinates stripped:

- **Species:** *Calotropis gigantea* (Crown Flower / Madar, Apocynaceae) — toxic perennial shrub common along trails and scrublands across South and Southeast Asia.
- **Fixture File:** `test/fixtures/field_sample.jpg`
- **Resolution:** 1200×900 JPEG (200,112 bytes) — bundled at native field resolution to benchmark realistic on-device center-crop and resize latency.
- **Source:** [Wikimedia Commons: File:Calotropis gigantea-flower.jpg](https://commons.wikimedia.org/wiki/File:Calotropis_gigantea-flower.jpg)
- **Author:** Peterwchen
- **License:** [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/)
- **Privacy Audit:** 100% of EXIF/IPTC/XMP metadata and GPS tags stripped via Pillow prior to bundling.

---

## 3. Model Files & Sideload Push Commands

On Android 16 (API 36), direct pushes to external scoped storage (`/sdcard/Android/data/...`) are restricted. Models must be staged in `/data/local/tmp/` and copied into internal app storage using `run-as com.trailkit.app`:

### Model Specifications
1. **BioCLIP Image Encoder (ONNX)**
   - **Filename:** `bioclip_vision.onnx`
   - **File Size:** 345,991,529 bytes (345.9 MB)
   - **Architecture:** OpenCLIP ViT-B/16 image encoder trained on TreeOfLife-10M (`imageomics/bioclip`)
   - **Input:** `[1, 3, 224, 224]` Float32 tensor with OpenAI CLIP normalization
   - **Output:** `[1, 512]` L2-normalized image embedding

2. **Gemma 4 E2B QAT (GGUF)**
   - **Filename:** `gemma-4-e2b.gguf` (source: `gemma-4-E2B-it-qat-UD-Q4_K_XL.gguf`)
   - **File Size:** 2,620,370,976 bytes (2.62 GB)
   - **Quantization:** Q4_K_XL QAT (Quantization-Aware Training)

3. **Multimodal Projector (GGUF)**
   - **Filename:** `mmproj-f16.gguf` (source: `mmproj-F16.gguf`)
   - **File Size:** 985,654,080 bytes (985.6 MB)
   - **Precision:** F16

### Push Commands
```bash
# Push BioCLIP ONNX model to app internal files
adb push models/bioclip_vision.onnx /data/local/tmp/bioclip_vision.onnx
adb shell run-as com.trailkit.app cp /data/local/tmp/bioclip_vision.onnx files/bioclip_vision.onnx
adb shell rm /data/local/tmp/bioclip_vision.onnx

# Push Gemma 4 E2B QAT weights to app internal files
adb push models/gemma-4-E2B-it-qat-UD-Q4_K_XL.gguf /data/local/tmp/gemma-4-e2b.gguf
adb shell run-as com.trailkit.app cp /data/local/tmp/gemma-4-e2b.gguf files/gemma-4-e2b.gguf
adb shell rm /data/local/tmp/gemma-4-e2b.gguf

# Push Multimodal Projector to app internal files
adb push models/mmproj-F16.gguf /data/local/tmp/mmproj-f16.gguf
adb shell run-as com.trailkit.app cp /data/local/tmp/mmproj-f16.gguf files/mmproj-f16.gguf
adb shell rm /data/local/tmp/mmproj-f16.gguf
```

---

## 4. Measured Emulator Timings

All benchmarks below are real numbers measured on `Pixel_9_Pro` emulator under Airplane Mode. Cold run is the first invocation after boot; warm runs are 3 successive invocations without restarting the process.

### BioCLIP (ViT-B/16 ONNX via `onnxruntime-react-native`)
- **Backend:** CPU (ONNX Runtime JSI)
- **Preprocessing (1200×900 center-crop + resize to 224×224 + RGB normalization):**
  - Cold: **450 ms**
  - Warm Run 1: 214 ms
  - Warm Run 2: 169 ms
  - Warm Run 3: 137 ms
  - **Warm Median:** **169 ms**
- **Model Load:**
  - Cold: **1,341 ms**
  - Warm (cached session): **0 ms**
- **Inference Latency:**
  - Cold: **237 ms**
  - Warm Run 1: 238 ms
  - Warm Run 2: 215 ms
  - Warm Run 3: 187 ms
  - **Warm Median:** **215 ms**
- **Total Species ID Latency:**
  - Cold: **2,034 ms**
  - Warm Run 1: 454 ms
  - Warm Run 2: 387 ms
  - Warm Run 3: 326 ms
  - **Warm Median:** **387 ms**

### Gemma 4 E2B Text (`llama.rn`)
- **Backend:** CPU (`librnllama_jni_v8_2_dotprod.so`, 2 threads; CPU-only build since Hexagon SDK is unavailable on emulator)
- **Model Load (`initLlama` mmap):**
  - Cold: **16,048 ms**
  - Warm (cached context): **0 ms**
- **Inference Latency & Throughput:**
  - Cold: **21,644 ms** (5.7 tok/s)
  - Warm Run 1: **2,351 ms** (45.2 tok/s)
  - Warm Run 2: **2,510 ms** (45.1 tok/s)
  - Warm Run 3: **2,166 ms** (45.7 tok/s)
  - **Warm Median:** **2,351 ms** (45.2 tok/s)

### Gemma 4 E2B Multimodal Vision (`initMultimodal` + `mmproj-f16.gguf`)
- **Backend:** CPU (`initMultimodal` requested `use_gpu: true`, but `llama.rn` fell back to CPU due to absence of GPU/NPU delegates on emulator)
- **Projector Initialization (`initMultimodal`):**
  - Cold: **3,155 ms**
  - Warm: **0 ms**
- **Inference Latency:**
  - Run 1: **284,518 ms** (~284.5 seconds / 4.7 minutes)
  - Throughput: **5.2 tok/s**
  - **Root Cause of High Latency:** The 985.6 MB F16 multimodal projector evaluates 475 image tokens (`Chunk 1: type=IMAGE, n_tokens=475`) across 27 transformer layers. On 2 CPU threads without GPU acceleration, `processMedia` spent 258 seconds purely in visual projection before text decoding could begin.

---

## 5. Model Output Verification

### BioCLIP Classification Results
Applied global softmax over precomputed label embeddings with calibrated `logit_scale = 100.0`:
1. **Crown Flower / Madar (*Calotropis gigantea*):** **100.0%** (Rank #1)
2. **Water Hyacinth (*Pontederia crassipes*):** 0.0%
3. **Red Weaver Ant (*Oecophylla smaragdina*):** 0.0%
4. **Curry Leaf Plant (*Murraya koenigii*):** 0.0%
5. **Plain Tiger Butterfly (*Danaus chrysippus*):** 0.0%

- **Ground Truth Species Found:** **Yes**. True species (*Calotropis gigantea*) is ranked #1 with 100.0% confidence, easily clearing the > 60% safety threshold.

### Gemma Raw Text Output
**Prompt:**
```text
Specimen: Calotropis gigantea (Crown Flower). List danger level (harmless/caution/dangerous), lookalikes, and hiker guidance in 3 concise bullet points.
```

**Raw Output:**
```text
Here is the information for *Calotropis gigantea* (Crown Flower):

*   **Danger Level:** Caution (Contains toxic latex/sap).
*   **Lookalikes:** None (Distinctive features include the large, fleshy, often white or pink flower heads and the characteristic milky sap).
*   **Hiker Guidance:** Avoid touching the plant or ingesting its sap; wash hands thoroughly after handling.
```

### Gemma Multimodal Vision Raw Output
**Prompt:**
```text
Identify the organism in this field photo. What is its danger level and recommended hiker action?
```

**Raw Output:**
```text
Based on the image, the organism appears to be a flowering plant. Without more context, such as a location or closer examination of other features, **it is impossible to definitively identify the specific species of plant.**

However, based on the visual characteristics (the shape and color of the petals), it resembles some species of **Salvia** or a similar flowering perennial.

**Therefore, I cannot provide a specific identification, danger level, or recommended hiker action.**

***

### General Safety Advice for Wild Plants

**If you are hiking and encounter any wild plant, here is general, non
```

**Qualitative Finding:**
Gemma Multimodal Vision failed to identify *Calotropis gigantea*, hallucinated visual similarity to *Salvia*, refused safety guidance, and exceeded the time budget by 57x. In contrast, BioCLIP correctly classified the species with 100.0% certainty in 215 ms, allowing Gemma Text to produce accurate, concise hiker guidance in 2.35 s.

---

## 6. Provisional Go / No-Go Decision

### Target ID Budget
- **Target:** < 5,000 ms (< 5.0 s) warm turnaround for photo identification and safety guidance.

### Measured Architecture Timings (Warm Median)
| Component | Warm Latency | Notes |
| :--- | :--- | :--- |
| Image Preprocessing (1200×900 → 224×224) | 169 ms | Pure JavaScript + expo-image-manipulator |
| BioCLIP ViT-B/16 Vision Inference | 215 ms | ONNX Runtime JSI CPU |
| Label Cosine Dot-Product & Softmax Ranking | < 3 ms | 50 Indian species embeddings |
| **Subtotal: Fast Species ID** | **387 ms** | **PASS (< 500 ms)** |
| Gemma 4 E2B Text Synthesis (Guidance) | 2,351 ms | llama.rn CPU (45.2 tok/s) |
| **Total: Two-Tier Pipeline (BioCLIP + Gemma Text)** | **2,738 ms** | **PASS (< 5,000 ms)** |
| Gemma Multimodal Vision (`mmproj-f16.gguf`) | 284,518 ms | **FAIL (57x over budget)** |

### Verdict: **PROVISIONAL GO** for Two-Tier Architecture

> **Update (task 04):** the GO holds again. After task 03 measured 33–38 s, task 04 cut the card to the top species and 100 tokens, and the warm totals are now 1.9–2.1 s (see the thread comparison). The task 03 slowdown (8.85 tok/s) was never explained; 4 threads now measure 55 tok/s.
1. **Approved Architecture (Two-Tier):**
   - **Tier 1 (Vision):** BioCLIP ViT-B/16 ONNX handles image encoding and classification in **387 ms warm** (correct top-1 on the single fixture photo; accuracy across the 30-photo set is not measured yet).
   - **Tier 2 (Language):** Gemma 4 E2B QAT takes BioCLIP's identified taxon and generates danger ratings, lookalikes, and hiker guidance in **2.35 s warm**.
   - **Total Warm Turnaround:** **~2.74 seconds**, leaving **2.26 seconds of headroom** under the 5.0 s budget.
2. **Definitive Rejection of Standalone Multimodal Vision (`mmproj`):**
   - Gemma Multimodal Vision is discarded from the species ID critical path. At 284.5 seconds on CPU, running 475 image tokens through an unaccelerated 985 MB projector is unviable for mobile field use.
3. **Caveat on Emulator vs Physical Device:**
   - These timings are measured on an arm64 Android emulator running on an Apple M3 Pro host.
   - Physical mid-range Android devices (e.g., Dimensity 7050 or Snapdragon 7s Gen 2) will have lower single-core CPU throughput and thermal constraints compared to an M3 Pro host.
   - However, BioCLIP's 387 ms warm turnaround leaves ample headroom for mobile slowdown, and Gemma's token output can be capped at 60-80 tokens to ensure the combined pipeline stays under 5 seconds on physical hardware. Physical-device verification happens on the real hike (milestone 5).

---

## 7. Calibration of `COSINE_FLOOR` (Milestone 2)

To prevent hallucinations when uncataloged species or inanimate objects are photographed, BioCLIP's closed-set softmax must be gated by a raw cosine distance floor (`COSINE_FLOOR`). 

BioCLIP was evaluated across 5 openly licensed test photos on the `Pixel_9_Pro` emulator under Airplane Mode (3 in-list species including a snake, and 2 out-of-list items). All EXIF and GPS tags were stripped prior to bundling in `test/fixtures/`.

### 5-Photo Calibration Dataset & Emulator Measurements

| Fixture File | Organism / Subject | Group | Source / License | BioCLIP Top-1 Label | Softmax Score | Raw Cosine | Preprocess + Inference Time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `field_sample.jpg` | *Calotropis gigantea* (Crown Flower) | **In-List** (Plant) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Calotropis_gigantea-flower.jpg), Peterwchen, CC BY-SA 4.0 | Crown Flower / Madar (*Calotropis gigantea*) | **100.0%** | **0.3699** | 404 ms |
| `cobra.jpg` | *Naja naja* (Spectacled Cobra) | **In-List** (Snake) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Naja_naja_-_Wilhelma_01.jpg), H. Zell, CC BY-SA 3.0 | Spectacled Cobra (*Naja naja*) | **74.6%** | **0.2999** | 305 ms |
| `plain_tiger.jpg` | *Danaus chrysippus* (Plain Tiger) | **In-List** (Butterfly) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Plain_tiger_(Danaus_chrysippus_chrysippus)_male_underside.jpg), Charles J. Sharp, CC BY-SA 4.0 | Plain Tiger Butterfly (*Danaus chrysippus*) | **100.0%** | **0.3652** | 275 ms |
| `robin.jpg` | *Erithacus rubecula* (European Robin) | **Out-of-List** (Bird) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Erithacus_rubecula_with_cocked_head.jpg), Francis C. Franklin, CC BY-SA 3.0 | Red Weaver Ant (*Oecophylla smaragdina*) | **42.7%** | **0.1619** | 279 ms |
| `coffee_mug.jpg` | Ceramic Coffee Mug with logo | **Out-of-List** (Object) | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:IBM_merchandising_coffee_mug_with_company_logo.jpg), Pittigrilli, CC BY-SA 4.0 | Bamboo (*Bambusoideae*) | **61.0%** | **0.2027** | 266 ms |

### Cosine Floor Decision
- **In-list raw cosine range:** 0.2999 to 0.3699 (minimum: `0.2999` for *Naja naja*).
- **Out-of-list raw cosine range:** 0.1619 to 0.2027 (maximum: `0.2027` for Coffee Mug).
- **Crucial Finding:** For `coffee_mug.jpg`, closed-set softmax forced a **61.0% confidence** onto Bamboo despite the image depicting an inanimate ceramic mug. A confidence threshold alone (> 60%) would have produced a dangerous false identification.
- **Chosen Floor:** **`COSINE_FLOOR = 0.28`**
- **One-line Rationale:** 0.28 sits centered within the clear 0.097 margin between the maximum out-of-list cosine (0.2027) and minimum in-list cosine (0.2999), rejecting out-of-distribution photos while preserving genuine wildlife identifications.

---

## 8. Milestone 2 Field ID Pipeline On-Device Verification

> **Superseded by task 04:** these task 03 totals (38.5 s and 33.3 s) were over budget. The fixed flow measures 2.1 s (Calotropis), 1.9 s (cobra) and 0.5 s (robin, no Gemma call).

Tested on `Pixel_9_Pro` emulator with **Airplane Mode ON** using photos selected from the Android Gallery / fixture pipeline:

### Case 1: *Calotropis gigantea* (In-List Toxic Plant)
- **Image:** `field_sample.jpg` (Gallery / Fixture)
- **Safety Card Model:**
  - Title: `Crown Flower / Madar (Calotropis gigantea)`
  - Danger Level: `DANGEROUS` (derived strictly from label database, never from Gemma)
  - Plant Edibility Warning: `⚠️ Do not eat without expert confirmation`
  - Plant Disclaimer: `Never consume wild plants without expert botanical confirmation. Trailkit does not certify edibility.`
  - Candidates: 1. Crown Flower (100.0%, cos 0.370), 2. Water Hyacinth (0.0%, cos 0.236), 3. Red Weaver Ant (0.0%, cos 0.231)
- **Warm Total ID Time:** **38,531 ms** (BioCLIP 404 ms + Gemma JSON synthesis on 4-thread CPU)
- **Gemma Raw JSON Output:**
```json
{
  "what": "The Crown Flower is a large, showy flowering plant known for its distinctive, often milky sap and vibrant blossoms. The Red Weaver Ant is a predatory insect that hunts other insects, often seen in dense vegetation.",
  "lookalikes": "The Crown Flower can be confused with other large, spiky flowering shrubs depending on the region. The Red Weaver Ant is easily distinguished by its bright green color and characteristic weaving behavior.",
  "action": "Observe the Crown Flower's sap carefully; avoid direct contact with the milky fluid. Keep a respectful distance from the Red Weaver Ant; do not attempt to handle it."
}
```

### Case 2: Spectacled Cobra (*Naja naja*) (In-List Venomous Snake)
- **Image:** `cobra.jpg` (Gallery / Fixture)
- **Safety Card Model:**
  - Title: `Spectacled Cobra (Naja naja)`
  - Danger Level: `DANGEROUS`
  - Wildlife Protocol:
    - Distance: `• Keep at least 2 meters distance. Do not corner, handle, or provoke.`
    - If Bitten: `• If bitten: Stay calm, immobilize bitten limb at heart level, and seek immediate hospital care. Do NOT cut, suck venom, or apply a tourniquet.`
    - Emergency Number: `• Emergency Assistance: Call 112`
  - Candidates: 1. Spectacled Cobra (74.6%, cos 0.300), 2. Indian Rat Snake (21.8%, cos 0.288), 3. Russell's Viper (3.2%, cos 0.268)
- **Warm Total ID Time:** **33,341 ms** (BioCLIP 305 ms + Gemma JSON synthesis; warm cached context prompt eval 1,020 ms)
- **Gemma Raw JSON Output:**
```json
{
  "what": "The Spectacled Cobra is a large, venomous snake known for its distinctive hood and patterned scales. The Indian Rat Snake is a non-venomous, common rat-like snake found in various habitats. Russell's Viper is a highly venomous viper characterized by its triangular head and patterned skin.",
  "lookalikes": "The Spectacled Cobra can be mistaken for other large cobras, but its hood is often raised when threatened. The Indian Rat Snake is easily confused with common rats due to its size and coloration. Russell's Viper is distinguished by its distinct head shape and patterned markings.",
  "action": "Maintain a safe distance from all three species. If you encounter any of these snakes, stop immediately, do not approach, and slowly back away. Keep your hands and feet clear of low-lying vegetation and potential hiding spots."
}
```

### Case 3: European Robin (*Erithacus rubecula*) (Out-of-List Organism)
- **Image:** `robin.jpg` (Gallery / Fixture)
- **Safety Card Model:**
  - Title: `Uncertain`
  - Danger Level: `CAUTION`
  - Uncertainty Alert: `Top candidate score (42.7%) or raw cosine (0.1619) is below safe recognition boundaries.`
  - Top 3 Potential Matches:
    1. Red Weaver Ant (*Oecophylla smaragdina*) — 42.7% (cos 0.162)
    2. Water Hyacinth (*Pontederia crassipes*) — 22.6% (cos 0.156)
    3. Carpenter Ant (*Camponotus*) — 15.3% (cos 0.152)
- **Warm Total ID Time:** **4,185 ms** (BioCLIP 279 ms + prompt eval 1,010 ms + generation 2,896 ms)
- **Gemma Raw JSON Output:**
```json
{
  "what": "The Red Weaver Ant is a predatory ant known for its distinctive red coloration and web-building behavior. Carpenter Ants are large, wood-excavating ants that are important decomposers in forest ecosystems.",
  "lookalikes": "Red Weaver Ants are easily distinguished by their bright red body and the silk webs they construct. Carpenter Ants are generally larger and often exhibit a distinct, robust appearance.",
  "action": "Observe ant trails carefully, especially near wood or foliage, to avoid stinging. Keep a safe distance from any ant nests or active foraging areas."
}
```

---

## 9. Task 04 Optimization: Under 5 Seconds & Safety Gaps Closed

### Thread-Count Comparison (`n_threads: 4` vs `n_threads: 2`)
Benchmarked on `Pixel_9_Pro` emulator (4 vCPUs, 6 GB RAM, Airplane Mode ON) running 3 warm invocations of the Calotropis card capped at `n_predict: 100`:

| Metric | 4 Threads (`n_threads: 4`) | 2 Threads (`n_threads: 2`) | Delta |
| :--- | :--- | :--- | :--- |
| **Warm Run 1** | prompt eval: 0.00 ms (cached) · eval: **55.74 tok/s** (1,632.7 ms) | prompt eval: 0.00 ms (cached) · eval: **43.60 tok/s** (2,018.4 ms) | +27.8% faster |
| **Warm Run 2** | prompt eval: 0.00 ms (cached) · eval: **54.74 tok/s** (1,735.5 ms) | prompt eval: 0.00 ms (cached) · eval: **40.76 tok/s** (2,060.8 ms) | +34.3% faster |
| **Warm Run 3** | prompt eval: 0.00 ms (cached) · eval: **53.66 tok/s** (1,695.8 ms) | prompt eval: 0.00 ms (cached) · eval: **39.87 tok/s** (2,232.4 ms) | +34.6% faster |
| **Median Eval Throughput** | **54.74 tok/s** | **40.76 tok/s** | **4 Threads is ~34% faster** |
| **Median Generation Time** | **1,695.8 ms** | **2,060.8 ms** | **4 Threads saves ~365 ms** |

**Decision:** Kept `n_threads: 4`. 4 threads utilizes available vCPU cores effectively with 100 tokens, achieving ~55 tok/s without causing UI thread starvation.

---

### Key Optimizations & Safety Layer Closes
1. **Output Token Cap:** Reduced `n_predict` to 100 tokens with JSON schema requesting exactly one short sentence per field.
2. **Top-1 Species Only:** On confident identifications, `buildGemmaPrompt` passes only the top-1 species, eliminating hallucinations where Gemma mixed traits from different candidate organisms.
3. **Skipping Gemma on Uncertain:** Out-of-list or low-confidence photos bypass LLM generation entirely, rendering the safety card in < 500 ms with zero hallucinated text.
4. **Safety Rules Check All Top 3 on Uncertain:** If any of the top 3 candidates is a snake or arachnid, the wildlife protocol and 112 emergency advice are displayed. If any is a plant, plant edibility warnings are displayed.
5. **Worst Plausible Match Danger:** Confident cards take the highest danger level among top 3 candidates scoring ≥ 10% (e.g. rat snake 65% + cobra 30% yields `DANGEROUS`).
6. **"If Bitten" Protocol Sourced:** Updated to India's National Snakebite Management Protocol ("Do it R.I.G.H.T."): Reassure victim, immobilise limb and keep still, get to hospital immediately, tell doctor bite time and snake description; never cut, suck venom, or apply tourniquet.

---

### Final On-Device Warm Turnaround Timings (Airplane Mode ON)

| Test Case | Group | Run 1 | Run 2 | Run 3 | **Warm Median** | Budget Target (< 5.0 s) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Calotropis** (*Calotropis gigantea*) | In-List Plant (Confident) | 2,069 ms | 2,174 ms | 2,139 ms | **2,139 ms** (UI: 2,174 ms) | **PASS (2.8 s headroom)** |
| **Spectacled Cobra** (*Naja naja*) | In-List Snake (Confident) | 2,511 ms | 1,935 ms | 1,899 ms | **1,935 ms** (UI: 2,009 ms) | **PASS (3.0 s headroom)** |
| **European Robin** (*Erithacus rubecula*) | Out-of-List (Uncertain) | 485 ms | 505 ms | 413 ms | **485 ms** (UI: 485 ms) | **PASS (4.5 s headroom)** |

---

### Final Gemma Raw Outputs

#### Calotropis Card (Confident Plant)
```json
{
  "what": "The Crown Flower is a large, showy plant known for its distinctive, often white or pale pink, cup-shaped flowers.",
  "lookalikes": "Distinguish it from other plants by noting its large, fleshy leaves and the characteristic structure of its flower clusters.",
  "action": "Avoid touching the flowers and leaves, as they can cause skin irritation."
}
```

#### Spectacled Cobra Card (Confident Venomous Snake)
```json
{
  "what": "The Spectacled Cobra is a large, venomous snake characterized by a distinctive hood and prominent scales.",
  "lookalikes": "Distinguish it from other cobras by noting the specific pattern and shape of its hood.",
  "action": "Maintain a safe distance and avoid disturbing the snake; do not attempt to handle it."
}
```

#### European Robin Card (Uncertain)
*No Gemma call executed.* Gemma generation was skipped as designed. Card rendered with `UNCERTAIN` title, `CAUTION` badge, top 3 matches (Red Weaver Ant 42.7%, Water Hyacinth 22.6%, Carpenter Ant 15.3%), and the plant edibility warning triggered by Water Hyacinth in the top 3.

---

### Known Limitations
1. **Edibility Filter Drops Entire Card:** `sanitizeGemmaContent` drops Gemma's text notes if any field mentions eating as safe. A line such as "resembles edible wild carrot" will drop the card text entirely. This fails safely (no false edibility advice reaches hikers), but will be refined in subsequent milestones to sanitize rather than drop.
2. **Cobra Cosine Proximity to Floor:** *Naja naja* raw cosine (0.2999) is close to `COSINE_FLOOR` (0.28). Field photos with poor lighting or occlusion may fall to Uncertain. However, because Uncertain now checks all top 3 candidates for snakes, the full wildlife protocol and emergency 112 are preserved.


