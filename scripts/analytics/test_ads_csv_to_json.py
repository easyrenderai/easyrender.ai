import unittest
from ads_csv_to_json import convert

HEADER = 'Day,Customer ID,Campaign ID,Campaign,Currency code,Cost,Clicks,Impr.\n'

class CsvImportTests(unittest.TestCase):
    def test_maps_daily_export_and_rounds_cost_once(self):
        result = convert(HEADER + '2026-11-01,123-456-7890,42,"MCP, DE",EUR,12.345,10,100\n')
        self.assertEqual(result['records'], [{'date': '2026-11-01', 'platform': 'google_ads', 'accountId': '1234567890', 'campaignId': '42', 'campaignName': 'MCP, DE', 'currency': 'EUR', 'costCents': 1235, 'clicks': 10, 'impressions': 100}])
    def test_explicit_utm_campaign_override_preserves_campaign_identity(self):
        header = HEADER.rstrip('\n') + ',UTM campaign\n'
        result = convert(header + '2026-11-01,123-456-7890,42,ER_S_US_EN_NICHE_14D,EUR,12.34,10,100,er_s_us_en_niche\n')
        self.assertEqual(result['records'][0]['campaignName'], 'er_s_us_en_niche')
        self.assertEqual(result['records'][0]['campaignId'], '42')
        with self.assertRaises(ValueError):
            convert(header + '2026-11-01,123-456-7890,42,ER_S_US_EN_NICHE_14D,EUR,12.34,10,100,   \n')

    def test_rejects_ambiguous_localized_costs_summary_rows_or_missing_columns(self):
        for text in [HEADER + 'Total:,123,42,MCP,EUR,12.34,10,100\n', HEADER + '2026-11-01,123,42,MCP,EUR,"12,34",10,100\n', 'Day,Cost\n2026-11-01,1\n', HEADER + '2026-11-01,123,42,MCP,EUR,-1,10,100\n']:
            with self.assertRaises(ValueError):
                convert(text)

if __name__ == '__main__': unittest.main()
