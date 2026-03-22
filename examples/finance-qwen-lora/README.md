# Finance Qwen LoRA Example

This example gives you a minimal end-to-end workflow for turning
`Qwen/Qwen2.5-3B-Instruct` into a finance-focused assistant:

1. Generate a starter finance SFT dataset
2. Run LoRA / QLoRA supervised fine-tuning
3. Merge the adapter into the base model
4. Convert the merged model to GGUF
5. Import the GGUF into Ollama

## Files

- `generate_dataset.py` - creates a starter finance instruction dataset
- `train.py` - runs TRL + PEFT supervised fine-tuning
- `merge.py` - merges the LoRA adapter back into the base model
- `Modelfile.template` - starter Ollama model definition
- `requirements.txt` - Python packages for the workflow

## 1. Install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2. Generate the dataset

This creates exactly 100 examples total:

- `data/all.jsonl` - 100 examples
- `data/train.jsonl` - 90 examples
- `data/eval.jsonl` - 10 examples

```bash
python generate_dataset.py
```

## 3. Train the adapter

```bash
python train.py \
  --model-id Qwen/Qwen2.5-3B-Instruct \
  --train-file data/train.jsonl \
  --eval-file data/eval.jsonl \
  --output-dir artifacts/qwen2.5-3b-finance-lora
```

If you have more VRAM and want better quality, switch to:

```bash
python train.py --model-id Qwen/Qwen2.5-7B-Instruct
```

## 4. Merge the adapter

```bash
python merge.py \
  --base-model Qwen/Qwen2.5-3B-Instruct \
  --adapter-dir artifacts/qwen2.5-3b-finance-lora \
  --output-dir artifacts/qwen2.5-3b-finance-merged
```

## 5. Convert to GGUF

```bash
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
python convert-hf-to-gguf.py \
  ../examples/finance-qwen-lora/artifacts/qwen2.5-3b-finance-merged \
  --outfile ../examples/finance-qwen-lora/artifacts/qwen2.5-3b-finance-f16.gguf
```

Optional quantization:

```bash
./build/bin/llama-quantize \
  ../examples/finance-qwen-lora/artifacts/qwen2.5-3b-finance-f16.gguf \
  ../examples/finance-qwen-lora/artifacts/qwen2.5-3b-finance-q4_k_m.gguf \
  q4_k_m
```

## 6. Import into Ollama

Copy `Modelfile.template` to `Modelfile` and update the `FROM` path if needed.

```bash
cp Modelfile.template Modelfile
ollama create qwen2.5-finance -f Modelfile
ollama run qwen2.5-finance
```

## Notes

- This dataset is intentionally small and synthetic. It is good for pipeline validation, not final quality.
- For real finance quality, replace or augment the generated data with your own curated Q&A.
- Keep current market data, regulations, and company-specific facts out of SFT unless they are dated and maintained. Use RAG for that.
