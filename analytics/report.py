"""Dependency-free sales report from a Laravel CSV export."""
import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path


def summarize(rows):
    orders = set()
    revenue = units = 0
    daily = defaultdict(int)
    products = defaultdict(lambda: {"units": 0, "revenue_cents": 0})
    for row in rows:
        if row["status"] != "paid":
            continue
        quantity, price = int(row["quantity"]), int(row["price_cents"])
        if quantity < 1 or price < 0:
            raise ValueError("Invalid sales quantities or prices")
        value = quantity * price
        orders.add(row["order_id"])
        revenue += value
        units += quantity
        daily[row["date"]] += value
        products[row["product"]]["units"] += quantity
        products[row["product"]]["revenue_cents"] += value
    return {"orders": len(orders), "units": units, "revenue_cents": revenue,
            "average_order_cents": round(revenue / len(orders)) if orders else 0,
            "daily_revenue_cents": dict(sorted(daily.items())),
            "products": dict(sorted(products.items(), key=lambda p: p[1]["revenue_cents"], reverse=True))}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    with args.csv.open(newline="", encoding="utf-8") as source:
        report = summarize(csv.DictReader(source))
    result = json.dumps(report, indent=2)
    if args.output:
        args.output.write_text(result + "\n", encoding="utf-8")
    print(result)
