FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (for k6 / jmeter if needed in future)
RUN apt-get update && apt-get install -y curl gnupg2 && rm -rf /var/lib/apt/lists/*

# Install k6
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
RUN echo "deb https://dl.k6.io/deb stable main" | tee /etc/apt/sources.list.d/k6.list
RUN apt-get update && apt-get install k6 -y

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Initialize Database with Seed Data
RUN python seed_data.py || true

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
