"""Offline Google Ads daily CSV adapter. Does not contact Ads, the app or a database."""
import argparse
import csv
import io
import json
import re
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

COLUMNS = {'Day', 'Customer ID', 'Campaign ID', 'Campaign', 'Currency code', 'Cost', 'Clicks', 'Impr.'}


def convert(text):
    reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    if not COLUMNS.issubset(set(reader.fieldnames or [])):
        raise ValueError('Expected English daily-report headers: ' + ', '.join(sorted(COLUMNS)))
    records = []
    seen = set()
    for row in reader:
        if len(records) >= 1000:
            raise ValueError('Split the export into batches of at most 1000 daily rows')
        day = row['Day']
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', day) or date.fromisoformat(day).isoformat() != day:
            raise ValueError('Every row needs a YYYY-MM-DD date; remove summary/header rows')
        account = row['Customer ID'].replace('-', '')
        if not re.fullmatch(r'\d{1,30}', account) or not re.fullmatch(r'\d{1,30}', row['Campaign ID']):
            raise ValueError('Account and campaign IDs must be numeric')
        cost = row['Cost']
        if not re.fullmatch(r'\d+(\.\d+)?', cost):
            raise ValueError('Cost must be nonnegative with decimal point and no grouping or currency symbol')
        cost_cents = int((Decimal(cost) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        if not row['Clicks'].isdigit() or not row['Impr.'].isdigit():
            raise ValueError('Clicks and impressions must be ungrouped nonnegative integers')
        record = {'date': day, 'platform': 'google_ads', 'accountId': account,
                  'campaignId': row['Campaign ID'],
                  'campaignName': row.get('UTM campaign', row['Campaign']),
                  'currency': row['Currency code'], 'costCents': cost_cents,
                  'clicks': int(row['Clicks']), 'impressions': int(row['Impr.'])}
        if not isinstance(record['campaignName'], str) or not record['campaignName'].strip() or len(record['campaignName']) > 100:
            raise ValueError('Campaign name must contain 1–100 characters and match utm_campaign')
        if not re.fullmatch(r'[A-Z]{3}', record['currency']) or any(record[k] > 2_147_483_647 for k in ['costCents', 'clicks', 'impressions']):
            raise ValueError('Unsupported currency format or counter overflow')
        identity = (account, record['campaignId'], day, record['currency'])
        if identity in seen:
            raise ValueError('Duplicate daily campaign row; export without extra segment dimensions')
        seen.add(identity)
        records.append(record)
    if not records:
        raise ValueError('The export contains no daily records')
    return {'records': records}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv_file', type=Path)
    parser.add_argument('json_file', type=Path)
    args = parser.parse_args()
    if args.csv_file.stat().st_size > 2_000_000:
        parser.error('CSV exceeds 2 MB; split it into smaller batches')
    try:
        payload = json.dumps(convert(args.csv_file.read_text(encoding='utf-8-sig')), ensure_ascii=False, indent=2)
        if len(payload.encode('utf-8')) > 512_000:
            raise ValueError('JSON exceeds 512 KB; split the export')
        args.json_file.write_text(payload + '\n', encoding='utf-8')
    except (ValueError, KeyError) as error:
        parser.error(str(error))


if __name__ == '__main__':
    main()
