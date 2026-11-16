# Import daily Google Ads spend

This imports reporting data only. It does not create, activate or change campaigns, budgets or payments. The existing internal Attribution page displays the result at `/admin/analytics/attribution`.

## Prepare an export

Use a Google Ads daily campaign report, in the same account timezone as `ANALYTICS_TZ` (Europe/Madrid by default). Export completed dates with one row per account/campaign/day/currency, without keyword, device or other extra segments. Include these English headers (rename translated headers explicitly):

```csv
Day,Customer ID,Campaign ID,Campaign,Currency code,Cost,Clicks,Impr.
2026-11-01,123-456-7890,42,mcp-de,EUR,12.34,10,100
2026-11-02,123-456-7890,42,mcp-de,EUR,0.00,0,0
```

Remove export titles, date-range descriptions and total rows. Use UTF-8, ISO dates, a decimal point for Cost, and no grouping separators or currency symbols. By default, `Campaign` must equal the landing URL's `utm_campaign` after lowercase normalization. When the Ads display name differs, add the optional **UTM campaign** CSV column with the explicitly verified tracking value for every row. This overrides only the JSON `campaignName` join label; account and campaign IDs remain unchanged. Empty overrides are rejected. Do not guess mappings or strip suffixes.

Known existing exception: Ads display name `ER_S_US_EN_NICHE_14D` uses `utm_campaign=er_s_us_en_niche`; set `UTM campaign` to `er_s_us_en_niche` while retaining its real campaign ID. This importer does not rename the Ads campaign or its URL. Other campaigns can use their exact lowercased display name when it matches the tracking URL. Campaign join labels over 100 characters are rejected because stored UTMs are limited to 100. Preserve numeric account/campaign IDs; account hyphens are removed by the adapter.

A missing day is unknown spend, not zero. Include explicit zero rows only when the account report confirms zero spend. Include all dates in the chosen admin period for a CAC estimate. A current-day import is provisional and remains so after midnight until reimported after that account day closes. Recent partial-day reports and differently aged campaigns are not comparable; use completed common observation windows. The same normalized name across multiple IDs/accounts makes attribution ambiguous and disables CAC.

Convert locally with Python 3 (no dependencies or network):

```sh
python3 scripts/analytics/ads_csv_to_json.py daily-report.csv daily-spend.json
python3 -m unittest discover -s scripts/analytics -p 'test_*.py'
```

Cost is converted to integer hundredths of the stated currency, rounded half up once per daily row. This is not a currency conversion. Batches are limited to 1000 records / 512 KB JSON. Review the generated file before importing. The converter never uploads data.

## Import in the admin dashboard

1. Sign in with a verified email included in `ADMIN_EMAILS`.
2. Open `/admin/analytics/attribution` and find **Import daily advertising spend**.
3. Select the normalized `daily-spend.json` file, then choose **Import spend**. The controls stay disabled while the request is pending.
4. The receipt shows the number of imported daily records and refreshes the report. If permission expired, sign in again; if the format or size is invalid, fix the file and select it again. After a network error, retrying the same file is safe because matching rows are replaced.

The form accepts JSON only, not raw Google Ads CSV. Use the offline converter above first. There is no developer-console step or need to copy credentials.

The endpoint requires an exact same-origin `Origin` header and a verified admin browser session. API bearer keys are not accepted as administrative authority. The entire batch is validated before an atomic transaction; reimporting the same platform/account/campaign/date/currency replaces that day's values, rather than adding spend twice. To correct a wrong value, reimport its corrected record; to correct an erroneously nonzero row, import a confirmed zero for that same identity. Changing identity is a new row and does not delete the old row.

Receipt: `{"imported":2}`. Invalid payloads return 400, unauthorized sessions 401/403, oversized streams 413 and wrong media types 415. Cache invalidation makes the next dashboard request load updated data. No new secret or external API configuration is required.

## Read the report

- Spend, clicks and impressions are sums of imported daily records, with import-day coverage shown. No import means unknown, not zero.
- New payers are distinct accounts whose earliest observed positive payment falls in the selected period. Repeat orders are excluded. The join requires paid Google first-touch source/medium, exact normalized campaign UTM join label and matching payment currency. Historical payment completeness, unlinked users, consent and missing UTMs limit coverage. Organic and other channels do not join.
- CAC is an estimate of imported period spend / matching first payers. It requires every report date and an unambiguous campaign identity. No payers or incomplete coverage means unknown. This is a first-touch activity-period estimate, not click attribution, a matured acquisition cohort or proof of incremental acquisition.
- Team exclusion removes known team payer accounts, not ad spend or anonymous traffic. Campaigns without matching payers stay visible. Payers with known paid campaigns but no matching imported spend appear with unknown spend.
- Currencies remain separate; there is no FX conversion. The table does not claim ROAS, net profit or revenue after ad spend. Those require reconciled refund, fee, provider cost and currency joins.

No production import or payment is required to test this feature. Its integration tests require an isolated local `TEST_DATABASE_URL`.
