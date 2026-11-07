# Imagen del servicio de video: Node + dependencias de Chrome Headless Shell para Remotion.
FROM node:22-bookworm-slim

# Librerías que necesita el Chrome sin pantalla de Remotion (lista oficial para Debian).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm1 libasound2 libxrandr2 \
      libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 \
      libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/*

# El repo se monta en /repo; node_modules vive en un volumen de Docker.
WORKDIR /repo/video

# Remotion Studio
EXPOSE 3000
