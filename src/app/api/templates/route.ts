import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const I = "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png";

const defaultTemplates = [
  { name: "Nginx", description: "Servidor web rápido e proxy reverso", category: "web", icon: `${I}/nginx.png`, image: "nginx:alpine", ports: '["80:80","443:443"]', featured: true },
  { name: "PostgreSQL", description: "Banco de dados relacional avançado", category: "database", icon: `${I}/postgresql.png`, image: "postgres:16-alpine", ports: '["5432:5432"]', envVars: '[{"key":"POSTGRES_PASSWORD","value":"changeme"},{"key":"POSTGRES_DB","value":"mydb"}]', volumes: '["pgdata:/var/lib/postgresql/data"]', featured: true },
  { name: "MySQL", description: "Banco de dados relacional popular", category: "database", icon: `${I}/mysql.png`, image: "mysql:8", ports: '["3306:3306"]', envVars: '[{"key":"MYSQL_ROOT_PASSWORD","value":"changeme"},{"key":"MYSQL_DATABASE","value":"mydb"}]', volumes: '["mysqldata:/var/lib/mysql"]', featured: true },
  { name: "MongoDB", description: "Banco de dados NoSQL orientado a documentos", category: "database", icon: `${I}/mongodb.png`, image: "mongo:7", ports: '["27017:27017"]', volumes: '["mongodata:/data/db"]', featured: true },
  { name: "Redis", description: "Armazenamento em memória e cache", category: "cache", icon: `${I}/redis.png`, image: "redis:alpine", ports: '["6379:6379"]', featured: true },
  { name: "WordPress", description: "CMS mais popular do mundo", category: "cms", icon: `${I}/wordpress.png`, image: "wordpress:latest", ports: '["8080:80"]', envVars: '[{"key":"WORDPRESS_DB_HOST","value":"db:3306"},{"key":"WORDPRESS_DB_PASSWORD","value":"changeme"}]', featured: true },
  { name: "n8n", description: "Automação de workflows low-code", category: "automation", icon: `${I}/n8n.png`, image: "n8nio/n8n:latest", ports: '["5678:5678"]', volumes: '["n8n_data:/home/node/.n8n"]', featured: true },
  { name: "Uptime Kuma", description: "Monitoramento de uptime self-hosted", category: "monitoring", icon: `${I}/uptime-kuma.png`, image: "louislam/uptime-kuma:latest", ports: '["3001:3001"]', volumes: '["uptimekuma:/app/data"]', featured: true },
  { name: "MinIO", description: "Armazenamento de objetos compatível com S3", category: "storage", icon: `${I}/minio.png`, image: "minio/minio:latest", ports: '["9000:9000","9001:9001"]', envVars: '[{"key":"MINIO_ROOT_USER","value":"admin"},{"key":"MINIO_ROOT_PASSWORD","value":"changeme"}]' },
  { name: "Portainer", description: "Interface gráfica para Docker", category: "devops", icon: `${I}/portainer.png`, image: "portainer/portainer-ce:latest", ports: '["9443:9443"]', volumes: '["portainer_data:/data","/var/run/docker.sock:/var/run/docker.sock"]' },
  { name: "Grafana", description: "Plataforma de observabilidade e dashboards", category: "monitoring", icon: `${I}/grafana.png`, image: "grafana/grafana:latest", ports: '["3000:3000"]', volumes: '["grafana_data:/var/lib/grafana"]' },
  { name: "Prometheus", description: "Monitoramento e alertas de métricas", category: "monitoring", icon: `${I}/prometheus.png`, image: "prom/prometheus:latest", ports: '["9090:9090"]', volumes: '["prometheus_data:/prometheus"]' },
  { name: "Gitea", description: "Servidor Git self-hosted leve", category: "devops", icon: `${I}/gitea.png`, image: "gitea/gitea:latest", ports: '["3000:3000","2222:22"]', volumes: '["gitea_data:/data"]' },
  { name: "Adminer", description: "Gerenciador de banco de dados em uma página", category: "database", icon: `${I}/adminer.png`, image: "adminer:latest", ports: '["8080:8080"]' },
  { name: "RabbitMQ", description: "Message broker AMQP", category: "messaging", icon: `${I}/rabbitmq.png`, image: "rabbitmq:3-management-alpine", ports: '["5672:5672","15672:15672"]' },
  { name: "Traefik", description: "Proxy reverso e load balancer cloud-native", category: "web", icon: `${I}/traefik.png`, image: "traefik:v3.0", ports: '["80:80","443:443","8080:8080"]', volumes: '["/var/run/docker.sock:/var/run/docker.sock"]' },
  { name: "Nextcloud", description: "Plataforma de produtividade e armazenamento", category: "storage", icon: `${I}/nextcloud.png`, image: "nextcloud:latest", ports: '["8080:80"]', volumes: '["nextcloud_data:/var/www/html"]', featured: true },
  { name: "Ghost", description: "Plataforma de publicação profissional", category: "cms", icon: `${I}/ghost.png`, image: "ghost:latest", ports: '["2368:2368"]', volumes: '["ghost_data:/var/lib/ghost/content"]' },
  { name: "Mattermost", description: "Plataforma de comunicação de equipe", category: "communication", icon: `${I}/mattermost.png`, image: "mattermost/mattermost-team-edition:latest", ports: '["8065:8065"]', volumes: '["mattermost_data:/mattermost/data"]' },
  { name: "Vault", description: "Gerenciamento de secrets da HashiCorp", category: "security", icon: `${I}/vault.png`, image: "hashicorp/vault:latest", ports: '["8200:8200"]', envVars: '[{"key":"VAULT_DEV_ROOT_TOKEN_ID","value":"myroot"}]' },
  { name: "Evolution API", description: "API para WhatsApp multi-device com baileys", category: "communication", icon: `${I}/whatsapp.png`, image: "atrevido/evolution-api:latest", ports: '["8080:8080"]', envVars: '[{"key":"AUTHENTICATION_API_KEY","value":"changeme"},{"key":"DATABASE_PROVIDER","value":"postgresql"},{"key":"DATABASE_CONNECTION_URI","value":"postgresql://user:pass@db:5432/evolution"}]', volumes: '["evolution_store:/evolution/store","evolution_instances:/evolution/instances"]', featured: true },
  { name: "Typebot", description: "Construtor de chatbots conversacionais", category: "automation", icon: `${I}/typebot.png`, image: "baptistearno/typebot-builder:latest", ports: '["3000:3000"]', envVars: '[{"key":"DATABASE_URL","value":"postgresql://user:pass@db:5432/typebot"},{"key":"NEXTAUTH_URL","value":"http://localhost:3000"}]' },
  { name: "Chatwoot", description: "Plataforma de atendimento ao cliente omnichannel", category: "communication", icon: `${I}/chatwoot.png`, image: "chatwoot/chatwoot:latest", ports: '["3000:3000"]', envVars: '[{"key":"SECRET_KEY_BASE","value":"changeme"},{"key":"RAILS_ENV","value":"production"}]', volumes: '["chatwoot_data:/app/storage"]' },
  { name: "Dify", description: "Plataforma de desenvolvimento de apps com IA/LLM", category: "automation", icon: `${I}/dify.png`, image: "langgenius/dify-web:latest", ports: '["3000:3000"]', featured: true },
  { name: "Nocodb", description: "Alternativa open-source ao Airtable", category: "database", icon: `${I}/nocodb.png`, image: "nocodb/nocodb:latest", ports: '["8080:8080"]', volumes: '["nocodb_data:/usr/app/data"]', envVars: '[{"key":"NC_DB","value":"pg://db:5432?u=user&p=pass&d=nocodb"}]' },
  { name: "Metabase", description: "Business intelligence e dashboards de dados", category: "monitoring", icon: `${I}/metabase.png`, image: "metabase/metabase:latest", ports: '["3000:3000"]', volumes: '["metabase_data:/metabase-data"]' },
  { name: "Strapi", description: "CMS headless open-source com API REST e GraphQL", category: "cms", icon: `${I}/strapi.png`, image: "strapi/strapi:latest", ports: '["1337:1337"]', volumes: '["strapi_data:/srv/app"]' },
  { name: "Appsmith", description: "Plataforma low-code para construir apps internos", category: "automation", icon: `${I}/appsmith.png`, image: "appsmith/appsmith-ce:latest", ports: '["80:80","443:443"]', volumes: '["appsmith_data:/appsmith-stacks"]' },
  { name: "Directus", description: "Plataforma de dados com API REST e GraphQL", category: "cms", icon: `${I}/directus.png`, image: "directus/directus:latest", ports: '["8055:8055"]', envVars: '[{"key":"KEY","value":"changeme"},{"key":"SECRET","value":"changeme"},{"key":"DB_CLIENT","value":"pg"}]', volumes: '["directus_data:/directus/uploads"]' },
  { name: "Supabase", description: "Alternativa open-source ao Firebase", category: "database", icon: `${I}/supabase.png`, image: "supabase/postgres:latest", ports: '["5432:5432","8000:8000"]', envVars: '[{"key":"POSTGRES_PASSWORD","value":"changeme"}]', volumes: '["supabase_data:/var/lib/postgresql/data"]', featured: true },
  { name: "Jenkins", description: "Servidor de automação CI/CD", category: "devops", icon: `${I}/jenkins.png`, image: "jenkins/jenkins:lts", ports: '["8080:8080","50000:50000"]', volumes: '["jenkins_data:/var/jenkins_home"]', featured: true },
  { name: "GitLab", description: "Plataforma completa de DevOps com Git", category: "devops", icon: `${I}/gitlab.png`, image: "gitlab/gitlab-ce:latest", ports: '["80:80","443:443","2222:22"]', volumes: '["gitlab_config:/etc/gitlab","gitlab_logs:/var/log/gitlab","gitlab_data:/var/opt/gitlab"]', featured: true },
  { name: "SonarQube", description: "Análise de qualidade de código", category: "devops", icon: `${I}/sonarqube.png`, image: "sonarqube:community", ports: '["9000:9000"]', volumes: '["sonarqube_data:/opt/sonarqube/data","sonarqube_logs:/opt/sonarqube/logs"]' },
  { name: "Drone CI", description: "Pipeline de CI/CD container-native", category: "devops", icon: `${I}/drone.png`, image: "drone/drone:latest", ports: '["80:80","443:443"]', envVars: '[{"key":"DRONE_SERVER_HOST","value":"localhost"},{"key":"DRONE_SERVER_PROTO","value":"http"}]' },
  { name: "Woodpecker CI", description: "CI/CD server fork do Drone", category: "devops", icon: `${I}/woodpecker-ci.png`, image: "woodpeckerci/woodpecker-server:latest", ports: '["8000:8000"]', volumes: '["woodpecker_data:/var/lib/woodpecker"]' },
  { name: "MariaDB", description: "Fork do MySQL com melhor performance", category: "database", icon: `${I}/mariadb.png`, image: "mariadb:11", ports: '["3306:3306"]', envVars: '[{"key":"MARIADB_ROOT_PASSWORD","value":"changeme"},{"key":"MARIADB_DATABASE","value":"mydb"}]', volumes: '["mariadb_data:/var/lib/mysql"]' },
  { name: "CockroachDB", description: "Banco de dados SQL distribuído", category: "database", icon: `${I}/cockroachdb.png`, image: "cockroachdb/cockroach:latest", ports: '["26257:26257","8080:8080"]', volumes: '["cockroach_data:/cockroach/cockroach-data"]' },
  { name: "InfluxDB", description: "Banco de dados de séries temporais", category: "database", icon: `${I}/influxdb.png`, image: "influxdb:2", ports: '["8086:8086"]', volumes: '["influxdb_data:/var/lib/influxdb2"]', envVars: '[{"key":"DOCKER_INFLUXDB_INIT_USERNAME","value":"admin"},{"key":"DOCKER_INFLUXDB_INIT_PASSWORD","value":"changeme123"},{"key":"DOCKER_INFLUXDB_INIT_ORG","value":"myorg"},{"key":"DOCKER_INFLUXDB_INIT_BUCKET","value":"mybucket"}]' },
  { name: "Cassandra", description: "Banco de dados NoSQL distribuído", category: "database", icon: `${I}/cassandra.png`, image: "cassandra:latest", ports: '["9042:9042"]', volumes: '["cassandra_data:/var/lib/cassandra"]' },
  { name: "ClickHouse", description: "Banco de dados OLAP de alta performance", category: "database", icon: `${I}/clickhouse.png`, image: "clickhouse/clickhouse-server:latest", ports: '["8123:8123","9000:9000"]', volumes: '["clickhouse_data:/var/lib/clickhouse"]' },
  { name: "Elasticsearch", description: "Motor de busca e análise distribuído", category: "database", icon: `${I}/elasticsearch.png`, image: "elasticsearch:8.12.0", ports: '["9200:9200","9300:9300"]', envVars: '[{"key":"discovery.type","value":"single-node"},{"key":"xpack.security.enabled","value":"false"}]', volumes: '["es_data:/usr/share/elasticsearch/data"]', featured: true },
  { name: "Kibana", description: "Visualização de dados para Elasticsearch", category: "monitoring", icon: `${I}/kibana.png`, image: "kibana:8.12.0", ports: '["5601:5601"]', envVars: '[{"key":"ELASTICSEARCH_HOSTS","value":"http://elasticsearch:9200"}]' },
  { name: "Logstash", description: "Pipeline de processamento de logs", category: "monitoring", icon: `${I}/logstash.png`, image: "logstash:8.12.0", ports: '["5044:5044","9600:9600"]' },
  { name: "Jaeger", description: "Distributed tracing para microserviços", category: "monitoring", icon: `${I}/jaeger.png`, image: "jaegertracing/all-in-one:latest", ports: '["16686:16686","14268:14268"]' },
  { name: "Loki", description: "Sistema de agregação de logs da Grafana", category: "monitoring", icon: `${I}/loki.png`, image: "grafana/loki:latest", ports: '["3100:3100"]', volumes: '["loki_data:/loki"]' },
  { name: "Tempo", description: "Backend de tracing distribuído da Grafana", category: "monitoring", icon: `${I}/grafana-tempo.png`, image: "grafana/tempo:latest", ports: '["3200:3200","4317:4317"]', volumes: '["tempo_data:/tmp/tempo"]' },
  { name: "Caddy", description: "Servidor web com HTTPS automático", category: "web", icon: `${I}/caddy.png`, image: "caddy:alpine", ports: '["80:80","443:443"]', volumes: '["caddy_data:/data","caddy_config:/config"]' },
  { name: "HAProxy", description: "Load balancer TCP/HTTP de alta performance", category: "web", icon: `${I}/haproxy.png`, image: "haproxy:alpine", ports: '["80:80","443:443","8404:8404"]' },
  { name: "Apache", description: "Servidor web HTTP clássico", category: "web", icon: `${I}/apache.png`, image: "httpd:alpine", ports: '["80:80"]', volumes: '["apache_htdocs:/usr/local/apache2/htdocs"]' },
  { name: "Keycloak", description: "Gerenciamento de identidade e acesso (IAM)", category: "security", icon: `${I}/keycloak.png`, image: "quay.io/keycloak/keycloak:latest", ports: '["8080:8080"]', envVars: '[{"key":"KEYCLOAK_ADMIN","value":"admin"},{"key":"KEYCLOAK_ADMIN_PASSWORD","value":"changeme"}]', featured: true },
  { name: "Authentik", description: "Provedor de identidade open-source", category: "security", icon: `${I}/authentik.png`, image: "ghcr.io/goauthentik/server:latest", ports: '["9000:9000","9443:9443"]', envVars: '[{"key":"AUTHENTIK_SECRET_KEY","value":"changeme"}]' },
  { name: "Crowdsec", description: "Firewall colaborativo e IPS", category: "security", icon: `${I}/crowdsec.png`, image: "crowdsecurity/crowdsec:latest", ports: '["8080:8080","6060:6060"]', volumes: '["crowdsec_data:/var/lib/crowdsec/data","crowdsec_config:/etc/crowdsec"]' },
  { name: "Pi-hole", description: "Bloqueador de anúncios em nível de rede DNS", category: "security", icon: `${I}/pi-hole.png`, image: "pihole/pihole:latest", ports: '["53:53","80:80"]', envVars: '[{"key":"WEBPASSWORD","value":"changeme"}]', volumes: '["pihole_data:/etc/pihole","dnsmasq_data:/etc/dnsmasq.d"]' },
  { name: "WireGuard", description: "VPN moderna e rápida", category: "security", icon: `${I}/wireguard.png`, image: "linuxserver/wireguard:latest", ports: '["51820:51820/udp"]', envVars: '[{"key":"PEERS","value":"3"},{"key":"SERVERURL","value":"auto"}]', volumes: '["wireguard_config:/config"]' },
  { name: "Vaultwarden", description: "Servidor Bitwarden leve self-hosted", category: "security", icon: `${I}/vaultwarden.png`, image: "vaultwarden/server:latest", ports: '["80:80"]', volumes: '["vaultwarden_data:/data"]', featured: true },
  { name: "Mailhog", description: "Servidor SMTP de testes com interface web", category: "communication", icon: `${I}/mailhog.png`, image: "mailhog/mailhog:latest", ports: '["1025:1025","8025:8025"]' },
  { name: "Mailu", description: "Servidor de email completo com webmail", category: "communication", icon: `${I}/mailu.png`, image: "mailu/admin:latest", ports: '["25:25","465:465","587:587","143:143","993:993","80:80","443:443"]' },
  { name: "Rocket.Chat", description: "Plataforma de comunicação de equipes", category: "communication", icon: `${I}/rocket-chat.png`, image: "rocket.chat:latest", ports: '["3000:3000"]', volumes: '["rocketchat_uploads:/app/uploads"]', envVars: '[{"key":"MONGO_URL","value":"mongodb://mongo:27017/rocketchat"}]' },
  { name: "Matrix Synapse", description: "Servidor de comunicação descentralizada", category: "communication", icon: `${I}/matrix.png`, image: "matrixdotorg/synapse:latest", ports: '["8008:8008"]', volumes: '["synapse_data:/data"]' },
  { name: "Zulip", description: "Chat de equipe com organização por tópicos", category: "communication", icon: `${I}/zulip.png`, image: "zulip/docker-zulip:latest", ports: '["80:80","443:443"]', volumes: '["zulip_data:/data"]' },
  { name: "Drone Runner", description: "Runner Docker para Drone CI", category: "devops", icon: `${I}/drone.png`, image: "drone/drone-runner-docker:latest", ports: '["3000:3000"]', envVars: '[{"key":"DRONE_RPC_HOST","value":"drone-server"},{"key":"DRONE_RPC_SECRET","value":"changeme"}]', volumes: '["/var/run/docker.sock:/var/run/docker.sock"]' },
  { name: "Registry", description: "Registry Docker privado", category: "devops", icon: `${I}/docker.png`, image: "registry:2", ports: '["5000:5000"]', volumes: '["registry_data:/var/lib/registry"]' },
  { name: "Nexus", description: "Gerenciador de repositórios de artefatos", category: "devops", icon: `${I}/nexus.png`, image: "sonatype/nexus3:latest", ports: '["8081:8081"]', volumes: '["nexus_data:/nexus-data"]' },
  { name: "Ansible AWX", description: "Interface web para Ansible", category: "devops", icon: `${I}/ansible.png`, image: "ansible/awx:latest", ports: '["80:80"]' },
  { name: "Consul", description: "Service mesh e service discovery da HashiCorp", category: "devops", icon: `${I}/consul.png`, image: "hashicorp/consul:latest", ports: '["8500:8500","8600:8600"]', volumes: '["consul_data:/consul/data"]' },
  { name: "Nomad", description: "Orquestrador de workloads da HashiCorp", category: "devops", icon: `${I}/nomad.png`, image: "hashicorp/nomad:latest", ports: '["4646:4646","4647:4647"]', volumes: '["nomad_data:/nomad/data"]' },
  { name: "Outline", description: "Wiki e base de conhecimento de equipe", category: "cms", icon: `${I}/outline.png`, image: "outlinewiki/outline:latest", ports: '["3000:3000"]', envVars: '[{"key":"SECRET_KEY","value":"changeme"},{"key":"DATABASE_URL","value":"postgresql://user:pass@db:5432/outline"}]' },
  { name: "BookStack", description: "Plataforma de documentação e wiki", category: "cms", icon: `${I}/bookstack.png`, image: "linuxserver/bookstack:latest", ports: '["6875:80"]', envVars: '[{"key":"DB_HOST","value":"db"},{"key":"DB_DATABASE","value":"bookstack"},{"key":"DB_USERNAME","value":"user"},{"key":"DB_PASSWORD","value":"changeme"}]', volumes: '["bookstack_data:/config"]' },
  { name: "Wiki.js", description: "Wiki moderna e poderosa com Node.js", category: "cms", icon: `${I}/wikijs.png`, image: "requarks/wiki:latest", ports: '["3000:3000"]', envVars: '[{"key":"DB_TYPE","value":"postgres"},{"key":"DB_HOST","value":"db"},{"key":"DB_PORT","value":"5432"},{"key":"DB_NAME","value":"wiki"},{"key":"DB_USER","value":"user"},{"key":"DB_PASS","value":"changeme"}]', featured: true },
  { name: "Plausible", description: "Analytics web privacy-friendly", category: "monitoring", icon: `${I}/plausible.png`, image: "plausible/analytics:latest", ports: '["8000:8000"]', envVars: '[{"key":"BASE_URL","value":"http://localhost:8000"},{"key":"SECRET_KEY_BASE","value":"changeme"}]' },
  { name: "Umami", description: "Analytics web simples e privacy-focused", category: "monitoring", icon: `${I}/umami.png`, image: "ghcr.io/umami-software/umami:postgresql-latest", ports: '["3000:3000"]', envVars: '[{"key":"DATABASE_URL","value":"postgresql://user:pass@db:5432/umami"}]' },
  { name: "Seq", description: "Servidor de logs estruturados", category: "monitoring", icon: `${I}/seq.png`, image: "datalust/seq:latest", ports: '["5341:5341","80:80"]', envVars: '[{"key":"ACCEPT_EULA","value":"Y"}]', volumes: '["seq_data:/data"]' },
  { name: "Netdata", description: "Monitoramento de infraestrutura em tempo real", category: "monitoring", icon: `${I}/netdata.png`, image: "netdata/netdata:latest", ports: '["19999:19999"]', volumes: '["/proc:/host/proc:ro","/sys:/host/sys:ro","/var/run/docker.sock:/var/run/docker.sock:ro"]' },
  { name: "Homer", description: "Dashboard de serviços self-hosted", category: "web", icon: `${I}/homer.png`, image: "b4bz/homer:latest", ports: '["8080:8080"]', volumes: '["homer_assets:/www/assets"]' },
  { name: "Heimdall", description: "Dashboard de aplicações elegante", category: "web", icon: `${I}/heimdall.png`, image: "linuxserver/heimdall:latest", ports: '["80:80","443:443"]', volumes: '["heimdall_config:/config"]' },
  { name: "Dashy", description: "Dashboard pessoal altamente customizável", category: "web", icon: `${I}/dashy.png`, image: "lissy93/dashy:latest", ports: '["8080:8080"]', volumes: '["dashy_config:/app/user-data"]' },
  { name: "Filebrowser", description: "Gerenciador de arquivos web", category: "storage", icon: `${I}/filebrowser.png`, image: "filebrowser/filebrowser:latest", ports: '["8080:80"]', volumes: '["filebrowser_data:/srv","filebrowser_db:/database"]' },
  { name: "Seafile", description: "Plataforma de sincronização de arquivos", category: "storage", icon: `${I}/seafile.png`, image: "seafileltd/seafile-mc:latest", ports: '["80:80","443:443"]', volumes: '["seafile_data:/shared"]' },
  { name: "PhotoPrism", description: "Gerenciador de fotos com IA", category: "storage", icon: `${I}/photoprism.png`, image: "photoprism/photoprism:latest", ports: '["2342:2342"]', envVars: '[{"key":"PHOTOPRISM_ADMIN_PASSWORD","value":"changeme"},{"key":"PHOTOPRISM_SITE_URL","value":"http://localhost:2342/"}]', volumes: '["photoprism_storage:/photoprism/storage"]' },
  { name: "Immich", description: "Alternativa self-hosted ao Google Photos", category: "storage", icon: `${I}/immich.png`, image: "ghcr.io/immich-app/immich-server:latest", ports: '["2283:3001"]', volumes: '["immich_upload:/usr/src/app/upload"]', featured: true },
  { name: "Duplicati", description: "Backup na nuvem criptografado", category: "storage", icon: `${I}/duplicati.png`, image: "linuxserver/duplicati:latest", ports: '["8200:8200"]', volumes: '["duplicati_config:/config","duplicati_backups:/backups"]' },
  { name: "Pocketbase", description: "Backend em um único arquivo com dashboard", category: "database", icon: `${I}/pocketbase.png`, image: "ghcr.io/muchobien/pocketbase:latest", ports: '["8090:8090"]', volumes: '["pocketbase_data:/pb_data"]', featured: true },
  { name: "Meilisearch", description: "Motor de busca ultra-rápido e fácil de usar", category: "database", icon: `${I}/meilisearch.png`, image: "getmeili/meilisearch:latest", ports: '["7700:7700"]', envVars: '[{"key":"MEILI_MASTER_KEY","value":"changeme"}]', volumes: '["meilisearch_data:/meili_data"]' },
  { name: "Typesense", description: "Motor de busca tolerante a erros de digitação", category: "database", icon: `${I}/typesense.png`, image: "typesense/typesense:latest", ports: '["8108:8108"]', envVars: '[{"key":"TYPESENSE_API_KEY","value":"changeme"}]', volumes: '["typesense_data:/data"]' },
  { name: "SurrealDB", description: "Banco de dados multi-modelo cloud-native", category: "database", icon: `${I}/surrealdb.png`, image: "surrealdb/surrealdb:latest", ports: '["8000:8000"]', volumes: '["surrealdb_data:/data"]' },
  { name: "Valkey", description: "Fork open-source do Redis", category: "cache", icon: `${I}/valkey.png`, image: "valkey/valkey:latest", ports: '["6379:6379"]', volumes: '["valkey_data:/data"]' },
  { name: "KeyDB", description: "Redis fork multi-threaded de alta performance", category: "cache", icon: `${I}/keydb.png`, image: "eqalpha/keydb:latest", ports: '["6379:6379"]', volumes: '["keydb_data:/data"]' },
  { name: "Memcached", description: "Sistema de cache em memória distribuído", category: "cache", icon: `${I}/memcached.png`, image: "memcached:alpine", ports: '["11211:11211"]' },
  { name: "Paperless-ngx", description: "Sistema de gerenciamento de documentos", category: "storage", icon: `${I}/paperless-ngx.png`, image: "ghcr.io/paperless-ngx/paperless-ngx:latest", ports: '["8000:8000"]', envVars: '[{"key":"PAPERLESS_SECRET_KEY","value":"changeme"}]', volumes: '["paperless_data:/usr/src/paperless/data","paperless_media:/usr/src/paperless/media"]', featured: true },
  { name: "Syncthing", description: "Sincronização de arquivos P2P contínua", category: "storage", icon: `${I}/syncthing.png`, image: "syncthing/syncthing:latest", ports: '["8384:8384","22000:22000"]', volumes: '["syncthing_data:/var/syncthing"]' },
  { name: "Restic Server", description: "Servidor REST para backups Restic", category: "storage", icon: `${I}/restic.png`, image: "restic/rest-server:latest", ports: '["8000:8000"]', volumes: '["restic_data:/data"]' },
  { name: "Jellyfin", description: "Servidor de mídia open-source", category: "storage", icon: `${I}/jellyfin.png`, image: "jellyfin/jellyfin:latest", ports: '["8096:8096"]', volumes: '["jellyfin_config:/config","jellyfin_cache:/cache"]', featured: true },
  { name: "Plex", description: "Servidor de mídia com streaming", category: "storage", icon: `${I}/plex.png`, image: "plexinc/pms-docker:latest", ports: '["32400:32400"]', volumes: '["plex_config:/config","plex_data:/data"]' },
  { name: "Navidrome", description: "Servidor de música pessoal com streaming", category: "storage", icon: `${I}/navidrome.png`, image: "deluan/navidrome:latest", ports: '["4533:4533"]', volumes: '["navidrome_data:/data","navidrome_music:/music"]' },
  { name: "Overseerr", description: "Gerenciador de solicitações de mídia", category: "storage", icon: `${I}/overseerr.png`, image: "linuxserver/overseerr:latest", ports: '["5055:5055"]', volumes: '["overseerr_config:/config"]' },
  { name: "Linkwarden", description: "Gerenciador de bookmarks colaborativo", category: "web", icon: `${I}/linkwarden.png`, image: "ghcr.io/linkwarden/linkwarden:latest", ports: '["3000:3000"]', envVars: '[{"key":"DATABASE_URL","value":"postgresql://user:pass@db:5432/linkwarden"},{"key":"NEXTAUTH_SECRET","value":"changeme"}]' },
  { name: "Wallabag", description: "Aplicação read-it-later self-hosted", category: "web", icon: `${I}/wallabag.png`, image: "wallabag/wallabag:latest", ports: '["80:80"]', volumes: '["wallabag_data:/var/www/wallabag/data"]' },
  { name: "Miniflux", description: "Leitor RSS minimalista e rápido", category: "web", icon: `${I}/miniflux.png`, image: "miniflux/miniflux:latest", ports: '["8080:8080"]', envVars: '[{"key":"DATABASE_URL","value":"postgres://user:pass@db/miniflux?sslmode=disable"},{"key":"CREATE_ADMIN","value":"1"},{"key":"ADMIN_USERNAME","value":"admin"},{"key":"ADMIN_PASSWORD","value":"changeme"}]' },
  { name: "FreshRSS", description: "Agregador RSS self-hosted com interface moderna", category: "web", icon: `${I}/freshrss.png`, image: "freshrss/freshrss:latest", ports: '["8080:80"]', volumes: '["freshrss_data:/var/www/FreshRSS/data"]' },
  { name: "Stirling PDF", description: "Ferramenta completa de manipulação de PDF", category: "web", icon: `${I}/stirling-pdf.png`, image: "frooodle/s-pdf:latest", ports: '["8080:8080"]', featured: true },
  { name: "IT Tools", description: "Coleção de ferramentas úteis para desenvolvedores", category: "web", icon: `${I}/it-tools.png`, image: "corentinth/it-tools:latest", ports: '["8080:80"]' },
  { name: "CyberChef", description: "Canivete suíço de operações com dados", category: "web", icon: `${I}/cyberchef.png`, image: "ghcr.io/gchq/cyberchef:latest", ports: '["8000:8000"]' },
  { name: "Excalidraw", description: "Quadro branco virtual para diagramas", category: "web", icon: `${I}/excalidraw.png`, image: "excalidraw/excalidraw:latest", ports: '["80:80"]' },
  { name: "Draw.io", description: "Editor de diagramas e fluxogramas", category: "web", icon: `${I}/drawio.png`, image: "jgraph/drawio:latest", ports: '["8080:8080","8443:8443"]' },
  { name: "Code Server", description: "VS Code no navegador", category: "devops", icon: `${I}/code-server.png`, image: "codercom/code-server:latest", ports: '["8080:8080"]', envVars: '[{"key":"PASSWORD","value":"changeme"}]', volumes: '["codeserver_data:/home/coder"]', featured: true },
  { name: "Gitness", description: "Plataforma de código open-source da Harness", category: "devops", icon: `${I}/gitness.png`, image: "harness/gitness:latest", ports: '["3000:3000"]', volumes: '["gitness_data:/data"]' },
  { name: "Forgejo", description: "Servidor Git community-driven fork do Gitea", category: "devops", icon: `${I}/forgejo.png`, image: "codeberg.org/forgejo/forgejo:latest", ports: '["3000:3000","2222:22"]', volumes: '["forgejo_data:/data"]' },
  { name: "Argo CD", description: "GitOps para Kubernetes", category: "devops", icon: `${I}/argocd.png`, image: "quay.io/argoproj/argocd:latest", ports: '["8080:8080"]' },
  { name: "Harbor", description: "Registry de containers enterprise", category: "devops", icon: `${I}/harbor.png`, image: "goharbor/harbor-core:latest", ports: '["80:8080"]' },
  { name: "Semaphore", description: "Interface web moderna para Ansible", category: "devops", icon: `${I}/semaphore.png`, image: "semaphoreui/semaphore:latest", ports: '["3000:3000"]', envVars: '[{"key":"SEMAPHORE_DB_DIALECT","value":"bolt"},{"key":"SEMAPHORE_ADMIN_PASSWORD","value":"changeme"},{"key":"SEMAPHORE_ADMIN","value":"admin"},{"key":"SEMAPHORE_ADMIN_EMAIL","value":"admin@localhost"}]' },
  { name: "Zammad", description: "Sistema de helpdesk e ticketing", category: "communication", icon: `${I}/zammad.png`, image: "zammad/zammad-docker-compose:latest", ports: '["8080:8080"]' },
  { name: "Ntfy", description: "Servidor de notificações push via HTTP", category: "communication", icon: `${I}/ntfy.png`, image: "binwiederhier/ntfy:latest", ports: '["80:80"]', volumes: '["ntfy_cache:/var/cache/ntfy","ntfy_etc:/etc/ntfy"]' },
  { name: "Gotify", description: "Servidor de notificações push simples", category: "communication", icon: `${I}/gotify.png`, image: "gotify/server:latest", ports: '["80:80"]', volumes: '["gotify_data:/app/data"]' },
  { name: "Apprise", description: "API unificada de notificações multi-plataforma", category: "communication", icon: `${I}/apprise.png`, image: "caronc/apprise:latest", ports: '["8000:8000"]' },
  { name: "Listmonk", description: "Newsletter e mailing list self-hosted", category: "communication", icon: `${I}/listmonk.png`, image: "listmonk/listmonk:latest", ports: '["9000:9000"]', envVars: '[{"key":"LISTMONK_DB_HOST","value":"db"},{"key":"LISTMONK_DB_PORT","value":"5432"},{"key":"LISTMONK_DB_NAME","value":"listmonk"},{"key":"LISTMONK_DB_USER","value":"user"},{"key":"LISTMONK_DB_PASSWORD","value":"changeme"}]' },
  { name: "Uptime Robot", description: "Monitoramento de sites com alertas", category: "monitoring", icon: `${I}/uptime-kuma.png`, image: "louislam/uptime-kuma:latest", ports: '["3001:3001"]', volumes: '["uptimerobot_data:/app/data"]' },
  { name: "Graylog", description: "Gerenciamento de logs centralizado enterprise", category: "monitoring", icon: `${I}/graylog.png`, image: "graylog/graylog:latest", ports: '["9000:9000","12201:12201","1514:1514"]', envVars: '[{"key":"GRAYLOG_PASSWORD_SECRET","value":"changemechangemechangeme"},{"key":"GRAYLOG_ROOT_PASSWORD_SHA2","value":"8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"}]' },
  { name: "Zabbix", description: "Plataforma de monitoramento enterprise", category: "monitoring", icon: `${I}/zabbix.png`, image: "zabbix/zabbix-web-nginx-mysql:latest", ports: '["8080:8080"]', envVars: '[{"key":"DB_SERVER_HOST","value":"db"},{"key":"MYSQL_USER","value":"zabbix"},{"key":"MYSQL_PASSWORD","value":"changeme"}]' },
  { name: "Checkmk", description: "Monitoramento de infraestrutura IT", category: "monitoring", icon: `${I}/checkmk.png`, image: "checkmk/check-mk-raw:latest", ports: '["8080:5000"]', volumes: '["checkmk_data:/omd/sites"]' },
  { name: "Beszel", description: "Hub de monitoramento de servidores leve", category: "monitoring", icon: `${I}/beszel.png`, image: "henrygd/beszel:latest", ports: '["8090:8090"]', volumes: '["beszel_data:/beszel_data"]' },
  { name: "Actual Budget", description: "App de finanças pessoais e orçamento", category: "automation", icon: `${I}/actual.png`, image: "actualbudget/actual-server:latest", ports: '["5006:5006"]', volumes: '["actual_data:/data"]' },
  { name: "Firefly III", description: "Gerenciador de finanças pessoais", category: "automation", icon: `${I}/firefly-iii.png`, image: "fireflyiii/core:latest", ports: '["8080:8080"]', envVars: '[{"key":"APP_KEY","value":"changeme32characterslongkeyhere!!"},{"key":"DB_CONNECTION","value":"pgsql"},{"key":"DB_HOST","value":"db"},{"key":"DB_DATABASE","value":"firefly"},{"key":"DB_USERNAME","value":"user"},{"key":"DB_PASSWORD","value":"changeme"}]', volumes: '["firefly_upload:/var/www/html/storage/upload"]' },
  { name: "Vikunja", description: "App de gerenciamento de tarefas e to-do", category: "automation", icon: `${I}/vikunja.png`, image: "vikunja/vikunja:latest", ports: '["3456:3456"]', volumes: '["vikunja_files:/app/vikunja/files"]' },
  { name: "Plane", description: "Gerenciamento de projetos open-source (alt. Jira)", category: "automation", icon: `${I}/plane.png`, image: "makeplane/plane-frontend:latest", ports: '["3000:3000"]', featured: true },
  { name: "Focalboard", description: "Gerenciamento de projetos estilo Trello/Notion", category: "automation", icon: `${I}/focalboard.png`, image: "mattermost/focalboard:latest", ports: '["8000:8000"]', volumes: '["focalboard_data:/opt/focalboard/data"]' },
  { name: "Trilium", description: "Base de conhecimento pessoal hierárquica", category: "cms", icon: `${I}/trilium.png`, image: "zadam/trilium:latest", ports: '["8080:8080"]', volumes: '["trilium_data:/home/node/trilium-data"]' },
  { name: "HedgeDoc", description: "Editor de markdown colaborativo em tempo real", category: "cms", icon: `${I}/hedgedoc.png`, image: "quay.io/hedgedoc/hedgedoc:latest", ports: '["3000:3000"]', envVars: '[{"key":"CMD_DB_URL","value":"postgres://user:pass@db:5432/hedgedoc"}]', volumes: '["hedgedoc_uploads:/hedgedoc/public/uploads"]' },
  { name: "Docuseal", description: "Assinatura digital de documentos", category: "automation", icon: `${I}/docuseal.png`, image: "docuseal/docuseal:latest", ports: '["3000:3000"]', volumes: '["docuseal_data:/data"]' },
  { name: "Weblate", description: "Plataforma de tradução e localização", category: "devops", icon: `${I}/weblate.png`, image: "weblate/weblate:latest", ports: '["8080:8080"]', volumes: '["weblate_data:/app/data"]' },
  { name: "Crowdin", description: "Gerenciamento de traduções e localização", category: "devops", icon: `${I}/crowdin.png`, image: "crowdin/crowdin-cli:latest", ports: '["8080:8080"]' },
  { name: "OpenProject", description: "Gerenciamento de projetos enterprise", category: "automation", icon: `${I}/openproject.png`, image: "openproject/openproject:latest", ports: '["8080:80"]', volumes: '["openproject_data:/var/openproject/assets"]', envVars: '[{"key":"OPENPROJECT_SECRET_KEY_BASE","value":"changeme"}]' },
];

async function initTemplates() {
  for (const t of defaultTemplates) {
    const exists = await prisma.appTemplate.findFirst({ where: { name: t.name } });
    if (!exists) {
      await prisma.appTemplate.create({ data: t });
    } else if (exists.icon !== t.icon) {
      await prisma.appTemplate.update({ where: { id: exists.id }, data: { icon: t.icon } });
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
