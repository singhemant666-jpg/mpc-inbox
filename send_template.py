import os
import json
import argparse
import requests
import pandas as pd
import sqlite3
import time
import datetime

def save_log_to_sqlite(name, phone, status, msg_id=None, error=None):
    db_path = os.path.join('backend', 'prisma', 'dev.db')
    if not os.path.exists(db_path):
        return
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        log_id = f"cli_{int(time.time() * 1000)}"
        now = datetime.datetime.now().isoformat()
        cur.execute("""
            INSERT INTO inbox_broadcast_logs (id, name, phone, status, gupshup_message_id, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (log_id, name, phone, status, msg_id, error, now))
        conn.commit()
        conn.close()
    except Exception:
        pass

def load_env(env_path):
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip().strip('"\'')
    return env_vars

def send_templates(excel_file, template_id, source_number, app_name, image_url=None):
    env = load_env('backend/.env')
    api_key = env.get('GUPSHUP_API_KEY')
    if not api_key:
        print("❌ Error: GUPSHUP_API_KEY not found in backend/.env")
        return

    if not os.path.exists(excel_file):
        print(f"❌ Error: Excel file not found at {excel_file}")
        return

    df = pd.read_excel(excel_file)
    
    url = "https://api.gupshup.io/wa/api/v1/template/msg"
    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "application/x-www-form-urlencoded",
        "apikey": api_key
    }
    
    print(f"[INFO] Loaded Excel file: {excel_file}")
    print(f"[INFO] Total Rows: {len(df)}")
    print(f"[INFO] Template ID: {template_id}")
    print(f"[INFO] Source Number: {source_number}")
    print(f"[INFO] App Name: {app_name}")
    if image_url:
        print(f"[INFO] Image Header URL: {image_url}")
    print(f"[INFO] Storing results in SQLite: backend/prisma/dev.db")
    print("=" * 60)
    
    success_count = 0
    fail_count = 0

    for idx, row in df.iterrows():
        name = str(row.get('Name', '')).strip()
        raw_num = str(row.get('number', '')).strip().replace('.0', '')
        
        if not raw_num or raw_num.lower() == 'nan':
            print(f"[SKIP] Row {idx+1}: Skipped (Empty number)")
            continue

        # Format phone number with country code 91 if 10 digits
        if len(raw_num) == 10 and raw_num.isdigit():
            destination = "91" + raw_num
        else:
            destination = raw_num
            
        template_payload = {
            "id": template_id,
            "params": [name]
        }
        
        form_data = {
            "channel": "whatsapp",
            "source": source_number,
            "destination": destination,
            "src.name": app_name,
            "template": json.dumps(template_payload)
        }

        # Add image header if an image URL is provided
        if image_url:
            form_data["message"] = json.dumps({
                "type": "image",
                "image": {"link": image_url}
            })
        
        print(f"[{idx+1}/{len(df)}] Sending to: Name='{name}', Phone='{destination}'...")
        try:
            res = requests.post(url, headers=headers, data=form_data, timeout=15)
            if res.status_code in [200, 202]:
                data = res.json()
                msg_id = data.get('messageId', 'N/A')
                status = data.get('status', 'submitted')
                print(f"  [SUCCESS] Status: {status} | Message ID: {msg_id}")
                success_count += 1
                save_log_to_sqlite(name, destination, 'submitted', msg_id)
            else:
                print(f"  [FAILED] HTTP {res.status_code}: {res.text}")
                fail_count += 1
                save_log_to_sqlite(name, destination, 'failed', error=f"HTTP {res.status_code}: {res.text}")
        except Exception as e:
            print(f"  [ERROR] {e}")
            fail_count += 1
            save_log_to_sqlite(name, destination, 'failed', error=str(e))
        print("-" * 60)

    print(f"[SUMMARY] {success_count} succeeded, {fail_count} failed. Saved to SQLite dev.db.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Send Gupshup WhatsApp template messages from Excel sheet.")
    parser.add_argument("--excel", default=r"c:\Users\DELL\Documents\mpc inbox\sahil number test.xlsx", help="Path to Excel file")
    parser.add_argument("--template-id", default="97f67a9f-abe7-460c-b34e-ad4af6c46e05", help="Gupshup Template ID")
    parser.add_argument("--source", default="917304226441", help="Source WhatsApp phone number")
    parser.add_argument("--app-name", default="mpcUAT", help="Gupshup App Name")
    parser.add_argument("--image-url", default=None, help="Public image URL for template header (e.g. https://example.com/promo.jpg)")

    args = parser.parse_args()
    send_templates(args.excel, args.template_id, args.source, args.app_name, args.image_url)

