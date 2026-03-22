from __future__ import annotations

import argparse
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Merge a finance LoRA adapter into the base Qwen model."
    )
    parser.add_argument(
        "--base-model",
        default="Qwen/Qwen2.5-3B-Instruct",
        help="Base Hugging Face model id.",
    )
    parser.add_argument(
        "--adapter-dir",
        default="artifacts/qwen2.5-3b-finance-lora",
        help="Directory containing the LoRA adapter.",
    )
    parser.add_argument(
        "--output-dir",
        default="artifacts/qwen2.5-3b-finance-merged",
        help="Directory where the merged model will be saved.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    torch_dtype = (
        torch.bfloat16
        if torch.cuda.is_available() and torch.cuda.is_bf16_supported()
        else torch.float16
        if torch.cuda.is_available()
        else torch.float32
    )

    tokenizer = AutoTokenizer.from_pretrained(args.base_model, use_fast=True)
    base_model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        torch_dtype=torch_dtype,
        device_map="auto" if torch.cuda.is_available() else None,
    )

    model = PeftModel.from_pretrained(base_model, args.adapter_dir)
    merged = model.merge_and_unload()
    merged.save_pretrained(str(output_dir), safe_serialization=True)
    tokenizer.save_pretrained(str(output_dir))


if __name__ == "__main__":
    main()
