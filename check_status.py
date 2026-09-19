import sqlite3

conn = sqlite3.connect('backend/prisma/dev.db')
cur = conn.cursor()

print("=== Recent broadcast logs (last 10) ===")
cur.execute("""
    SELECT name, phone, status, error_message, gupshup_message_id, created_at 
    FROM inbox_broadcast_logs 
    ORDER BY created_at DESC 
    LIMIT 10
""")
rows = cur.fetchall()
for r in rows:
    print(f"  {r[5]} | {r[0]:15s} | {r[1]} | {r[2]:12s} | err={r[3]} | msgId={r[4]}")

print("\n=== Sahil Singh entries ===")
cur.execute("""
    SELECT name, phone, status, error_message, gupshup_message_id, created_at 
    FROM inbox_broadcast_logs 
    WHERE phone LIKE '%9967%' 
    ORDER BY created_at DESC 
    LIMIT 5
""")
rows = cur.fetchall()
for r in rows:
    print(f"  {r[5]} | {r[0]:15s} | {r[1]} | {r[2]:12s} | err={r[3]} | msgId={r[4]}")

print("\n=== Karan Singh entries ===")
cur.execute("""
    SELECT name, phone, status, error_message, gupshup_message_id, created_at 
    FROM inbox_broadcast_logs 
    WHERE phone LIKE '%9833%' 
    ORDER BY created_at DESC 
    LIMIT 5
""")
rows = cur.fetchall()
for r in rows:
    print(f"  {r[5]} | {r[0]:15s} | {r[1]} | {r[2]:12s} | err={r[3]} | msgId={r[4]}")

conn.close()
