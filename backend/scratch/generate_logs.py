import json
import random
from datetime import datetime, timedelta

def generate_apache_logs(filename="apache_sample.log", num_lines=1000):
    paths = [
        "/api/products", "/api/products/1", "/api/products/2", 
        "/api/cart", "/api/checkout", "/api/login", "/", "/index.html"
    ]
    ips = [f"192.168.1.{i}" for i in range(1, 20)]
    now = datetime.now()
    
    with open(filename, "w") as f:
        for i in range(num_lines):
            ip = random.choice(ips)
            ts = now - timedelta(seconds=num_lines - i * random.randint(1, 5))
            path = random.choice(paths)
            method = "POST" if "checkout" in path or "cart" in path or "login" in path else "GET"
            status = 200 if random.random() > 0.05 else 500
            duration = random.randint(20, 500) if status == 200 else random.randint(1000, 5000)
            bytes_sent = random.randint(500, 5000)
            
            # 192.168.1.10 - - [30/May/2026:10:00:00 +0000] "GET /api/products HTTP/1.1" 200 1234 "-" "Mozilla/5.0" 45
            line = f'{ip} - - [{ts.strftime("%d/%b/%Y:%H:%M:%S +0000")}] "{method} {path} HTTP/1.1" {status} {bytes_sent} "-" "Mozilla/5.0" {duration}\n'
            f.write(line)
            
def generate_json_logs(filename="json_sample.log", num_lines=1000):
    paths = [
        "/api/v1/users", "/api/v1/users/profile", "/api/v1/settings", 
        "/api/v1/auth", "/api/v1/dashboard"
    ]
    sessions = [f"sess_{i}" for i in range(1, 10)]
    now = datetime.now()
    
    with open(filename, "w") as f:
        for i in range(num_lines):
            sess = random.choice(sessions)
            ts = (now - timedelta(seconds=num_lines - i * random.randint(1, 5))).timestamp() * 1000
            path = random.choice(paths)
            method = "POST" if "auth" in path or "settings" in path else "GET"
            status = 200 if random.random() > 0.02 else 401
            duration = random.randint(10, 200)
            
            obj = {
                "timestamp": ts,
                "path": path,
                "method": method,
                "status": status,
                "duration": duration,
                "sessionId": sess,
                "ip": "10.0.0.1"
            }
            f.write(json.dumps(obj) + "\n")

if __name__ == "__main__":
    generate_apache_logs("C:/Users/coole/Downloads/AI App/pasha projects/Feuji/backend/scratch/apache_sample.log", 500)
    generate_json_logs("C:/Users/coole/Downloads/AI App/pasha projects/Feuji/backend/scratch/json_sample.log", 500)
    print("Logs generated.")
