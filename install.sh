#!/bin/bash
set -e

# CoreByte Panel - Script de Instalação
# Uso: curl -fsSL https://raw.githubusercontent.com/SEU_USUARIO/corebyte-panel/main/install.sh | bash

REPO_URL="https://github.com/SEU_USUARIO/corebyte-panel.git"
INSTALL_DIR="/opt/corebyte-panel"
COMPOSE_FILE="docker-compose.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "   ____               ____        _       "
echo "  / ___|___  _ __ ___| __ ) _   _| |_ ___ "
echo " | |   / _ \| '__/ _ \  _ \| | | | __/ _ \\"
echo " | |__| (_) | | |  __/ |_) | |_| | ||  __/"
echo "  \____\___/|_|  \___|____/ \__, |\__\___|"
echo "                            |___/          "
echo -e "  ${YELLOW}Tecnologia${NC}"
echo ""
echo -e "${GREEN}Instalador do CoreByte Panel${NC}"
echo "========================================"
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Por favor, execute como root (sudo)${NC}"
  exit 1
fi

# Verificar Docker
echo -e "${BLUE}[1/5]${NC} Verificando Docker..."
if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}Docker não encontrado. Instalando...${NC}"
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo -e "${GREEN}Docker instalado com sucesso!${NC}"
else
  echo -e "${GREEN}Docker já instalado: $(docker --version)${NC}"
fi

# Verificar Docker Compose
echo -e "${BLUE}[2/5]${NC} Verificando Docker Compose..."
if ! docker compose version &> /dev/null; then
  echo -e "${YELLOW}Docker Compose não encontrado. Instalando plugin...${NC}"
  apt-get update -qq && apt-get install -y -qq docker-compose-plugin
  echo -e "${GREEN}Docker Compose instalado!${NC}"
else
  echo -e "${GREEN}Docker Compose já instalado: $(docker compose version)${NC}"
fi

# Verificar Git
if ! command -v git &> /dev/null; then
  echo -e "${YELLOW}Git não encontrado. Instalando...${NC}"
  apt-get update -qq && apt-get install -y -qq git
fi

# Clonar ou atualizar repositório
echo -e "${BLUE}[3/5]${NC} Baixando CoreByte Panel..."
if [ -d "$INSTALL_DIR" ]; then
  echo -e "${YELLOW}Diretório já existe. Atualizando...${NC}"
  cd "$INSTALL_DIR"
  git pull origin main
else
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Configurar variáveis de ambiente
echo -e "${BLUE}[4/5]${NC} Configurando ambiente..."
if [ ! -f "$INSTALL_DIR/.env" ]; then
  GENERATED_SECRET=$(openssl rand -base64 32)

  echo ""
  read -p "Domínio do painel (ex: painel.seudominio.com) [localhost]: " PANEL_DOMAIN
  PANEL_DOMAIN=${PANEL_DOMAIN:-localhost}

  read -p "Email para SSL (Let's Encrypt) [admin@example.com]: " ACME_EMAIL
  ACME_EMAIL=${ACME_EMAIL:-admin@example.com}

  cat > "$INSTALL_DIR/.env" <<EOF
# CoreByte Panel - Configurações
PANEL_DOMAIN=${PANEL_DOMAIN}
ACME_EMAIL=${ACME_EMAIL}
NEXTAUTH_SECRET=${GENERATED_SECRET}
NEXTAUTH_URL=https://${PANEL_DOMAIN}
DATABASE_URL=file:/app/data/corebyte.db
EOF

  # Se localhost, usar compose de desenvolvimento
  if [ "$PANEL_DOMAIN" = "localhost" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
    sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=http://localhost:3000|" "$INSTALL_DIR/.env"
  fi

  echo -e "${GREEN}Arquivo .env criado!${NC}"
else
  echo -e "${GREEN}Arquivo .env já existe. Mantendo configurações.${NC}"
  if grep -q "localhost" "$INSTALL_DIR/.env" 2>/dev/null; then
    COMPOSE_FILE="docker-compose.dev.yml"
  fi
fi

# Iniciar serviços
echo -e "${BLUE}[5/5]${NC} Iniciando CoreByte Panel..."
cd "$INSTALL_DIR"
docker compose -f "$COMPOSE_FILE" build --no-cache
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo -e "${GREEN}========================================"
echo -e "  CoreByte Panel instalado com sucesso!"
echo -e "========================================${NC}"
echo ""
if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
  echo -e "Acesse: ${BLUE}http://localhost:3000${NC}"
else
  echo -e "Acesse: ${BLUE}https://${PANEL_DOMAIN}${NC}"
fi
echo ""
echo -e "Para ver os logs: ${YELLOW}docker compose -f $COMPOSE_FILE logs -f${NC}"
echo -e "Para parar: ${YELLOW}docker compose -f $COMPOSE_FILE down${NC}"
echo -e "Para atualizar: ${YELLOW}cd $INSTALL_DIR && git pull && docker compose -f $COMPOSE_FILE up -d --build${NC}"
echo ""
echo -e "${BLUE}CoreByte Tecnologia${NC}"
