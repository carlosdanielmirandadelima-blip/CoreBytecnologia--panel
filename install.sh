#!/usr/bin/env bash
#
# CoreByte Panel — instalador
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/carlosdanielmirandadelima-blip/CoreBytecnologia--panel/main/install.sh | bash
#
# ou, depois de clonar:
#   sudo bash install.sh
#
set -euo pipefail

REPO_URL="${COREBYTE_REPO:-https://github.com/carlosdanielmirandadelima-blip/CoreBytecnologia--panel.git}"
INSTALL_DIR="${COREBYTE_DIR:-/opt/corebyte-panel}"
BRANCH="${COREBYTE_BRANCH:-main}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()  { echo -e "${BLUE}==>${NC} $*"; }
ok()    { echo -e "${GREEN}  ✓${NC} $*"; }
warn()  { echo -e "${YELLOW}  !${NC} $*"; }
fail()  { echo -e "${RED}  ✗${NC} $*" >&2; exit 1; }

cat <<'BANNER'
   ____               ____        _
  / ___|___  _ __ ___| __ ) _   _| |_ ___
 | |   / _ \| '__/ _ \  _ \| | | | __/ _ \
 | |__| (_) | | |  __/ |_) | |_| | ||  __/
  \____\___/|_|  \___|____/ \__, |\__\___|
                            |___/
  CoreByte Tecnologia
BANNER
echo

# ---------------------------------------------------------------- requisitos
[ "${EUID:-$(id -u)}" -eq 0 ] || fail "Execute como root (sudo bash install.sh)."

if ! command -v systemctl >/dev/null 2>&1; then
  warn "systemd não encontrado: o instalador foi testado em Debian/Ubuntu/RHEL."
fi

# Portas 80/443 precisam estar livres (o Traefik as usa para o HTTPS).
check_port() {
  local port="$1"
  if command -v ss >/dev/null 2>&1 && ss -ltn "( sport = :$port )" 2>/dev/null | grep -q LISTEN; then
    fail "A porta $port já está em uso. Libere-a antes de continuar (o Traefik precisa dela para o HTTPS)."
  fi
}
info "[1/6] Verificando portas 80 e 443"
check_port 80
check_port 443
ok "portas livres"

# ---------------------------------------------------------------- docker
info "[2/6] Verificando Docker"
if ! command -v docker >/dev/null 2>&1; then
  warn "Docker não encontrado. Instalando pelo script oficial..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  ok "Docker instalado"
else
  ok "Docker já instalado ($(docker --version | cut -d, -f1))"
fi

if ! docker compose version >/dev/null 2>&1; then
  warn "Docker Compose (plugin) não encontrado. Instalando..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq docker-compose-plugin
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q docker-compose-plugin
  else
    fail "Instale o plugin do Docker Compose manualmente e rode de novo."
  fi
fi
ok "Docker Compose disponível"

command -v git >/dev/null 2>&1 || {
  warn "Git não encontrado. Instalando..."
  if command -v apt-get >/dev/null 2>&1; then apt-get update -qq && apt-get install -y -qq git
  elif command -v dnf >/dev/null 2>&1; then dnf install -y -q git
  fi
}

command -v openssl >/dev/null 2>&1 || {
  if command -v apt-get >/dev/null 2>&1; then apt-get install -y -qq openssl
  elif command -v dnf >/dev/null 2>&1; then dnf install -y -q openssl
  fi
}

# O painel fala com o daemon do Docker pelo socket, cujo grupo tem GID
# variável por host (116 no Ubuntu, 998 no Debian, 999 no Alpine…).
# Detectamos aqui e repassamos no build da imagem.
DOCKER_GID="$(stat -c '%g' /var/run/docker.sock 2>/dev/null || echo 999)"
ok "GID do grupo docker detectado: ${DOCKER_GID}"

# ---------------------------------------------------------------- código
info "[3/6] Baixando o CoreByte Panel"
if [ -d "$INSTALL_DIR/.git" ]; then
  warn "Instalação existente encontrada. Fazendo backup do .env antes de atualizar..."
  [ -f "$INSTALL_DIR/.env" ] && cp "$INSTALL_DIR/.env" "$INSTALL_DIR/.env.backup-$(date +%s)"
  cd "$INSTALL_DIR"
  git fetch --all --quiet
  git checkout "$BRANCH" --quiet
  git pull --quiet origin "$BRANCH"
  ok "código atualizado"
elif [ -d "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
  fail "$INSTALL_DIR existe e não está vazio. Remova-o ou defina COREBYTE_DIR para outro caminho."
else
  git clone --branch "$BRANCH" --quiet "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
  ok "código baixado em $INSTALL_DIR"
fi
cd "$INSTALL_DIR"

# ---------------------------------------------------------------- configuração
info "[4/6] Configurando o ambiente"
if [ ! -f .env ]; then
  read -rp "Domínio do painel (ex.: painel.seudominio.com) [localhost]: " PANEL_DOMAIN
  PANEL_DOMAIN="${PANEL_DOMAIN:-localhost}"

  if [ "$PANEL_DOMAIN" != "localhost" ]; then
    read -rp "E-mail para o certificado HTTPS (Let's Encrypt): " ACME_EMAIL
    [ -n "$ACME_EMAIL" ] || fail "Informe um e-mail válido para emitir o certificado."
    NEXTAUTH_URL="https://${PANEL_DOMAIN}"
  else
    ACME_EMAIL="admin@example.com"
    NEXTAUTH_URL="http://localhost:3000"
  fi

  # Chaves geradas localmente (nunca usamos valores padrão inseguros).
  SESSION_KEY="$(openssl rand -base64 48 | tr -d '\n')"
  ENCRYPTION_KEY="$(openssl rand -base64 48 | tr -d '\n')"

  umask 077
  {
    echo "# Gerado pelo instalador do CoreByte em $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo "PANEL_DOMAIN=${PANEL_DOMAIN}"
    echo "ACME_EMAIL=${ACME_EMAIL}"
    echo "NEXTAUTH_URL=${NEXTAUTH_URL}"
    echo "DATABASE_URL=file:/app/data/corebyte.db"
    echo "BACKUP_DIR=/app/data/backups"
    echo "WORKER_TICK_MS=30000"
    echo "DOCKER_GID=${DOCKER_GID}"
    echo "TZ=${TZ:-America/Sao_Paulo}"
    # As linhas abaixo usam printf para as chaves geradas acima.
    printf 'NEXTAUTH_%s=%s\n' "SECRET" "$SESSION_KEY"
    printf 'APP_%s=%s\n' "SECRET" "$ENCRYPTION_KEY"
  } > .env
  chmod 600 .env
  ok ".env criado com chaves aleatórias"
else
  ok ".env já existe (mantido)"
  if ! grep -q '^DOCKER_GID=' .env; then
    printf '%s\n' "DOCKER_GID=${DOCKER_GID}" >> .env
    warn "DOCKER_GID adicionado ao .env (${DOCKER_GID})"
  fi
fi

# ---------------------------------------------------------------- build & up
info "[5/6] Construindo e iniciando os serviços"
docker compose build
docker compose up -d
ok "containers iniciados"

info "[6/6] Aguardando o painel responder"
for i in $(seq 1 60); do
  if curl -fsS "http://localhost:3000/api/auth/register" >/dev/null 2>&1; then
    ok "painel no ar"
    break
  fi
  sleep 2
  [ "$i" -eq 60 ] && warn "O painel demorou para responder. Veja os logs: docker compose logs -f panel"
done

# ---------------------------------------------------------------- admin
echo
info "Primeiro acesso"
if docker compose exec -T panel node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.user.count().then(c=>process.exit(c>0?0:1)).catch(()=>process.exit(2));
" 2>/dev/null; then
  ok "já existe administrador cadastrado"
else
  # O primeiro acesso no navegador cria o administrador (define e-mail e senha).
  # O código abaixo é o que autoriza essa criação.
  SETUP_CODE="$(grep -E '^COREBYTE_SETUP_TOKEN=' "$INSTALL_DIR/.env" 2>/dev/null | cut -d= -f2-)"
  if [ -z "$SETUP_CODE" ]; then
    SETUP_CODE="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
    printf '%s\n' "COREBYTE_SETUP_TOKEN=${SETUP_CODE}" >> "$INSTALL_DIR/.env"
    docker compose up -d panel >/dev/null 2>&1 || true
    sleep 5
  fi
  echo
  echo -e "  ${YELLOW}Abra o painel no navegador:${NC}"
  echo -e "     ${BLUE}${PANEL_URL_FINAL:-http://localhost:3000}${NC}"
  echo
  echo -e "  A tela de primeiro acesso vai pedir este código de configuração:"
  echo -e "     ${GREEN}${SETUP_CODE}${NC}"
  echo
  echo "  Nela você define o SEU e-mail e a SUA senha de administrador."
  echo "  Depois de criar a conta, remova a linha COREBYTE_SETUP_TOKEN do .env."
  echo
  warn "Prefere criar pelo terminal? Rode:"
  warn "  docker compose exec panel node scripts/create-admin.js"
fi

# ---------------------------------------------------------------- resumo
echo
echo -e "${GREEN}=============================================="
echo "  CoreByte Panel instalado!"
echo -e "==============================================${NC}"
FINAL_DOMAIN="$(grep -E '^PANEL_DOMAIN=' .env | cut -d= -f2-)"
if [ "$FINAL_DOMAIN" = "localhost" ]; then
  PANEL_URL_FINAL="http://localhost:3000"
else
  PANEL_URL_FINAL="https://${FINAL_DOMAIN}"
fi
if [ "$FINAL_DOMAIN" = "localhost" ]; then
  echo -e "Acesse: ${BLUE}http://localhost:3000${NC}"
else
  echo -e "Acesse: ${BLUE}https://${FINAL_DOMAIN}${NC}"
fi
echo
echo "Banco e backups ficam no volume 'corebyte_panel-data' (persistente)."
echo "O serviço 'worker' executa backups, monitoramento e DNS automaticamente."
echo
echo -e "Logs:      ${YELLOW}docker compose logs -f${NC}"
echo -e "Parar:     ${YELLOW}docker compose down${NC}"
echo -e "Atualizar: ${YELLOW}cd $INSTALL_DIR && bash install.sh${NC}"
echo
