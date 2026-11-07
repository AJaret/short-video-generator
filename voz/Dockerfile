# Imagen del servicio de voz: Python 3.11 + PyTorch con CUDA (vía chatterbox-tts) + Whisper.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/root/.cache/huggingface

# ffmpeg: Whisper lo usa para leer audio desde archivo
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt

# El repo se monta en /repo; los modelos se guardan en el volumen /root/.cache
WORKDIR /repo

# Interfaz de pruebas (voz/app.py)
EXPOSE 7860
