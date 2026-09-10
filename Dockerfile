# syntax=docker/dockerfile:1
# Cliente Excalidraw customizado:
#  - aponta a colaboracao para o seu proprio servidor (VITE_APP_WS_SERVER_URL)
#  - protege o acesso com Basic Auth (defina BASIC_AUTH_USER e BASIC_AUTH_PASSWORD)
# Uso: repositorio GitHub com este Dockerfile -> EasyPanel (Source: GitHub, Build: Dockerfile).

FROM node:24-bookworm AS build

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
# Fixe uma tag/release se quiser builds reproduziveis: --build-arg EXCALIDRAW_REF=v0.18.0
ARG EXCALIDRAW_REF=master
RUN git clone --depth 1 --branch "${EXCALIDRAW_REF}" https://github.com/excalidraw/excalidraw.git app

WORKDIR /opt/app

# >>> URL do SEU servidor de colaboracao (obrigatoriamente wss:// em producao) <<<
ENV VITE_APP_WS_SERVER_URL=wss://room.srgeek.com.br

RUN corepack enable \
 && yarn install --frozen-lockfile --network-timeout 600000 \
 && yarn build:app:docker

FROM nginx:stable-alpine-slim

# htpasswd vem no pacote apache2-utils
RUN apk add --no-cache apache2-utils

COPY --from=build /opt/app/excalidraw-app/build /usr/share/nginx/html

# Config do nginx com include do arquivo de auth (gerado no start)
RUN cat > /etc/nginx/conf.d/default.conf <<'NGINX'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    include /etc/nginx/excalidraw-auth.conf;

    location = /healthz {
        auth_basic off;
        access_log off;
        return 200 "ok";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

# Script que roda no start do nginx e gera o .htpasswd a partir das variaveis de ambiente
RUN cat > /docker-entrypoint.d/40-excalidraw-auth.sh <<'SH'
#!/bin/sh
set -e

AUTH_CONF=/etc/nginx/excalidraw-auth.conf
HTPASSWD=/etc/nginx/.htpasswd

if [ -n "$BASIC_AUTH_USER" ] && [ -n "$BASIC_AUTH_PASSWORD" ]; then
  htpasswd -Bbc "$HTPASSWD" "$BASIC_AUTH_USER" "$BASIC_AUTH_PASSWORD"
  printf 'auth_basic "Restricted";\nauth_basic_user_file %s;\n' "$HTPASSWD" > "$AUTH_CONF"
  echo "[basic-auth] habilitado para o usuario '$BASIC_AUTH_USER'"
else
  : > "$AUTH_CONF"
  echo "[basic-auth] desabilitado (defina BASIC_AUTH_USER e BASIC_AUTH_PASSWORD)"
fi
SH
RUN chmod +x /docker-entrypoint.d/40-excalidraw-auth.sh

HEALTHCHECK CMD wget -q -O /dev/null http://localhost/healthz || exit 1
