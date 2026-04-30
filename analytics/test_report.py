import unittest
from report import summarize

class ReportTest(unittest.TestCase):
    def test_counts_orders_once_and_ignores_unpaid(self):
        rows = [dict(order_id="1", date="2026-10-14", product="Chair", quantity="2", price_cents="500", status="paid"),
                dict(order_id="1", date="2026-10-14", product="Lamp", quantity="1", price_cents="300", status="paid"),
                dict(order_id="2", date="2026-10-14", product="Lamp", quantity="1", price_cents="300", status="cancelled")]
        report = summarize(rows)
        self.assertEqual(report["orders"], 1)
        self.assertEqual(report["revenue_cents"], 1300)
        self.assertEqual(report["units"], 3)
    def test_empty_report(self):
        self.assertEqual(summarize([])["average_order_cents"], 0)

if __name__ == "__main__":
    unittest.main()
