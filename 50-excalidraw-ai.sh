#!/bin/sh
# Configura o atalho /api/ai: o navegador manda o pedido para o nosso dominio e o
# nginx acrescenta a chave do provedor. A chave nunca chega ao navegador.
# Sem DEEPSEEK_API_KEY o arquivo fica vazio e o painel cai no modo "Sem IA".
set -e

CONF=/etc/nginx/ai.conf

if [ -n "$DEEPSEEK_API_KEY" ]; then
  cat > "$CONF" <<'NGINX'
location = /api/ai {
    limit_except POST { deny all; }
    proxy_pass https://api.deepseek.com/chat/completions;
    proxy_http_version 1.1;
    proxy_set_header Host api.deepseek.com;
    proxy_set_header Authorization "Bearer __DEEPSEEK_KEY__";
    proxy_set_header Content-Type "application/json";
    proxy_ssl_server_name on;
    proxy_connect_timeout 10s;
    proxy_read_timeout 60s;
}
NGINX
  sed -i "s|__DEEPSEEK_KEY__|$DEEPSEEK_API_KEY|" "$CONF"

  # Se a config ficar invalida, degrada (site no ar, IA off) em vez de derrubar tudo.
  if ! nginx -t >/dev/null 2>&1; then
    echo "[ai] config invalida; proxy desativado"
    : > "$CONF"
  else
    echo "[ai] proxy /api/ai habilitado"
  fi
else
  : > "$CONF"
  echo "[ai] desativado (defina DEEPSEEK_API_KEY)"
fi
