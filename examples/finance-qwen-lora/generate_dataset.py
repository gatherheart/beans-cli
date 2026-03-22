from __future__ import annotations

import json
import random
from pathlib import Path


SYSTEM_PROMPT = (
    "You are a finance assistant. Separate facts, assumptions, and calculations "
    "clearly. Do not invent current market data."
)


TOPICS = [
    {
        "name": "current ratio",
        "formula": "Current ratio = Current assets / Current liabilities.",
        "interpretation_high": "Usually stronger short-term liquidity, though an unusually high value can also mean idle working capital.",
        "interpretation_low": "Usually weaker short-term liquidity and more pressure meeting near-term obligations.",
        "numerator_label": "current assets",
        "denominator_label": "current liabilities",
        "calc_values": (180, 100),
        "compare_values": ((180, 100), (150, 120)),
        "statement_link": "It is tied to working capital items on the balance sheet.",
        "caveat": "Inventory quality and receivable collectability still matter.",
    },
    {
        "name": "quick ratio",
        "formula": "Quick ratio = (Cash + Marketable securities + Accounts receivable) / Current liabilities.",
        "interpretation_high": "Usually indicates stronger near-term liquidity without relying on inventory sales.",
        "interpretation_low": "May indicate tighter short-term liquidity if the company cannot quickly convert assets to cash.",
        "numerator_label": "quick assets",
        "denominator_label": "current liabilities",
        "calc_values": (120, 80),
        "compare_values": ((120, 80), (90, 90)),
        "statement_link": "It focuses on the most liquid balance-sheet assets.",
        "caveat": "Receivables may still be slow to collect in practice.",
    },
    {
        "name": "debt-to-equity ratio",
        "formula": "Debt-to-equity ratio = Total debt / Shareholders' equity.",
        "interpretation_high": "Usually indicates greater financial leverage and potentially higher risk.",
        "interpretation_low": "Usually indicates less leverage, though too little debt can also reduce capital efficiency.",
        "numerator_label": "total debt",
        "denominator_label": "shareholders' equity",
        "calc_values": (90, 60),
        "compare_values": ((90, 60), (50, 70)),
        "statement_link": "It compares financing from creditors versus owners on the balance sheet.",
        "caveat": "Capital-intensive industries often run higher leverage than software companies.",
    },
    {
        "name": "interest coverage ratio",
        "formula": "Interest coverage ratio = EBIT / Interest expense.",
        "interpretation_high": "Usually means more room to service interest payments.",
        "interpretation_low": "Usually means less buffer if earnings weaken.",
        "numerator_label": "EBIT",
        "denominator_label": "interest expense",
        "calc_values": (75, 15),
        "compare_values": ((75, 15), (48, 24)),
        "statement_link": "It links operating profit from the income statement to financing cost.",
        "caveat": "Non-recurring EBIT can overstate repayment capacity.",
    },
    {
        "name": "gross margin",
        "formula": "Gross margin = (Revenue - Cost of goods sold) / Revenue.",
        "interpretation_high": "Usually means stronger unit economics or pricing power.",
        "interpretation_low": "Usually means thinner buffer to absorb operating expenses.",
        "numerator_label": "gross profit",
        "denominator_label": "revenue",
        "calc_values": (45, 120),
        "compare_values": ((45, 120), (30, 110)),
        "statement_link": "It is an income-statement measure of production or service delivery efficiency.",
        "caveat": "Changes in product mix can move the metric even if pricing is stable.",
    },
    {
        "name": "operating margin",
        "formula": "Operating margin = Operating income / Revenue.",
        "interpretation_high": "Usually suggests a stronger operating model and better cost control.",
        "interpretation_low": "Usually suggests operating costs consume a larger share of revenue.",
        "numerator_label": "operating income",
        "denominator_label": "revenue",
        "calc_values": (24, 120),
        "compare_values": ((24, 120), (12, 100)),
        "statement_link": "It measures core operating profitability on the income statement.",
        "caveat": "Temporary SG&A cuts can boost it without improving long-term economics.",
    },
    {
        "name": "return on equity",
        "formula": "Return on equity = Net income / Average shareholders' equity.",
        "interpretation_high": "Usually indicates strong profitability relative to the equity base.",
        "interpretation_low": "Usually indicates weaker profitability or an oversized equity base.",
        "numerator_label": "net income",
        "denominator_label": "average shareholders' equity",
        "calc_values": (18, 90),
        "compare_values": ((18, 90), (12, 100)),
        "statement_link": "It combines income-statement profit with the balance-sheet equity base.",
        "caveat": "Buybacks and high leverage can lift ROE without improving the business.",
    },
    {
        "name": "free cash flow",
        "formula": "Free cash flow = Operating cash flow - Capital expenditures.",
        "interpretation_high": "Usually means more internally generated cash is available after reinvestment.",
        "interpretation_low": "Usually means less cash is left after maintaining or growing the asset base.",
        "numerator_label": "operating cash flow minus capex",
        "denominator_label": "not applicable",
        "calc_values": (70, 25),
        "compare_values": ((70, 25), (55, 35)),
        "statement_link": "It is derived from the cash flow statement.",
        "caveat": "One-time working capital swings can distort the number.",
    },
    {
        "name": "price-to-earnings ratio",
        "formula": "P/E ratio = Share price / Earnings per share.",
        "interpretation_high": "The market may be pricing in stronger growth, lower risk, or both.",
        "interpretation_low": "The market may be pricing in slower growth, higher risk, or temporary earnings strength.",
        "numerator_label": "share price",
        "denominator_label": "earnings per share",
        "calc_values": (48, 4),
        "compare_values": ((48, 4), (30, 3)),
        "statement_link": "It connects market valuation to per-share earnings.",
        "caveat": "It is less useful when earnings are cyclical, distorted, or negative.",
    },
    {
        "name": "EV/EBITDA",
        "formula": "EV/EBITDA = Enterprise value / EBITDA.",
        "interpretation_high": "The market may expect stronger growth, better quality, or both.",
        "interpretation_low": "The market may expect slower growth, higher risk, or weaker quality.",
        "numerator_label": "enterprise value",
        "denominator_label": "EBITDA",
        "calc_values": (360, 45),
        "compare_values": ((360, 45), (280, 50)),
        "statement_link": "It compares total firm value with a pre-interest, pre-tax operating earnings measure.",
        "caveat": "It ignores capex needs and can flatter asset-heavy businesses.",
    },
]


def finance_messages(user: str, assistant: str) -> dict[str, list[dict[str, str]]]:
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]
    }


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def ratio(value: float) -> str:
    return f"{value:.2f}x"


def build_examples() -> list[dict[str, list[dict[str, str]]]]:
    examples: list[dict[str, list[dict[str, str]]]] = []

    for topic in TOPICS:
        a, b = topic["calc_values"]
        compare_a, compare_b = topic["compare_values"]

        if topic["name"] == "free cash flow":
            computed_value = a - b
            calc_answer = (
                f"{topic['formula']} With operating cash flow of {a} and capex of {b}, "
                f"free cash flow is {computed_value}."
            )
            compare_metric_a = compare_a[0] - compare_a[1]
            compare_metric_b = compare_b[0] - compare_b[1]
            compare_answer = (
                f"Company A free cash flow = {compare_a[0]} - {compare_a[1]} = {compare_metric_a}. "
                f"Company B free cash flow = {compare_b[0]} - {compare_b[1]} = {compare_metric_b}. "
                f"On this metric alone, Company A generated more residual cash."
            )
        elif topic["name"] in {"gross margin", "operating margin", "return on equity"}:
            computed_value = a / b
            calc_answer = (
                f"{topic['formula']} With {topic['numerator_label']} of {a} and "
                f"{topic['denominator_label']} of {b}, the result is {pct(computed_value)}."
            )
            compare_metric_a = compare_a[0] / compare_a[1]
            compare_metric_b = compare_b[0] / compare_b[1]
            compare_answer = (
                f"Company A = {pct(compare_metric_a)} and Company B = {pct(compare_metric_b)}. "
                f"Company A is higher on this metric."
            )
        else:
            computed_value = a / b
            calc_answer = (
                f"{topic['formula']} With {topic['numerator_label']} of {a} and "
                f"{topic['denominator_label']} of {b}, the result is {ratio(computed_value)}."
            )
            compare_metric_a = compare_a[0] / compare_a[1]
            compare_metric_b = compare_b[0] / compare_b[1]
            compare_answer = (
                f"Company A = {ratio(compare_metric_a)} and Company B = {ratio(compare_metric_b)}. "
                f"Company A is higher on this metric."
            )

        examples.extend(
            [
                finance_messages(
                    f"What is the {topic['name']}?",
                    f"{topic['formula']} {topic['statement_link']}",
                ),
                finance_messages(
                    f"How do I calculate the {topic['name']}?",
                    topic["formula"],
                ),
                finance_messages(
                    f"Calculate the {topic['name']} using {topic['numerator_label']} = {a} and {topic['denominator_label']} = {b}.",
                    calc_answer,
                ),
                finance_messages(
                    f"What does a high {topic['name']} usually mean?",
                    topic["interpretation_high"],
                ),
                finance_messages(
                    f"What does a low {topic['name']} usually mean?",
                    topic["interpretation_low"],
                ),
                finance_messages(
                    f"Compare two companies on {topic['name']}. Company A uses {compare_a[0]} and {compare_a[1]}; Company B uses {compare_b[0]} and {compare_b[1]}.",
                    compare_answer,
                ),
                finance_messages(
                    f"Which financial statement is most relevant when analyzing the {topic['name']}?",
                    topic["statement_link"],
                ),
                finance_messages(
                    f"What is one caveat I should remember when using the {topic['name']}?",
                    topic["caveat"],
                ),
                finance_messages(
                    f"Give me a short answer format for the {topic['name']}.",
                    "Answer format:\n1. Formula\n2. Calculation or required inputs\n3. Interpretation\n4. One caveat",
                ),
                finance_messages(
                    f"Should I make an investment decision using only the {topic['name']}?",
                    "No. A single metric should not drive an investment decision. Combine it with business quality, cash flow, leverage, valuation, and relevant current information.",
                ),
            ]
        )

    if len(examples) != 100:
        raise RuntimeError(f"Expected 100 examples, got {len(examples)}")

    return examples


def write_jsonl(path: Path, rows: list[dict[str, list[dict[str, str]]]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> None:
    root = Path(__file__).resolve().parent
    data_dir = root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    examples = build_examples()
    random.Random(42).shuffle(examples)
    train_examples = examples[:90]
    eval_examples = examples[90:]

    write_jsonl(data_dir / "all.jsonl", examples)
    write_jsonl(data_dir / "train.jsonl", train_examples)
    write_jsonl(data_dir / "eval.jsonl", eval_examples)

    print(f"Wrote {len(examples)} total examples to {data_dir / 'all.jsonl'}")
    print(f"Wrote {len(train_examples)} train examples to {data_dir / 'train.jsonl'}")
    print(f"Wrote {len(eval_examples)} eval examples to {data_dir / 'eval.jsonl'}")


if __name__ == "__main__":
    main()
