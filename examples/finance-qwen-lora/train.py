from __future__ import annotations

import argparse
from pathlib import Path

import torch
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import SFTConfig, SFTTrainer


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run LoRA/QLoRA supervised fine-tuning for a finance Qwen model."
    )
    parser.add_argument(
        "--model-id",
        default="Qwen/Qwen2.5-3B-Instruct",
        help="Hugging Face model id to fine-tune.",
    )
    parser.add_argument(
        "--train-file",
        default="data/train.jsonl",
        help="Path to the training JSONL file.",
    )
    parser.add_argument(
        "--eval-file",
        default="data/eval.jsonl",
        help="Path to the evaluation JSONL file.",
    )
    parser.add_argument(
        "--output-dir",
        default="artifacts/qwen2.5-3b-finance-lora",
        help="Directory where the LoRA adapter will be saved.",
    )
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--num-train-epochs", type=float, default=3.0)
    parser.add_argument("--per-device-train-batch-size", type=int, default=2)
    parser.add_argument("--per-device-eval-batch-size", type=int, default=2)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=8)
    parser.add_argument("--max-length", type=int, default=2048)
    parser.add_argument("--logging-steps", type=int, default=10)
    parser.add_argument(
        "--no-4bit",
        action="store_true",
        help="Disable 4-bit loading and run regular LoRA instead of QLoRA.",
    )
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--lora-alpha", type=int, default=32)
    parser.add_argument("--lora-dropout", type=float, default=0.05)
    return parser.parse_args()


def detect_precision() -> tuple[bool, bool]:
    if not torch.cuda.is_available():
        return False, False
    if torch.cuda.is_bf16_supported():
        return True, False
    return False, True


def main() -> None:
    args = parse_args()

    train_path = Path(args.train_file)
    eval_path = Path(args.eval_file)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    tokenizer = AutoTokenizer.from_pretrained(args.model_id, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model_kwargs: dict[str, object] = {"device_map": "auto"}
    if not args.no_4bit:
        model_kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
        )
    else:
        if torch.cuda.is_available():
            model_kwargs["torch_dtype"] = (
                torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
            )

    model = AutoModelForCausalLM.from_pretrained(args.model_id, **model_kwargs)
    model.config.use_cache = False

    data_files = {"train": str(train_path)}
    if eval_path.exists():
        data_files["eval"] = str(eval_path)
    dataset = load_dataset("json", data_files=data_files)

    peft_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        target_modules="all-linear",
        task_type="CAUSAL_LM",
    )

    bf16, fp16 = detect_precision()
    training_args = SFTConfig(
        output_dir=str(output_dir),
        learning_rate=args.learning_rate,
        num_train_epochs=args.num_train_epochs,
        per_device_train_batch_size=args.per_device_train_batch_size,
        per_device_eval_batch_size=args.per_device_eval_batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        logging_steps=args.logging_steps,
        save_strategy="epoch",
        eval_strategy="epoch" if "eval" in dataset else "no",
        eos_token="<|im_end|>",
        max_length=args.max_length,
        report_to="none",
        bf16=bf16,
        fp16=fp16,
        gradient_checkpointing=True,
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset["train"],
        eval_dataset=dataset["eval"] if "eval" in dataset else None,
        processing_class=tokenizer,
        peft_config=peft_config,
    )

    trainer.train()
    trainer.model.save_pretrained(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))


if __name__ == "__main__":
    main()
