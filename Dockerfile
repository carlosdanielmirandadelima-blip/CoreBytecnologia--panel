# CoreByte Panel — imagem de produção
#
# Correções importantes em relação à versão anterior:
#  - a CLI do Prisma e os engines agora são copiados para a imagem final
#    (antes o CMD rodava `npx prisma migrate deploy` e o npx baixava o pacote
#    da internet no boot — sem internet, o container morria antes de subir);
#  - o schema.prisma vai junto (o `prisma migrate deploy` precisa dele);
#  - o binário do Docker não é necessário: o painel fala com o daemon pela
#    API do Docker (dockerode), e não mais por comandos de shell.

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl

# ---------------------------------------------------------------- deps
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------- builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------- runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# O painel precisa falar com o daemon do Docker pelo socket. O GID do grupo
# "docker" varia por host (116, 998, 999…), então é passado no build e um
# grupo com esse GID é criado para o usuário da aplicação.
ARG DOCKER_GID=999
RUN addgroup --system --gid 1001 nodejs \
 && addgroup --system --gid ${DOCKER_GID} dockerhost \
 && adduser --system --uid 1001 --ingroup nodejs nextjs \
 && adduser nextjs dockerhost

# Aplicação
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Scripts de administração (create-admin.js etc.) — o instalador os usa.
COPY --from=builder /app/scripts ./scripts

# Prisma: schema + migrations + CLI + engines (necessários para migrate deploy)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# O pacote inteiro da CLI (inclui build/index.js e os arquivos .wasm que
# ela carrega em runtime — copiar só o symlink de .bin quebrava o boot).
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Dependências nativas usadas em runtime
COPY --from=builder /app/node_modules/megajs ./node_modules/megajs
COPY --from=builder /app/node_modules/ssh2 ./node_modules/ssh2
COPY --from=builder /app/node_modules/ssh2-sftp-client ./node_modules/ssh2-sftp-client
COPY --from=builder /app/node_modules/basic-ftp ./node_modules/basic-ftp

# Volumes persistentes: banco e backups ficam em /app/data
# O chmod garante leitura do schema/CLI mesmo se os arquivos vierem com
# permissão restritiva do host (era o que impedia o migrate de rodar no boot).
RUN mkdir -p /app/data/backups \
 && chmod -R a+rX /app/prisma /app/scripts /app/node_modules/prisma /app/node_modules/@prisma /app/node_modules/.prisma \
 && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/corebyte.db"
ENV BACKUP_DIR="/app/data/backups"

# Aplica as migrations (CLI local, sem baixar nada) e sobe o servidor.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma && node server.js"]
