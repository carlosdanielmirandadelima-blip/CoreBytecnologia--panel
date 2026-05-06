export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  services: TemplateService[];
  envVars: { key: string; value: string; description: string }[];
}

export interface TemplateService {
  name: string;
  image: string;
  ports: string;
  volumes: string;
  command: string;
}

export const templates: Template[] = [
  {
    id: "wordpress",
    name: "WordPress",
    description: "CMS mais popular do mundo com MySQL",
    icon: "globe",
    category: "CMS",
    services: [
      {
        name: "wordpress",
        image: "wordpress:latest",
        ports: "8080:80",
        volumes: "wordpress_data:/var/www/html",
        command: "",
      },
      {
        name: "mysql",
        image: "mysql:8.0",
        ports: "",
        volumes: "mysql_data:/var/lib/mysql",
        command: "",
      },
    ],
    envVars: [
      { key: "WORDPRESS_DB_HOST", value: "mysql:3306", description: "Host do banco de dados" },
      { key: "WORDPRESS_DB_USER", value: "wordpress", description: "Usuário do banco" },
      { key: "WORDPRESS_DB_PASSWORD", value: "wordpress_pass", description: "Senha do banco" },
      { key: "WORDPRESS_DB_NAME", value: "wordpress", description: "Nome do banco" },
      { key: "MYSQL_ROOT_PASSWORD", value: "root_password", description: "Senha root do MySQL" },
      { key: "MYSQL_DATABASE", value: "wordpress", description: "Nome do banco MySQL" },
      { key: "MYSQL_USER", value: "wordpress", description: "Usuário MySQL" },
      { key: "MYSQL_PASSWORD", value: "wordpress_pass", description: "Senha MySQL" },
    ],
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    description: "Banco de dados relacional avançado",
    icon: "database",
    category: "Database",
    services: [
      {
        name: "postgres",
        image: "postgres:16-alpine",
        ports: "5432:5432",
        volumes: "postgres_data:/var/lib/postgresql/data",
        command: "",
      },
    ],
    envVars: [
      { key: "POSTGRES_USER", value: "admin", description: "Usuário do banco" },
      { key: "POSTGRES_PASSWORD", value: "admin_password", description: "Senha do banco" },
      { key: "POSTGRES_DB", value: "mydb", description: "Nome do banco" },
    ],
  },
  {
    id: "mysql",
    name: "MySQL",
    description: "Banco de dados relacional popular",
    icon: "database",
    category: "Database",
    services: [
      {
        name: "mysql",
        image: "mysql:8.0",
        ports: "3306:3306",
        volumes: "mysql_data:/var/lib/mysql",
        command: "",
      },
    ],
    envVars: [
      { key: "MYSQL_ROOT_PASSWORD", value: "root_password", description: "Senha root" },
      { key: "MYSQL_DATABASE", value: "mydb", description: "Nome do banco" },
      { key: "MYSQL_USER", value: "admin", description: "Usuário" },
      { key: "MYSQL_PASSWORD", value: "admin_password", description: "Senha" },
    ],
  },
  {
    id: "redis",
    name: "Redis",
    description: "Cache e message broker em memória",
    icon: "zap",
    category: "Cache",
    services: [
      {
        name: "redis",
        image: "redis:7-alpine",
        ports: "6379:6379",
        volumes: "redis_data:/data",
        command: "redis-server --appendonly yes",
      },
    ],
    envVars: [],
  },
  {
    id: "mongodb",
    name: "MongoDB",
    description: "Banco de dados NoSQL orientado a documentos",
    icon: "database",
    category: "Database",
    services: [
      {
        name: "mongo",
        image: "mongo:7",
        ports: "27017:27017",
        volumes: "mongo_data:/data/db",
        command: "",
      },
    ],
    envVars: [
      { key: "MONGO_INITDB_ROOT_USERNAME", value: "admin", description: "Usuário root" },
      { key: "MONGO_INITDB_ROOT_PASSWORD", value: "admin_password", description: "Senha root" },
    ],
  },
  {
    id: "nginx",
    name: "Nginx",
    description: "Servidor web e proxy reverso de alta performance",
    icon: "server",
    category: "Web Server",
    services: [
      {
        name: "nginx",
        image: "nginx:alpine",
        ports: "8080:80",
        volumes: "nginx_html:/usr/share/nginx/html",
        command: "",
      },
    ],
    envVars: [],
  },
  {
    id: "n8n",
    name: "n8n",
    description: "Plataforma de automação de workflow",
    icon: "workflow",
    category: "Automation",
    services: [
      {
        name: "n8n",
        image: "n8nio/n8n:latest",
        ports: "5678:5678",
        volumes: "n8n_data:/home/node/.n8n",
        command: "",
      },
    ],
    envVars: [
      { key: "N8N_BASIC_AUTH_ACTIVE", value: "true", description: "Ativar autenticação" },
      { key: "N8N_BASIC_AUTH_USER", value: "admin", description: "Usuário" },
      { key: "N8N_BASIC_AUTH_PASSWORD", value: "admin_password", description: "Senha" },
    ],
  },
  {
    id: "portainer",
    name: "Portainer",
    description: "Interface de gerenciamento Docker",
    icon: "container",
    category: "DevOps",
    services: [
      {
        name: "portainer",
        image: "portainer/portainer-ce:latest",
        ports: "9443:9443",
        volumes: "portainer_data:/data,/var/run/docker.sock:/var/run/docker.sock",
        command: "",
      },
    ],
    envVars: [],
  },
  {
    id: "minio",
    name: "MinIO",
    description: "Armazenamento de objetos compatível com S3",
    icon: "hard-drive",
    category: "Storage",
    services: [
      {
        name: "minio",
        image: "minio/minio:latest",
        ports: "9000:9000,9001:9001",
        volumes: "minio_data:/data",
        command: "server /data --console-address ':9001'",
      },
    ],
    envVars: [
      { key: "MINIO_ROOT_USER", value: "admin", description: "Usuário root" },
      { key: "MINIO_ROOT_PASSWORD", value: "admin_password", description: "Senha root (min 8 chars)" },
    ],
  },
  {
    id: "uptime-kuma",
    name: "Uptime Kuma",
    description: "Monitor de uptime auto-hospedado",
    icon: "activity",
    category: "Monitoring",
    services: [
      {
        name: "uptime-kuma",
        image: "louislam/uptime-kuma:latest",
        ports: "3001:3001",
        volumes: "uptime_data:/app/data",
        command: "",
      },
    ],
    envVars: [],
  },
];

export function getTemplate(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

export function getTemplatesByCategory(): Record<string, Template[]> {
  const categories: Record<string, Template[]> = {};
  for (const template of templates) {
    if (!categories[template.category]) {
      categories[template.category] = [];
    }
    categories[template.category].push(template);
  }
  return categories;
}
