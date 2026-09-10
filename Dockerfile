# syntax=docker/dockerfile:1
# Cliente Excalidraw customizado, apontando a colaboracao para o seu proprio servidor.
# Uso: crie um repositorio GitHub com este Dockerfile e importe no EasyPanel (Source: GitHub, Dockerfile).

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

RUN npm install -g yarn@1.22.22 \
 && yarn install --frozen-lockfile --network-timeout 600000 \
 && yarn build:app:docker

FROM nginx:stable-alpine-slim
COPY --from=build /opt/app/excalidraw-app/build /usr/share/nginx/html
HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
