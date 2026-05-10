import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const defaultTemplates = [
  { name: "Nginx", description: "Servidor web rápido e proxy reverso", category: "web", icon: "🌐", image: "nginx:alpine", ports: '["80:80","443:443"]', featured: true },
  { name: "PostgreSQL", description: "Banco de dados relacional avançado", category: "database", icon: "🐘", image: "postgres:16-alpine", ports: '["5432:5432"]', envVars: '[{"key":"POSTGRES_PASSWORD","value":"changeme"},{"key":"POSTGRES_DB","value":"mydb"}]', volumes: '["pgdata:/var/lib/postgresql/data"]', featured: true },
  { name: "MySQL", description: "Banco de dados relacional popular", category: "database", icon: "🐬", image: "mysql:8", ports: '["3306:3306"]', envVars: '[{"key":"MYSQL_ROOT_PASSWORD","value":"changeme"},{"key":"MYSQL_DATABASE","value":"mydb"}]', volumes: '["mysqldata:/var/lib/mysql"]', featured: true },
  { name: "MongoDB", description: "Banco de dados NoSQL orientado a documentos", category: "database", icon: "🍃", image: "mongo:7", ports: '["27017:27017"]', volumes: '["mongodata:/data/db"]', featured: true },
  { name: "Redis", description: "Armazenamento em memória e cache", category: "cache", icon: "⚡", image: "redis:alpine", ports: '["6379:6379"]', featured: true },
  { name: "WordPress", description: "CMS mais popular do mundo", category: "cms", icon: "📝", image: "wordpress:latest", ports: '["8080:80"]', envVars: '[{"key":"WORDPRESS_DB_HOST","value":"db:3306"},{"key":"WORDPRESS_DB_PASSWORD","value":"changeme"}]', featured: true },
  { name: "n8n", description: "Automação de workflows low-code", category: "automation", icon: "🔄", image: "n8nio/n8n:latest", ports: '["5678:5678"]', volumes: '["n8n_data:/home/node/.n8n"]', featured: true },
  { name: "Uptime Kuma", description: "Monitoramento de uptime self-hosted", category: "monitoring", icon: "📊", image: "louislam/uptime-kuma:latest", ports: '["3001:3001"]', volumes: '["uptimekuma:/app/data"]', featured: true },
  { name: "MinIO", description: "Armazenamento de objetos compatível com S3", category: "storage", icon: "📦", image: "minio/minio:latest", ports: '["9000:9000","9001:9001"]', envVars: '[{"key":"MINIO_ROOT_USER","value":"admin"},{"key":"MINIO_ROOT_PASSWORD","value":"changeme"}]' },
  { name: "Portainer", description: "Interface gráfica para Docker", category: "devops", icon: "🐳", image: "portainer/portainer-ce:latest", ports: '["9443:9443"]', volumes: '["portainer_data:/data","/var/run/docker.sock:/var/run/docker.sock"]' },
  { name: "Grafana", description: "Plataforma de observabilidade e dashboards", category: "monitoring", icon: "📈", image: "grafana/grafana:latest", ports: '["3000:3000"]', volumes: '["grafana_data:/var/lib/grafana"]' },
  { name: "Prometheus", description: "Monitoramento e alertas de métricas", category: "monitoring", icon: "🔥", image: "prom/prometheus:latest", ports: '["9090:9090"]', volumes: '["prometheus_data:/prometheus"]' },
  { name: "Gitea", description: "Servidor Git self-hosted leve", category: "devops", icon: "☕", image: "gitea/gitea:latest", ports: '["3000:3000","2222:22"]', volumes: '["gitea_data:/data"]' },
  { name: "Adminer", description: "Gerenciador de banco de dados em uma página", category: "database", icon: "🗄️", image: "adminer:latest", ports: '["8080:8080"]' },
  { name: "RabbitMQ", description: "Message broker AMQP", category: "messaging", icon: "🐰", image: "rabbitmq:3-management-alpine", ports: '["5672:5672","15672:15672"]' },
  { name: "Traefik", description: "Proxy reverso e load balancer cloud-native", category: "web", icon: "🔀", image: "traefik:v3.0", ports: '["80:80","443:443","8080:8080"]', volumes: '["/var/run/docker.sock:/var/run/docker.sock"]' },
  { name: "Nextcloud", description: "Plataforma de produtividade e armazenamento", category: "storage", icon: "☁️", image: "nextcloud:latest", ports: '["8080:80"]', volumes: '["nextcloud_data:/var/www/html"]', featured: true },
  { name: "Ghost", description: "Plataforma de publicação profissional", category: "cms", icon: "👻", image: "ghost:latest", ports: '["2368:2368"]', volumes: '["ghost_data:/var/lib/ghost/content"]' },
  { name: "Mattermost", description: "Plataforma de comunicação de equipe", category: "communication", icon: "💬", image: "mattermost/mattermost-team-edition:latest", ports: '["8065:8065"]', volumes: '["mattermost_data:/mattermost/data"]' },
  { name: "Vault", description: "Gerenciamento de secrets da HashiCorp", category: "security", icon: "🔐", image: "hashicorp/vault:latest", ports: '["8200:8200"]', envVars: '[{"key":"VAULT_DEV_ROOT_TOKEN_ID","value":"myroot"}]' },
  { name: "Evolution API", description: "API para WhatsApp multi-device com baileys", category: "communication", icon: "📱", image: "atrevido/evolution-api:latest", ports: '["8080:8080"]', envVars: '[{"key":"AUTHENTICATION_API_KEY","value":"changeme"},{"key":"DATABASE_PROVIDER","value":"postgresql"},{"key":"DATABASE_CONNECTION_URI","value":"postgresql://user:pass@db:5432/evolution"}]', volumes: '["evolution_store:/evolution/store","evolution_instances:/evolution/instances"]', featured: true },
  { name: "Typebot", description: "Construtor de chatbots conversacionais", category: "automation", icon: "🤖", image: "baptistearno/typebot-builder:latest", ports: '["3000:3000"]', envVars: '[{"key":"DATABASE_URL","value":"postgresql://user:pass@db:5432/typebot"},{"key":"NEXTAUTH_URL","value":"http://localhost:3000"}]' },
  { name: "Chatwoot", description: "Plataforma de atendimento ao cliente omnichannel", category: "communication", icon: "💬", image: "chatwoot/chatwoot:latest", ports: '["3000:3000"]', envVars: '[{"key":"SECRET_KEY_BASE","value":"changeme"},{"key":"RAILS_ENV","value":"production"}]', volumes: '["chatwoot_data:/app/storage"]' },
  { name: "Dify", description: "Plataforma de desenvolvimento de apps com IA/LLM", category: "automation", icon: "🧠", image: "langgenius/dify-web:latest", ports: '["3000:3000"]', featured: true },
  { name: "Nocodb", description: "Alternativa open-source ao Airtable", category: "database", icon: "📋", image: "nocodb/nocodb:latest", ports: '["8080:8080"]', volumes: '["nocodb_data:/usr/app/data"]', envVars: '[{"key":"NC_DB","value":"pg://db:5432?u=user&p=pass&d=nocodb"}]' },
  { name: "Metabase", description: "Business intelligence e dashboards de dados", category: "monitoring", icon: "📊", image: "metabase/metabase:latest", ports: '["3000:3000"]', volumes: '["metabase_data:/metabase-data"]' },
  { name: "Strapi", description: "CMS headless open-source com API REST e GraphQL", category: "cms", icon: "🚀", image: "strapi/strapi:latest", ports: '["1337:1337"]', volumes: '["strapi_data:/srv/app"]' },
  { name: "Appsmith", description: "Plataforma low-code para construir apps internos", category: "automation", icon: "⚡", image: "appsmith/appsmith-ce:latest", ports: '["80:80","443:443"]', volumes: '["appsmith_data:/appsmith-stacks"]' },
  { name: "Directus", description: "Plataforma de dados com API REST e GraphQL", category: "cms", icon: "🐇", image: "directus/directus:latest", ports: '["8055:8055"]', envVars: '[{"key":"KEY","value":"changeme"},{"key":"SECRET","value":"changeme"},{"key":"DB_CLIENT","value":"pg"}]', volumes: '["directus_data:/directus/uploads"]' },
  { name: "Supabase", description: "Alternativa open-source ao Firebase", category: "database", icon: "⚡", image: "supabase/postgres:latest", ports: '["5432:5432","8000:8000"]', envVars: '[{"key":"POSTGRES_PASSWORD","value":"changeme"}]', volumes: '["supabase_data:/var/lib/postgresql/data"]', featured: true },
];

async function initTemplates() {
  for (const t of defaultTemplates) {
    const exists = await prisma.appTemplate.findFirst({ where: { name: t.name } });
    if (!exists) {
      await prisma.appTemplate.create({ data: t });
    }
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initTemplates();

  const category = req.nextUrl.searchParams.get("category");
  const featured = req.nextUrl.searchParams.get("featured");
  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (featured === "true") where.featured = true;

  const templates = await prisma.appTemplate.findMany({ where, orderBy: { downloads: "desc" } });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, description, category, icon, image, ports, envVars, volumes } = body;

    if (!name || !image) return NextResponse.json({ error: "Nome e imagem são obrigatórios" }, { status: 400 });

    const template = await prisma.appTemplate.create({
      data: {
        name,
        description: description || "",
        category: category || "other",
        icon: icon || "📦",
        image,
        ports: JSON.stringify(ports || []),
        envVars: JSON.stringify(envVars || []),
        volumes: JSON.stringify(volumes || []),
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar template" }, { status: 500 });
  }
}
