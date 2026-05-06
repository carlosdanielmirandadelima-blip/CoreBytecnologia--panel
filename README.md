# CoreByte Panel

Painel de gerenciamento Docker auto-hospedado, estilo Easypanel — desenvolvido pela **CoreByte Tecnologia**.

## Funcionalidades (Fase 1 - MVP)

- **Autenticação** — Login/registro com NextAuth.js (o primeiro usuário é admin)
- **Dashboard** — Visão geral do servidor Docker (containers, imagens, CPU, memória)
- **Gerenciamento de Containers** — Listar, iniciar, parar, reiniciar, remover
- **Logs em tempo real** — Visualização com auto-refresh e download
- **Detalhes do Container** — Informações, rede, volumes, variáveis de ambiente
- **Monitoramento** — CPU e memória por container em tempo real
- **Imagens Docker** — Listagem de todas as imagens no servidor
- **Tema escuro** — Interface moderna com Shadcn/ui
- **Proxy reverso** — Traefik com SSL automático via Let's Encrypt
- **Branding** — CoreByte Tecnologia em todas as páginas

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + React + TypeScript |
| Estilo | TailwindCSS + Shadcn/ui |
| Backend | API Routes do Next.js + Dockerode |
| Banco | SQLite via Prisma |
| Autenticação | NextAuth.js (Credentials) |
| Proxy | Traefik (SSL automático) |
| Infra | Docker + docker-compose |

## Instalação Rápida (1 comando)

```bash
curl -fsSL https://raw.githubusercontent.com/SEU_USUARIO/corebyte-panel/main/install.sh | sudo bash
```

O script vai:
1. Instalar Docker e Docker Compose (se necessário)
2. Clonar o repositório
3. Configurar domínio e SSL
4. Subir todos os serviços

## Instalação Manual

```bash
# Clonar o repositório
git clone https://github.com/SEU_USUARIO/corebyte-panel.git
cd corebyte-panel

# Copiar e editar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Com domínio e SSL (produção)
docker compose up -d --build

# Sem domínio, apenas porta local (desenvolvimento)
docker compose -f docker-compose.dev.yml up -d --build
```

## Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Configurar banco de dados
npx prisma migrate dev

# Rodar em desenvolvimento
npm run dev
```

Acesse http://localhost:3000

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PANEL_DOMAIN` | Domínio do painel | `localhost` |
| `ACME_EMAIL` | Email para Let's Encrypt | `admin@example.com` |
| `NEXTAUTH_SECRET` | Segredo para JWT | (gerado automaticamente) |
| `NEXTAUTH_URL` | URL do painel | `http://localhost:3000` |
| `DATABASE_URL` | Caminho do SQLite | `file:/app/data/corebyte.db` |

## Roadmap

- [x] **Fase 1** — Fundação (Auth, containers, logs, dashboard)
- [ ] **Fase 2** — Deploy (Git deploy, templates, editor compose)
- [ ] **Fase 3** — Gestão (Times, permissões, variáveis)
- [ ] **Fase 4** — Monitoramento (Gráficos, healthchecks)
- [ ] **Fase 5** — Backups (Agendador, restore, S3)
- [ ] **Fase 6** — Avançado (Multi-server, Cloudflare, status page)
- [ ] **Fase 7** — Plugins, API pública, 2FA
- [ ] **Fase 8** — Kubernetes, auto-scaling
- [ ] **Fase 9** — DNS dinâmico, migration wizards
- [ ] **Fase 10** — PWA, ChatOps, polimento

## Licença

Projeto privado — CoreByte Tecnologia.

---

**CoreByte Tecnologia** — Gerenciamento Docker sem limites.
