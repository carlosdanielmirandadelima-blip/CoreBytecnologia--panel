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
  // --- 50 novos templates ---
  { name: "Jenkins", description: "Servidor de automação CI/CD", category: "devops", icon: "🔧", image: "jenkins/jenkins:lts", ports: '["8080:8080","50000:50000"]', volumes: '["jenkins_data:/var/jenkins_home"]', featured: true },
  { name: "GitLab", description: "Plataforma completa de DevOps com Git", category: "devops", icon: "🦊", image: "gitlab/gitlab-ce:latest", ports: '["80:80","443:443","2222:22"]', volumes: '["gitlab_config:/etc/gitlab","gitlab_logs:/var/log/gitlab","gitlab_data:/var/opt/gitlab"]', featured: true },
  { name: "SonarQube", description: "Análise de qualidade de código", category: "devops", icon: "🔍", image: "sonarqube:community", ports: '["9000:9000"]', volumes: '["sonarqube_data:/opt/sonarqube/data","sonarqube_logs:/opt/sonarqube/logs"]' },
  { name: "Drone CI", description: "Pipeline de CI/CD container-native", category: "devops", icon: "🚁", image: "drone/drone:latest", ports: '["80:80","443:443"]', envVars: '[{"key":"DRONE_SERVER_HOST","value":"localhost"},{"key":"DRONE_SERVER_PROTO","value":"http"}]' },
  { name: "Woodpecker CI", description: "CI/CD server fork do Drone", category: "devops", icon: "🐦", image: "woodpeckerci/woodpecker-server:latest", ports: '["8000:8000"]', volumes: '["woodpecker_data:/var/lib/woodpecker"]' },
  { name: "MariaDB", description: "Fork do MySQL com melhor performance", category: "database", icon: "🐬", image: "mariadb:11", ports: '["3306:3306"]', envVars: '[{"key":"MARIADB_ROOT_PASSWORD","value":"changeme"},{"key":"MARIADB_DATABASE","value":"mydb"}]', volumes: '["mariadb_data:/var/lib/mysql"]' },
  { name: "CockroachDB", description: "Banco de dados SQL distribuído", category: "database", icon: "🪳", image: "cockroachdb/cockroach:latest", ports: '["26257:26257","8080:8080"]', volumes: '["cockroach_data:/cockroach/cockroach-data"]' },
  { name: "InfluxDB", description: "Banco de dados de séries temporais", category: "database", icon: "📉", image: "influxdb:2", ports: '["8086:8086"]', volumes: '["influxdb_data:/var/lib/influxdb2"]', envVars: '[{"key":"DOCKER_INFLUXDB_INIT_USERNAME","value":"admin"},{"key":"DOCKER_INFLUXDB_INIT_PASSWORD","value":"changeme123"},{"key":"DOCKER_INFLUXDB_INIT_ORG","value":"myorg"},{"key":"DOCKER_INFLUXDB_INIT_BUCKET","value":"mybucket"}]' },
  { name: "Cassandra", description: "Banco de dados NoSQL distribuído", category: "database", icon: "👁️", image: "cassandra:latest", ports: '["9042:9042"]', volumes: '["cassandra_data:/var/lib/cassandra"]' },
  { name: "ClickHouse", description: "Banco de dados OLAP de alta performance", category: "database", icon: "🏠", image: "clickhouse/clickhouse-server:latest", ports: '["8123:8123","9000:9000"]', volumes: '["clickhouse_data:/var/lib/clickhouse"]' },
  { name: "Elasticsearch", description: "Motor de busca e análise distribuído", category: "database", icon: "🔎", image: "elasticsearch:8.12.0", ports: '["9200:9200","9300:9300"]', envVars: '[{"key":"discovery.type","value":"single-node"},{"key":"xpack.security.enabled","value":"false"}]', volumes: '["es_data:/usr/share/elasticsearch/data"]', featured: true },
  { name: "Kibana", description: "Visualização de dados para Elasticsearch", category: "monitoring", icon: "📊", image: "kibana:8.12.0", ports: '["5601:5601"]', envVars: '[{"key":"ELASTICSEARCH_HOSTS","value":"http://elasticsearch:9200"}]' },
  { name: "Logstash", description: "Pipeline de processamento de logs", category: "monitoring", icon: "📝", image: "logstash:8.12.0", ports: '["5044:5044","9600:9600"]' },
  { name: "Jaeger", description: "Distributed tracing para microserviços", category: "monitoring", icon: "🔭", image: "jaegertracing/all-in-one:latest", ports: '["16686:16686","14268:14268"]' },
  { name: "Loki", description: "Sistema de agregação de logs da Grafana", category: "monitoring", icon: "📋", image: "grafana/loki:latest", ports: '["3100:3100"]', volumes: '["loki_data:/loki"]' },
  { name: "Tempo", description: "Backend de tracing distribuído da Grafana", category: "monitoring", icon: "⏱️", image: "grafana/tempo:latest", ports: '["3200:3200","4317:4317"]', volumes: '["tempo_data:/tmp/tempo"]' },
  { name: "Caddy", description: "Servidor web com HTTPS automático", category: "web", icon: "🔒", image: "caddy:alpine", ports: '["80:80","443:443"]', volumes: '["caddy_data:/data","caddy_config:/config"]' },
  { name: "HAProxy", description: "Load balancer TCP/HTTP de alta performance", category: "web", icon: "⚖️", image: "haproxy:alpine", ports: '["80:80","443:443","8404:8404"]' },
  { name: "Apache", description: "Servidor web HTTP clássico", category: "web", icon: "🪶", image: "httpd:alpine", ports: '["80:80"]', volumes: '["apache_htdocs:/usr/local/apache2/htdocs"]' },
  { name: "Keycloak", description: "Gerenciamento de identidade e acesso (IAM)", category: "security", icon: "🔑", image: "quay.io/keycloak/keycloak:latest", ports: '["8080:8080"]', envVars: '[{"key":"KEYCLOAK_ADMIN","value":"admin"},{"key":"KEYCLOAK_ADMIN_PASSWORD","value":"changeme"}]', featured: true },
  { name: "Authentik", description: "Provedor de identidade open-source", category: "security", icon: "🛡️", image: "ghcr.io/goauthentik/server:latest", ports: '["9000:9000","9443:9443"]', envVars: '[{"key":"AUTHENTIK_SECRET_KEY","value":"changeme"}]' },
  { name: "Crowdsec", description: "Firewall colaborativo e IPS", category: "security", icon: "🛡️", image: "crowdsecurity/crowdsec:latest", ports: '["8080:8080","6060:6060"]', volumes: '["crowdsec_data:/var/lib/crowdsec/data","crowdsec_config:/etc/crowdsec"]' },
  { name: "Pi-hole", description: "Bloqueador de anúncios em nível de rede DNS", category: "security", icon: "🕳️", image: "pihole/pihole:latest", ports: '["53:53","80:80"]', envVars: '[{"key":"WEBPASSWORD","value":"changeme"}]', volumes: '["pihole_data:/etc/pihole","dnsmasq_data:/etc/dnsmasq.d"]' },
  { name: "WireGuard", description: "VPN moderna e rápida", category: "security", icon: "🔐", image: "linuxserver/wireguard:latest", ports: '["51820:51820/udp"]', envVars: '[{"key":"PEERS","value":"3"},{"key":"SERVERURL","value":"auto"}]', volumes: '["wireguard_config:/config"]' },
  { name: "Vaultwarden", description: "Servidor Bitwarden leve self-hosted", category: "security", icon: "🔏", image: "vaultwarden/server:latest", ports: '["80:80"]', volumes: '["vaultwarden_data:/data"]', featured: true },
  { name: "Mailhog", description: "Servidor SMTP de testes com interface web", category: "communication", icon: "📧", image: "mailhog/mailhog:latest", ports: '["1025:1025","8025:8025"]' },
  { name: "Mailu", description: "Servidor de email completo com webmail", category: "communication", icon: "📮", image: "mailu/admin:latest", ports: '["25:25","465:465","587:587","143:143","993:993","80:80","443:443"]' },
  { name: "Rocket.Chat", description: "Plataforma de comunicação de equipes", category: "communication", icon: "🚀", image: "rocket.chat:latest", ports: '["3000:3000"]', volumes: '["rocketchat_uploads:/app/uploads"]', envVars: '[{"key":"MONGO_URL","value":"mongodb://mongo:27017/rocketchat"}]' },
  { name: "Matrix Synapse", description: "Servidor de comunicação descentralizada", category: "communication", icon: "🔗", image: "matrixdotorg/synapse:latest", ports: '["8008:8008"]', volumes: '["synapse_data:/data"]' },
  { name: "Zulip", description: "Chat de equipe com organização por tópicos", category: "communication", icon: "💬", image: "zulip/docker-zulip:latest", ports: '["80:80","443:443"]', volumes: '["zulip_data:/data"]' },
  { name: "Drone Runner", description: "Runner Docker para Drone CI", category: "devops", icon: "🏃", image: "drone/drone-runner-docker:latest", ports: '["3000:3000"]', envVars: '[{"key":"DRONE_RPC_HOST","value":"drone-server"},{"key":"DRONE_RPC_SECRET","value":"changeme"}]', volumes: '["/var/run/docker.sock:/var/run/docker.sock"]' },
  { name: "Registry", description: "Registry Docker privado", category: "devops", icon: "📦", image: "registry:2", ports: '["5000:5000"]', volumes: '["registry_data:/var/lib/registry"]' },
  { name: "Nexus", description: "Gerenciador de repositórios de artefatos", category: "devops", icon: "📚", image: "sonatype/nexus3:latest", ports: '["8081:8081"]', volumes: '["nexus_data:/nexus-data"]' },
  { name: "Ansible AWX", description: "Interface web para Ansible", category: "devops", icon: "🔧", image: "ansible/awx:latest", ports: '["80:80"]' },
  { name: "Consul", description: "Service mesh e service discovery da HashiCorp", category: "devops", icon: "🏛️", image: "hashicorp/consul:latest", ports: '["8500:8500","8600:8600"]', volumes: '["consul_data:/consul/data"]' },
  { name: "Nomad", description: "Orquestrador de workloads da HashiCorp", category: "devops", icon: "🏕️", image: "hashicorp/nomad:latest", ports: '["4646:4646","4647:4647"]', volumes: '["nomad_data:/nomad/data"]' },
  { name: "Outline", description: "Wiki e base de conhecimento de equipe", category: "cms", icon: "📖", image: "outlinewiki/outline:latest", ports: '["3000:3000"]', envVars: '[{"key":"SECRET_KEY","value":"changeme"},{"key":"DATABASE_URL","value":"postgresql://user:pass@db:5432/outline"}]' },
  { name: "BookStack", description: "Plataforma de documentação e wiki", category: "cms", icon: "📚", image: "linuxserver/bookstack:latest", ports: '["6875:80"]', envVars: '[{"key":"DB_HOST","value":"db"},{"key":"DB_DATABASE","value":"bookstack"},{"key":"DB_USERNAME","value":"user"},{"key":"DB_PASSWORD","value":"changeme"}]', volumes: '["bookstack_data:/config"]' },
  { name: "Wiki.js", description: "Wiki moderna e poderosa com Node.js", category: "cms", icon: "📝", image: "requarks/wiki:latest", ports: '["3000:3000"]', envVars: '[{"key":"DB_TYPE","value":"postgres"},{"key":"DB_HOST","value":"db"},{"key":"DB_PORT","value":"5432"},{"key":"DB_NAME","value":"wiki"},{"key":"DB_USER","value":"user"},{"key":"DB_PASS","value":"changeme"}]', featured: true },
  { name: "Plausible", description: "Analytics web privacy-friendly", category: "monitoring", icon: "📈", image: "plausible/analytics:latest", ports: '["8000:8000"]', envVars: '[{"key":"BASE_URL","value":"http://localhost:8000"},{"key":"SECRET_KEY_BASE","value":"changeme"}]' },
  { name: "Umami", description: "Analytics web simples e privacy-focused", category: "monitoring", icon: "📊", image: "ghcr.io/umami-software/umami:postgresql-latest", ports: '["3000:3000"]', envVars: '[{"key":"DATABASE_URL","value":"postgresql://user:pass@db:5432/umami"}]' },
  { name: "Seq", description: "Servidor de logs estruturados", category: "monitoring", icon: "📋", image: "datalust/seq:latest", ports: '["5341:5341","80:80"]', envVars: '[{"key":"ACCEPT_EULA","value":"Y"}]', volumes: '["seq_data:/data"]' },
  { name: "Netdata", description: "Monitoramento de infraestrutura em tempo real", category: "monitoring", icon: "📡", image: "netdata/netdata:latest", ports: '["19999:19999"]', volumes: '["/proc:/host/proc:ro","/sys:/host/sys:ro","/var/run/docker.sock:/var/run/docker.sock:ro"]' },
  { name: "Homer", description: "Dashboard de serviços self-hosted", category: "web", icon: "🏠", image: "b4bz/homer:latest", ports: '["8080:8080"]', volumes: '["homer_assets:/www/assets"]' },
  { name: "Heimdall", description: "Dashboard de aplicações elegante", category: "web", icon: "🌈", image: "linuxserver/heimdall:latest", ports: '["80:80","443:443"]', volumes: '["heimdall_config:/config"]' },
  { name: "Dashy", description: "Dashboard pessoal altamente customizável", category: "web", icon: "🎨", image: "lissy93/dashy:latest", ports: '["8080:8080"]', volumes: '["dashy_config:/app/user-data"]' },
  { name: "Filebrowser", description: "Gerenciador de arquivos web", category: "storage", icon: "📁", image: "filebrowser/filebrowser:latest", ports: '["8080:80"]', volumes: '["filebrowser_data:/srv","filebrowser_db:/database"]' },
  { name: "Seafile", description: "Plataforma de sincronização de arquivos", category: "storage", icon: "🌊", image: "seafileltd/seafile-mc:latest", ports: '["80:80","443:443"]', volumes: '["seafile_data:/shared"]' },
  { name: "PhotoPrism", description: "Gerenciador de fotos com IA", category: "storage", icon: "📷", image: "photoprism/photoprism:latest", ports: '["2342:2342"]', envVars: '[{"key":"PHOTOPRISM_ADMIN_PASSWORD","value":"changeme"},{"key":"PHOTOPRISM_SITE_URL","value":"http://localhost:2342/"}]', volumes: '["photoprism_storage:/photoprism/storage"]' },
  { name: "Immich", description: "Alternativa self-hosted ao Google Photos", category: "storage", icon: "🖼️", image: "ghcr.io/immich-app/immich-server:latest", ports: '["2283:3001"]', volumes: '["immich_upload:/usr/src/app/upload"]', featured: true },
  { name: "Duplicati", description: "Backup na nuvem criptografado", category: "storage", icon: "💾", image: "linuxserver/duplicati:latest", ports: '["8200:8200"]', volumes: '["duplicati_config:/config","duplicati_backups:/backups"]' },
  // --- mais 50 templates populares ---
  { name: "Pocketbase", description: "Backend em um único arquivo com dashboard", category: "database", icon: "🎒", image: "ghcr.io/muchobien/pocketbase:latest", ports: '["8090:8090"]', volumes: '["pocketbase_data:/pb_data"]', featured: true },
  { name: "Meilisearch", description: "Motor de busca ultra-rápido e fácil de usar", category: "database", icon: "🔍", image: "getmeili/meilisearch:latest", ports: '["7700:7700"]', envVars: '[{"key":"MEILI_MASTER_KEY","value":"changeme"}]', volumes: '["meilisearch_data:/meili_data"]' },
  { name: "Typesense", description: "Motor de busca tolerante a erros de digitação", category: "database", icon: "⌨️", image: "typesense/typesense:latest", ports: '["8108:8108"]', envVars: '[{"key":"TYPESENSE_API_KEY","value":"changeme"}]', volumes: '["typesense_data:/data"]' },
  { name: "SurrealDB", description: "Banco de dados multi-modelo cloud-native", category: "database", icon: "🌌", image: "surrealdb/surrealdb:latest", ports: '["8000:8000"]', volumes: '["surrealdb_data:/data"]' },
  { name: "Valkey", description: "Fork open-source do Redis", category: "cache", icon: "🔑", image: "valkey/valkey:latest", ports: '["6379:6379"]', volumes: '["valkey_data:/data"]' },
  { name: "KeyDB", description: "Redis fork multi-threaded de alta performance", category: "cache", icon: "⚡", image: "eqalpha/keydb:latest", ports: '["6379:6379"]', volumes: '["keydb_data:/data"]' },
  { name: "Memcached", description: "Sistema de cache em memória distribuído", category: "cache", icon: "🧠", image: "memcached:alpine", ports: '["11211:11211"]' },
  { name: "Paperless-ngx", description: "Sistema de gerenciamento de documentos", category: "storage", icon: "📄", image: "ghcr.io/paperless-ngx/paperless-ngx:latest", ports: '["8000:8000"]', envVars: '[{"key":"PAPERLESS_SECRET_KEY","value":"changeme"}]', volumes: '["paperless_data:/usr/src/paperless/data","paperless_media:/usr/src/paperless/media"]', featured: true },
  { name: "Syncthing", description: "Sincronização de arquivos P2P contínua", category: "storage", icon: "🔄", image: "syncthing/syncthing:latest", ports: '["8384:8384","22000:22000"]', volumes: '["syncthing_data:/var/syncthing"]' },
  { name: "Restic Server", description: "Servidor REST para backups Restic", category: "storage", icon: "💿", image: "restic/rest-server:latest", ports: '["8000:8000"]', volumes: '["restic_data:/data"]' },
  { name: "Jellyfin", description: "Servidor de mídia open-source", category: "storage", icon: "🎬", image: "jellyfin/jellyfin:latest", ports: '["8096:8096"]', volumes: '["jellyfin_config:/config","jellyfin_cache:/cache"]', featured: true },
  { name: "Plex", description: "Servidor de mídia com streaming", category: "storage", icon: "🎞️", image: "plexinc/pms-docker:latest", ports: '["32400:32400"]', volumes: '["plex_config:/config","plex_data:/data"]' },
  { name: "Navidrome", description: "Servidor de música pessoal com streaming", category: "storage", icon: "🎵", image: "deluan/navidrome:latest", ports: '["4533:4533"]', volumes: '["navidrome_data:/data","navidrome_music:/music"]' },
  { name: "Overseerr", description: "Gerenciador de solicitações de mídia", category: "storage", icon: "🎭", image: "linuxserver/overseerr:latest", ports: '["5055:5055"]', volumes: '["overseerr_config:/config"]' },
  { name: "Linkwarden", description: "Gerenciador de bookmarks colaborativo", category: "web", icon: "🔖", image: "ghcr.io/linkwarden/linkwarden:latest", ports: '["3000:3000"]', envVars: '[{"key":"DATABASE_URL","value":"postgresql://user:pass@db:5432/linkwarden"},{"key":"NEXTAUTH_SECRET","value":"changeme"}]' },
  { name: "Wallabag", description: "Aplicação read-it-later self-hosted", category: "web", icon: "📰", image: "wallabag/wallabag:latest", ports: '["80:80"]', volumes: '["wallabag_data:/var/www/wallabag/data"]' },
  { name: "Miniflux", description: "Leitor RSS minimalista e rápido", category: "web", icon: "📡", image: "miniflux/miniflux:latest", ports: '["8080:8080"]', envVars: '[{"key":"DATABASE_URL","value":"postgres://user:pass@db/miniflux?sslmode=disable"},{"key":"CREATE_ADMIN","value":"1"},{"key":"ADMIN_USERNAME","value":"admin"},{"key":"ADMIN_PASSWORD","value":"changeme"}]' },
  { name: "FreshRSS", description: "Agregador RSS self-hosted com interface moderna", category: "web", icon: "📰", image: "freshrss/freshrss:latest", ports: '["8080:80"]', volumes: '["freshrss_data:/var/www/FreshRSS/data"]' },
  { name: "Stirling PDF", description: "Ferramenta completa de manipulação de PDF", category: "web", icon: "📑", image: "frooodle/s-pdf:latest", ports: '["8080:8080"]', featured: true },
  { name: "IT Tools", description: "Coleção de ferramentas úteis para desenvolvedores", category: "web", icon: "🛠️", image: "corentinth/it-tools:latest", ports: '["8080:80"]' },
  { name: "CyberChef", description: "Canivete suíço de operações com dados", category: "web", icon: "🍳", image: "ghcr.io/gchq/cyberchef:latest", ports: '["8000:8000"]' },
  { name: "Excalidraw", description: "Quadro branco virtual para diagramas", category: "web", icon: "✏️", image: "excalidraw/excalidraw:latest", ports: '["80:80"]' },
  { name: "Draw.io", description: "Editor de diagramas e fluxogramas", category: "web", icon: "📐", image: "jgraph/drawio:latest", ports: '["8080:8080","8443:8443"]' },
  { name: "Code Server", description: "VS Code no navegador", category: "devops", icon: "💻", image: "codercom/code-server:latest", ports: '["8080:8080"]', envVars: '[{"key":"PASSWORD","value":"changeme"}]', volumes: '["codeserver_data:/home/coder"]', featured: true },
  { name: "Gitness", description: "Plataforma de código open-source da Harness", category: "devops", icon: "🌿", image: "harness/gitness:latest", ports: '["3000:3000"]', volumes: '["gitness_data:/data"]' },
  { name: "Forgejo", description: "Servidor Git community-driven fork do Gitea", category: "devops", icon: "🔨", image: "codeberg.org/forgejo/forgejo:latest", ports: '["3000:3000","2222:22"]', volumes: '["forgejo_data:/data"]' },
  { name: "Argo CD", description: "GitOps para Kubernetes", category: "devops", icon: "🐙", image: "quay.io/argoproj/argocd:latest", ports: '["8080:8080"]' },
  { name: "Harbor", description: "Registry de containers enterprise", category: "devops", icon: "⚓", image: "goharbor/harbor-core:latest", ports: '["80:8080"]' },
  { name: "Semaphore", description: "Interface web moderna para Ansible", category: "devops", icon: "🚦", image: "semaphoreui/semaphore:latest", ports: '["3000:3000"]', envVars: '[{"key":"SEMAPHORE_DB_DIALECT","value":"bolt"},{"key":"SEMAPHORE_ADMIN_PASSWORD","value":"changeme"},{"key":"SEMAPHORE_ADMIN","value":"admin"},{"key":"SEMAPHORE_ADMIN_EMAIL","value":"admin@localhost"}]' },
  { name: "Zammad", description: "Sistema de helpdesk e ticketing", category: "communication", icon: "🎫", image: "zammad/zammad-docker-compose:latest", ports: '["8080:8080"]' },
  { name: "Ntfy", description: "Servidor de notificações push via HTTP", category: "communication", icon: "🔔", image: "binwiederhier/ntfy:latest", ports: '["80:80"]', volumes: '["ntfy_cache:/var/cache/ntfy","ntfy_etc:/etc/ntfy"]' },
  { name: "Gotify", description: "Servidor de notificações push simples", category: "communication", icon: "📲", image: "gotify/server:latest", ports: '["80:80"]', volumes: '["gotify_data:/app/data"]' },
  { name: "Apprise", description: "API unificada de notificações multi-plataforma", category: "communication", icon: "📣", image: "caronc/apprise:latest", ports: '["8000:8000"]' },
  { name: "Listmonk", description: "Newsletter e mailing list self-hosted", category: "communication", icon: "📬", image: "listmonk/listmonk:latest", ports: '["9000:9000"]', envVars: '[{"key":"LISTMONK_DB_HOST","value":"db"},{"key":"LISTMONK_DB_PORT","value":"5432"},{"key":"LISTMONK_DB_NAME","value":"listmonk"},{"key":"LISTMONK_DB_USER","value":"user"},{"key":"LISTMONK_DB_PASSWORD","value":"changeme"}]' },
  { name: "Uptime Robot", description: "Monitoramento de sites com alertas", category: "monitoring", icon: "🤖", image: "louislam/uptime-kuma:latest", ports: '["3001:3001"]', volumes: '["uptimerobot_data:/app/data"]' },
  { name: "Graylog", description: "Gerenciamento de logs centralizado enterprise", category: "monitoring", icon: "📋", image: "graylog/graylog:latest", ports: '["9000:9000","12201:12201","1514:1514"]', envVars: '[{"key":"GRAYLOG_PASSWORD_SECRET","value":"changemechangemechangeme"},{"key":"GRAYLOG_ROOT_PASSWORD_SHA2","value":"8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"}]' },
  { name: "Zabbix", description: "Plataforma de monitoramento enterprise", category: "monitoring", icon: "📡", image: "zabbix/zabbix-web-nginx-mysql:latest", ports: '["8080:8080"]', envVars: '[{"key":"DB_SERVER_HOST","value":"db"},{"key":"MYSQL_USER","value":"zabbix"},{"key":"MYSQL_PASSWORD","value":"changeme"}]' },
  { name: "Checkmk", description: "Monitoramento de infraestrutura IT", category: "monitoring", icon: "✅", image: "checkmk/check-mk-raw:latest", ports: '["8080:5000"]', volumes: '["checkmk_data:/omd/sites"]' },
  { name: "Beszel", description: "Hub de monitoramento de servidores leve", category: "monitoring", icon: "📊", image: "henrygd/beszel:latest", ports: '["8090:8090"]', volumes: '["beszel_data:/beszel_data"]' },
  { name: "Actual Budget", description: "App de finanças pessoais e orçamento", category: "automation", icon: "💰", image: "actualbudget/actual-server:latest", ports: '["5006:5006"]', volumes: '["actual_data:/data"]' },
  { name: "Firefly III", description: "Gerenciador de finanças pessoais", category: "automation", icon: "🔥", image: "fireflyiii/core:latest", ports: '["8080:8080"]', envVars: '[{"key":"APP_KEY","value":"changeme32characterslongkeyhere!!"},{"key":"DB_CONNECTION","value":"pgsql"},{"key":"DB_HOST","value":"db"},{"key":"DB_DATABASE","value":"firefly"},{"key":"DB_USERNAME","value":"user"},{"key":"DB_PASSWORD","value":"changeme"}]', volumes: '["firefly_upload:/var/www/html/storage/upload"]' },
  { name: "Vikunja", description: "App de gerenciamento de tarefas e to-do", category: "automation", icon: "✅", image: "vikunja/vikunja:latest", ports: '["3456:3456"]', volumes: '["vikunja_files:/app/vikunja/files"]' },
  { name: "Plane", description: "Gerenciamento de projetos open-source (alt. Jira)", category: "automation", icon: "✈️", image: "makeplane/plane-frontend:latest", ports: '["3000:3000"]', featured: true },
  { name: "Focalboard", description: "Gerenciamento de projetos estilo Trello/Notion", category: "automation", icon: "📋", image: "mattermost/focalboard:latest", ports: '["8000:8000"]', volumes: '["focalboard_data:/opt/focalboard/data"]' },
  { name: "Trilium", description: "Base de conhecimento pessoal hierárquica", category: "cms", icon: "🌳", image: "zadam/trilium:latest", ports: '["8080:8080"]', volumes: '["trilium_data:/home/node/trilium-data"]' },
  { name: "HedgeDoc", description: "Editor de markdown colaborativo em tempo real", category: "cms", icon: "📝", image: "quay.io/hedgedoc/hedgedoc:latest", ports: '["3000:3000"]', envVars: '[{"key":"CMD_DB_URL","value":"postgres://user:pass@db:5432/hedgedoc"}]', volumes: '["hedgedoc_uploads:/hedgedoc/public/uploads"]' },
  { name: "Docuseal", description: "Assinatura digital de documentos", category: "automation", icon: "✍️", image: "docuseal/docuseal:latest", ports: '["3000:3000"]', volumes: '["docuseal_data:/data"]' },
  { name: "Weblate", description: "Plataforma de tradução e localização", category: "devops", icon: "🌍", image: "weblate/weblate:latest", ports: '["8080:8080"]', volumes: '["weblate_data:/app/data"]' },
  { name: "Crowdin", description: "Gerenciamento de traduções e localização", category: "devops", icon: "🗣️", image: "crowdin/crowdin-cli:latest", ports: '["8080:8080"]' },
  { name: "OpenProject", description: "Gerenciamento de projetos enterprise", category: "automation", icon: "📊", image: "openproject/openproject:latest", ports: '["8080:80"]', volumes: '["openproject_data:/var/openproject/assets"]', envVars: '[{"key":"OPENPROJECT_SECRET_KEY_BASE","value":"changeme"}]' },
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
