import requests, json, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

r = requests.get(
    'https://api.gupshup.io/wa/app/1b726932-91ca-489f-ba2d-56422a7cfafb/template',
    headers={'apikey': 'sk_2c0ed702980c40e8856769f5c725871f'},
    timeout=15
)

data = r.json()
templates = data.get('templates', [])

print(f"Total templates: {len(templates)}\n")
for t in templates:
    tid = t.get('id', 'N/A')
    name = t.get('elementName', 'N/A')
    category = t.get('category', 'N/A')
    status = t.get('status', 'N/A')
    body = t.get('data', '')[:150]
    meta = t.get('meta', '') or ''
    has_header = 'header' in meta.lower() if meta else False
    print(f"ID: {tid}")
    print(f"  Name: {name} | {category} | {status}")
    print(f"  Body: {body}...")
    print(f"  Has Header: {has_header}")
    print()
