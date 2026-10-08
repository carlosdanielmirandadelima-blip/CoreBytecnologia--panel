# CoreByte Panel

Painel de servidor open source (licença MIT) — uma alternativa self-hosted ao
Easypanel. Suba projetos em containers, publique com **domínio e HTTPS
automáticos** e mantenha seus backups em **23 serviços de nuvem**.

![licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)

---

## O que ele faz

- **Projetos com vários serviços**: cada projeto pode rodar **vários serviços
  juntos** (app + banco + cache), cada um com sua imagem, portas, volumes,
  variáveis próprias e domínio próprio. Dá para criar um projeto **vazio, só
  com o nome**, e adicionar os serviços depois.
- **Templates prontos**: WordPress, PostgreSQL, Redis, n8n, Uptime Kuma e
  outros, com um clique.
- **Domínio e HTTPS automáticos**: informe `app.seudominio.com` e o painel
  publica o serviço via Traefik com certificado Let's Encrypt. Sem editar
  arquivos de configuração.
- **Backups multi-nuvem**: envie backups para Google Drive, OneDrive, Dropbox,
  Box, Amazon S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO, DigitalOcean
  Spaces, Storj, pCloud, MEGA, TeraBox, WebDAV, Nextcloud, FTP/FTPS ou SFTP.
  Cadastre só o que você usa, com botão **Testar conexão**.
- **Backups automáticos**: agendamento por horário (cron) com retenção
  configurável e envio automático para a nuvem.
- **Monitoramento**: páginas de status públicas com HTTP, TCP e ping, histórico
  de disponibilidade de 24h.
- **Servidores e métricas**: containers, imagens, volumes, métricas de CPU,
  memória e disco; cadastro de múltiplos hosts Docker.
- **DNS**: registros e Dynamic DNS (Cloudflare, DigitalOcean, Namecheap).
- **Segurança**: login com **2FA (TOTP)** realmente exigido, chaves de API com
  permissões, trilha de auditoria e credenciais de nuvem **cifradas no banco**.

---

## Instalação

Em um servidor Linux com Docker (recomendado: 2 GB de RAM, Ubuntu/Debian):

```bash
curl -fsSL https://raw.githubusercontent.com/carlosdanielmirandadelima-blip/CoreBytecnologia--panel/main/install.sh | sudo bash
```

O instalador:

1. verifica as portas 80 e 443 e instala o Docker se faltar;
2. baixa o painel em `/opt/corebyte-panel`;
3. gera as chaves de segurança em `.env` (nunca usa senha padrão);
4. sobe o painel, o Traefik (HTTPS) e o worker de agendamento;
5. cria o administrador com o nome, e-mail e senha que você informar.

No fim ele mostra a URL de acesso.

### Instalação manual

```bash
git clone https://github.com/carlosdanielmirandadelima-blip/CoreBytecnologia--panel.git
cd CoreBytecnologia--panel
cp .env.example .env
# edite o .env e gere as chaves:
#   openssl rand -base64 48   -> NEXTAUTH_SECRET
#   openssl rand -base64 48   -> APP_SECRET
docker compose up -d --build
docker compose exec panel node scripts/create-admin.js
```

---

## Primeiro acesso

Abra a URL mostrada pelo instalador. Como ainda não existe administrador, o
painel abre direto a tela **"Bem-vindo ao CoreByte"**, onde você define:

- seu nome;
- **o e-mail de acesso**;
- **a senha** (mínimo de 10 caracteres, com letras e números).

O instalador mostra no terminal um **código de configuração** para colar nessa
tela. Ele existe para impedir que um visitante crie o administrador antes de
você. Depois de criar a conta, remova a linha `COREBYTE_SETUP_TOKEN` do `.env`.

Se preferir criar pelo terminal:
```bash
docker compose exec panel node scripts/create-admin.js
```

Depois de entrar:

- **Ative o 2FA** em *Configurações → Autenticação em dois fatores*.
- Em *Backups → Nuvem*, conecte onde você quer guardar os backups.

---

## Variáveis de ambiente

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `PANEL_DOMAIN` | sim | Domínio do painel (ex.: `painel.seudominio.com`). |
| `NEXTAUTH_URL` | sim | URL completa do painel (ex.: `https://painel.seudominio.com`). |
| `NEXTAUTH_SECRET` | sim | Assina a sessão. Gere com `openssl rand -base64 48`. |
| `APP_SECRET` | recomendado | Cifra as credenciais de nuvem (AES-256-GCM) e o 2FA. |
| `ACME_EMAIL` | com domínio | E-mail para o certificado Let's Encrypt. |
| `COREBYTE_SETUP_TOKEN` | não | Código para criar o primeiro admin pelo navegador. |
| `DATABASE_URL` | sim | `file:/app/data/corebyte.db` (padrão do container). |
| `BACKUP_DIR` | sim | `/app/data/backups` (dentro do volume persistente). |
| `WORKER_TICK_MS` | não | Intervalo do agendador, em ms (padrão `30000`). |
| `TZ` | não | Fuso horário (padrão `America/Sao_Paulo`). |

---

## Conectar um serviço de nuvem

Em *Backups → Nuvem → Conectar serviço de nuvem*:

| Serviço | O que informar |
|---|---|
| **Google Drive** | *Client ID*, *Client Secret* e *Refresh Token* — ou o **JSON de uma service account** (mais simples em servidor). |
| **OneDrive** | *Client ID*, *Client Secret* e *Refresh Token* (app no Entra ID). |
| **Dropbox** | *App Key*, *App Secret* e *Refresh Token*. |
| **Box** | *Client ID*, *Client Secret* e *Refresh Token*. |
| **Amazon S3** | *Access Key*, *Secret Key*, *Bucket* e *Região*. |
| **Cloudflare R2** | *Account ID*, *Access Key*, *Secret Key* e *Bucket*. |
| **Backblaze B2 / Wasabi / MinIO / Storj / DigitalOcean** | Endpoint (ou região), chaves e *Bucket*. |
| **pCloud** | *Auth Token* (Configurações → API no pCloud). |
| **MEGA** | E-mail e senha de uma conta dedicada. |
| **TeraBox** | Cookie de sessão (limitação do próprio serviço). |
| **WebDAV / Nextcloud** | URL do WebDAV, usuário e senha de app. |
| **FTP/FTPS e SFTP** | Host, porta, usuário e senha (ou chave privada). |

Todos os campos têm botão **Testar conexão** antes de salvar. As credenciais são
gravadas **cifradas** — um vazamento do banco não expõe suas chaves.

---

## Projetos com vários serviços

Um projeto é um agrupamento. Dentro dele você roda quantos serviços quiser:

| Exemplo | Serviços do projeto |
|---|---|
| Loja virtual | `wordpress` (publicado) + `mysql` (interno) |
| API + cache | `api` (publicado) + `postgres` (interno) + `redis` (interno) |
| Site + painel | `site` (domínio A) + `admin` (domínio B) |

Cada serviço tem:

- **imagem**, **portas** (`8080:80`), **volumes** e **comando**;
- **variáveis próprias** (as do serviço sobrescrevem as do projeto);
- **Publicar em domínio**: ligado, o serviço ganha URL com HTTPS automático;
  desligado, ele fica acessível só pela rede interna (ideal para banco e cache);
- **domínio próprio**, quando você quer uma URL diferente por serviço.

### Passo a passo

1. *Projetos → Novo projeto*: informe só o **nome** e crie (pode nascer vazio).
2. Na tela do projeto, aba **Serviços → Adicionar serviço**.
   Use um dos modelos prontos (PostgreSQL, Redis, Nginx, Node, WordPress…) ou
   preencha a imagem manualmente.
3. Para o serviço que for site/api: marque **Publicar em domínio** e informe o
   domínio (ou defina um domínio na aba *Configurações* do projeto).
4. Clique em **Deploy**. Cada serviço vira um container; os publicados entram na
   rede do Traefik com certificado Let's Encrypt.

Aponte o DNS do domínio para o IP do servidor antes de esperar o certificado.

---

## Desenvolvimento

```bash
npm install
cp .env.example .env      # preencha NEXTAUTH_SECRET e APP_SECRET
npx prisma migrate deploy
npm run dev               # http://localhost:3000
```

Comandos úteis:

| Comando | Descrição |
|---|---|
| `npm run build` | Build de produção (com checagem de tipos e lint **ativos**). |
| `npm run typecheck` | Só a checagem de tipos. |
| `npm run lint` | ESLint. |
| `npm run setup:admin` | Cria o administrador pelo terminal. |
| `npm run worker` | Roda o agendador (backups, monitor, DDNS). |
| `npm run db:migrate` | Aplica as migrations. |
| `npm run docker:up` | Sobe tudo com Docker Compose. |

Após alterar `prisma/schema.prisma`, crie a migration:

```bash
npx prisma migrate dev --name descricao_da_mudanca
```

---

## Arquitetura

```
src/
├── app/
│   ├── (panel)/            páginas do painel (23 seções)
│   └── api/                rotas HTTP (todas exigem sessão, exceto públicas)
├── components/             interface (shadcn/ui + Tailwind)
├── lib/
│   ├── storage/            adaptadores de nuvem (S3, Drive, WebDAV, SFTP…)
│   ├── crypto.ts           cifra das credenciais (AES-256-GCM)
│   ├── deploy.ts           implantação + labels do Traefik
│   ├── backup.ts           backup/restauração via API do Docker
│   ├── docker.ts           acesso ao daemon (com demux de logs)
│   ├── validate.ts         validação de entrada (anti-injeção)
│   ├── session.ts          autorização
│   └── audit.ts            trilha de auditoria
└── worker/                 agendador (serviço separado no compose)
```

**Stack**: Next.js 14 (App Router) · TypeScript · Prisma + SQLite ·
NextAuth · Tailwind + shadcn/ui · Dockerode · Traefik.

---

## Backup e dados

- Banco e backups ficam em `/app/data` (volume `panel-data`), portanto
  **sobrevivem a atualizações**.
- Para atualizar: `cd /opt/corebyte-panel && bash install.sh` (o `.env` é
  preservado).
- Para desinstalar mantendo os dados: `docker compose down`.

---

## Segurança

- Todas as rotas de API exigem sessão, exceto as explicitamente públicas
  (login, página de status, API v1 com chave e worker com token interno).
- Comandos de backup/restauração usam a **API do Docker com argumentos fixos**
  — não há montagem de linha de comando a partir de entrada do usuário.
- Credenciais de nuvem e segredos de 2FA são cifrados no banco.
- Chaves de API são guardadas como hash e têm permissão `read`/`write`
  verificada.
- Limite de tentativas de login por conta.

Encontrou uma vulnerabilidade? Abra uma issue privada ou entre em contato antes
de divulgar publicamente.

---

## Licença

MIT — veja [LICENSE](LICENSE).
