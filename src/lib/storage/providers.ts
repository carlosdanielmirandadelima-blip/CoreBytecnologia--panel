/**
 * Catálogo de provedores de armazenamento em nuvem suportados pelo CoreByte.
 *
 * Cada serviço famoso é uma entrada própria na interface, mas vários deles
 * compartilham o mesmo adaptador internamente (ex.: todos os S3-compatíveis
 * usam o adaptador "s3" com endpoint diferente).
 */

export type StorageType =
  | "s3"
  | "google_drive"
  | "onedrive"
  | "dropbox"
  | "box"
  | "pcloud"
  | "mega"
  | "terabox"
  | "webdav"
  | "ftp"
  | "sftp";

export type AuthType = "credentials" | "oauth" | "service_account";

export interface StorageField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "number" | "select" | "textarea" | "switch";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  default?: string;
}

export interface StorageProviderDef {
  /** Identificador do catálogo (o que aparece para o usuário). */
  id: string;
  /** Adaptador interno que executa o upload. */
  type: StorageType;
  name: string;
  group: "s3" | "oauth" | "key" | "file";
  /** Slug no simple-icons; vazio usa ícone neutro. */
  logo: string;
  logoColor?: string;
  authType: AuthType;
  fields: StorageField[];
  defaults?: Record<string, string>;
  /** URLs de autorização, quando aplicável. */
  oauth?: { authorizeUrl: string; tokenUrl: string; scope: string };
  help?: string;
  /** Aviso exibido no formulário (ex.: limitações conhecidas). */
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Campos reutilizados                                                 */
/* ------------------------------------------------------------------ */

const F = {
  accessKeyId: {
    key: "accessKeyId",
    label: "Access Key ID",
    type: "text" as const,
    required: true,
    placeholder: "AKIA...",
  },
  secretAccessKey: {
    key: "secretAccessKey",
    label: "Secret Access Key",
    type: "password" as const,
    required: true,
    placeholder: "••••••••",
  },
  bucket: {
    key: "bucket",
    label: "Bucket",
    type: "text" as const,
    required: true,
    placeholder: "meus-backups",
  },
  region: {
    key: "region",
    label: "Região",
    type: "text" as const,
    placeholder: "us-east-1",
    default: "us-east-1",
  },
  endpoint: {
    key: "endpoint",
    label: "Endpoint (URL do serviço)",
    type: "url" as const,
    required: true,
    placeholder: "https://s3.exemplo.com",
  },
  forcePathStyle: {
    key: "forcePathStyle",
    label: "Usar path-style",
    type: "switch" as const,
    help: "Necessário para MinIO, R2, Backblaze e a maioria dos serviços não-AWS.",
    default: "true",
  },
  prefix: {
    key: "prefix",
    label: "Pasta remota (opcional)",
    type: "text" as const,
    placeholder: "corebyte-backups",
  },
  accountId: {
    key: "accountId",
    label: "Account ID",
    type: "text" as const,
    required: true,
    placeholder: "a1b2c3d4e5f6",
  },
} satisfies Record<string, StorageField>;

/* ------------------------------------------------------------------ */
/* Serviços compatíveis com S3                                         */
/* ------------------------------------------------------------------ */

const s3Family: StorageProviderDef[] = [
  {
    id: "amazon-s3",
    type: "s3",
    name: "Amazon S3",
    group: "s3",
    logo: "amazons3",
    logoColor: "569A31",
    authType: "credentials",
    fields: [F.accessKeyId, F.secretAccessKey, F.bucket, F.region, F.prefix],
  },
  {
    id: "cloudflare-r2",
    type: "s3",
    name: "Cloudflare R2",
    group: "s3",
    logo: "cloudflare",
    logoColor: "F38020",
    authType: "credentials",
    fields: [
      F.accountId,
      {
        key: "endpoint",
        label: "Endpoint",
        type: "url",
        required: true,
        placeholder: "https://<accountid>.r2.cloudflarestorage.com",
        help: "Use https://<seu-account-id>.r2.cloudflarestorage.com",
      },
      F.accessKeyId,
      F.secretAccessKey,
      F.bucket,
      F.prefix,
    ],
    defaults: { forcePathStyle: "false", region: "auto" },
  },
  {
    id: "backblaze-b2",
    type: "s3",
    name: "Backblaze B2",
    group: "s3",
    logo: "backblaze",
    logoColor: "E21E29",
    authType: "credentials",
    fields: [
      {
        key: "endpoint",
        label: "Endpoint S3",
        type: "url",
        required: true,
        placeholder: "https://s3.us-west-004.backblazeb2.com",
        help: "Encontre em Bucket → Endpoint na aba de detalhes do bucket.",
      },
      F.accessKeyId,
      F.secretAccessKey,
      F.bucket,
      F.region,
      F.prefix,
    ],
    defaults: { forcePathStyle: "true" },
  },
  {
    id: "wasabi",
    type: "s3",
    name: "Wasabi",
    group: "s3",
    logo: "wasabi",
    logoColor: "00C389",
    authType: "credentials",
    fields: [
      {
        key: "endpoint",
        label: "Endpoint",
        type: "url",
        required: true,
        placeholder: "https://s3.us-east-1.wasabisys.com",
      },
      F.accessKeyId,
      F.secretAccessKey,
      F.bucket,
      F.region,
      F.prefix,
    ],
    defaults: { forcePathStyle: "true" },
  },
  {
    id: "minio",
    type: "s3",
    name: "MinIO (servidor próprio)",
    group: "s3",
    logo: "minio",
    logoColor: "C72C48",
    authType: "credentials",
    fields: [
      {
        key: "endpoint",
        label: "Endpoint",
        type: "url",
        required: true,
        placeholder: "https://minio.seudominio.com",
      },
      F.accessKeyId,
      F.secretAccessKey,
      F.bucket,
      F.region,
      F.prefix,
    ],
    defaults: { forcePathStyle: "true" },
  },
  {
    id: "digitalocean-spaces",
    type: "s3",
    name: "DigitalOcean Spaces",
    group: "s3",
    logo: "digitalocean",
    logoColor: "0080FF",
    authType: "credentials",
    fields: [
      F.region,
      F.accessKeyId,
      F.secretAccessKey,
      F.bucket,
      F.prefix,
    ],
    defaults: { forcePathStyle: "true", endpointTemplate: "https://{region}.digitaloceanspaces.com" },
    help: "O endpoint é montado como https://<região>.digitaloceanspaces.com",
  },
  {
    id: "linode-object-storage",
    type: "s3",
    name: "Akamai / Linode Object Storage",
    group: "s3",
    logo: "akamai",
    logoColor: "009CDF",
    authType: "credentials",
    fields: [F.region, F.accessKeyId, F.secretAccessKey, F.bucket, F.prefix],
    defaults: { forcePathStyle: "true", endpointTemplate: "https://{region}.linodeobjects.com" },
  },
  {
    id: "scaleway",
    type: "s3",
    name: "Scaleway Object Storage",
    group: "s3",
    logo: "scaleway",
    logoColor: "4F0599",
    authType: "credentials",
    fields: [F.region, F.accessKeyId, F.secretAccessKey, F.bucket, F.prefix],
    defaults: { forcePathStyle: "true", endpointTemplate: "https://s3.{region}.scw.cloud" },
  },
  {
    id: "idrive-e2",
    type: "s3",
    name: "IDrive e2",
    group: "s3",
    logo: "idrive",
    logoColor: "1D74C4",
    authType: "credentials",
    fields: [
      {
        key: "endpoint",
        label: "Endpoint",
        type: "url",
        required: true,
        placeholder: "https://f0k1.us-east-1.idrivee2.com",
      },
      F.accessKeyId,
      F.secretAccessKey,
      F.bucket,
      F.prefix,
    ],
    defaults: { forcePathStyle: "true", region: "us-east-1" },
  },
  {
    id: "storj",
    type: "s3",
    name: "Storj DCS",
    group: "s3",
    logo: "storj",
    logoColor: "2683FF",
    authType: "credentials",
    fields: [
      {
        key: "endpoint",
        label: "Endpoint S3",
        type: "url",
        required: true,
        placeholder: "https://gateway.storjshare.io",
      },
      F.accessKeyId,
      F.secretAccessKey,
      F.bucket,
      F.prefix,
    ],
    defaults: { forcePathStyle: "true", region: "us1" },
  },
  {
    id: "s3-compatible",
    type: "s3",
    name: "Outro S3-compatível",
    group: "s3",
    logo: "",
    authType: "credentials",
    fields: [F.endpoint, F.accessKeyId, F.secretAccessKey, F.bucket, F.region, F.forcePathStyle, F.prefix],
    help: "Use para qualquer serviço que fale o protocolo S3 (Ceph, Garage, SeaweedFS, Oracle, IBM, Oracle OCI…).",
  },
];

/* ------------------------------------------------------------------ */
/* Serviços com OAuth / service account                                */
/* ------------------------------------------------------------------ */

const oauthFamily: StorageProviderDef[] = [
  {
    id: "google-drive",
    type: "google_drive",
    name: "Google Drive",
    group: "oauth",
    logo: "googledrive",
    logoColor: "4285F4",
    authType: "oauth",
    oauth: {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/drive.file",
    },
    fields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "xxxxx.apps.googleusercontent.com" },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "GOCSPX-..." },
      { key: "refreshToken", label: "Refresh Token", type: "textarea", placeholder: "1//0g...", help: "Use o botão “Conectar com Google” ou cole um refresh token já gerado." },
      { key: "folderId", label: "ID da pasta (opcional)", type: "text", placeholder: "1AbCdEf...", help: "Se vazio, envia para a raiz do Drive." },
    ],
    help: "Crie um app OAuth no Google Cloud Console e habilite a Drive API. Para servidores, o modo service account abaixo costuma ser mais simples.",
  },
  {
    id: "google-drive-service-account",
    type: "google_drive",
    name: "Google Drive (Service Account)",
    group: "oauth",
    logo: "googlecloud",
    logoColor: "4285F4",
    authType: "service_account",
    fields: [
      {
        key: "serviceAccountJson",
        label: "JSON da service account",
        type: "textarea",
        required: true,
        placeholder: '{ "type": "service_account", "project_id": "...", ... }',
        help: "Cole o conteúdo do arquivo JSON. Não exige OAuth nem refresh token.",
      },
      { key: "folderId", label: "ID da pasta do Drive (opcional)", type: "text", help: "Compartilhe esta pasta com o e-mail da service account." },
    ],
    note: "A service account tem cota própria. Compartilhe a pasta destino com o e-mail dela.",
  },
  {
    id: "onedrive",
    type: "onedrive",
    name: "Microsoft OneDrive",
    group: "oauth",
    logo: "microsoftonedrive",
    logoColor: "0078D4",
    authType: "oauth",
    oauth: {
      authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      scope: "offline_access Files.ReadWrite.All",
    },
    fields: [
      { key: "clientId", label: "Client ID (Application ID)", type: "text", placeholder: "00000000-0000-..." },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••" },
      { key: "refreshToken", label: "Refresh Token", type: "textarea", help: "Gerado pelo botão “Conectar com Microsoft”." },
      { key: "folder", label: "Pasta remota", type: "text", default: "/CoreByte-Backups" },
    ],
    help: "Registre um app no Entra ID (Azure AD) com permissões delegadas Files.ReadWrite.All.",
  },
  {
    id: "dropbox",
    type: "dropbox",
    name: "Dropbox",
    group: "oauth",
    logo: "dropbox",
    logoColor: "0061FF",
    authType: "oauth",
    oauth: {
      authorizeUrl: "https://www.dropbox.com/oauth2/authorize",
      tokenUrl: "https://api.dropboxapi.com/oauth2/token",
      scope: "files.content.write files.content.read",
    },
    fields: [
      { key: "appKey", label: "App Key", type: "text", placeholder: "abc123..." },
      { key: "appSecret", label: "App Secret", type: "password" },
      { key: "refreshToken", label: "Refresh Token", type: "textarea", help: "Gerado pelo botão “Conectar com Dropbox”." },
      { key: "folder", label: "Pasta remota", type: "text", default: "/CoreByte-Backups" },
    ],
    help: "Use o fluxo com refresh token (recomendado). Aceita também um access token de curta duração.",
  },
  {
    id: "box",
    type: "box",
    name: "Box",
    group: "oauth",
    logo: "box",
    logoColor: "0061D5",
    authType: "oauth",
    oauth: {
      authorizeUrl: "https://account.box.com/api/oauth2/authorize",
      tokenUrl: "https://api.box.com/oauth2/token",
      scope: "root_readwrite",
    },
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
      { key: "refreshToken", label: "Refresh Token", type: "textarea" },
      { key: "folderId", label: "ID da pasta (opcional)", type: "text", placeholder: "0", help: "0 = pasta raiz." },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Serviços com chave/token                                            */
/* ------------------------------------------------------------------ */

const keyFamily: StorageProviderDef[] = [
  {
    id: "pcloud",
    type: "pcloud",
    name: "pCloud",
    group: "key",
    logo: "pcloud",
    logoColor: "1EB2FF",
    authType: "credentials",
    fields: [
      { key: "authToken", label: "Auth Token", type: "password", required: true, help: "Gere em pCloud → Configurações → API." },
      { key: "region", label: "Servidor", type: "select", options: [{ value: "api.pcloud.com", label: "Estados Unidos" }, { value: "eapi.pcloud.com", label: "Europa" }], default: "api.pcloud.com" },
      { key: "folder", label: "Pasta remota", type: "text", default: "/CoreByte-Backups" },
    ],
  },
  {
    id: "mega",
    type: "mega",
    name: "MEGA",
    group: "key",
    logo: "mega",
    logoColor: "D9272E",
    authType: "credentials",
    fields: [
      { key: "email", label: "E-mail da conta", type: "text", required: true },
      { key: "password", label: "Senha da conta", type: "password", required: true, help: "A senha nunca é exibida de volta. Recomendado criar uma conta dedicada." },
      { key: "folder", label: "Pasta remota", type: "text", default: "/CoreByte-Backups" },
    ],
    note: "Contas MEGA gratuitas têm cota de transferência. Contas com 2FA não são suportadas.",
  },
  {
    id: "terabox",
    type: "terabox",
    name: "TeraBox",
    group: "key",
    logo: "terabox",
    logoColor: "0F86FF",
    authType: "credentials",
    fields: [
      { key: "cookie", label: "Cookie / Token de sessão", type: "textarea", required: true, help: "Copie o cookie de sessão (ndus) do navegador logado no TeraBox." },
      { key: "folder", label: "Pasta remota", type: "text", default: "/CoreByte-Backups" },
    ],
    note: "O TeraBox não possui API pública estável; usa-se o mesmo endpoint web. Pode parar de funcionar sem aviso.",
  },
];

/* ------------------------------------------------------------------ */
/* Protocolos de arquivo                                               */
/* ------------------------------------------------------------------ */

const fileFamily: StorageProviderDef[] = [
  {
    id: "webdav-nextcloud",
    type: "webdav",
    name: "Nextcloud / ownCloud",
    group: "file",
    logo: "nextcloud",
    logoColor: "0082C9",
    authType: "credentials",
    fields: [
      { key: "url", label: "URL do WebDAV", type: "url", required: true, placeholder: "https://cloud.seudominio.com/remote.php/dav/files/usuario" },
      { key: "username", label: "Usuário", type: "text", required: true },
      { key: "password", label: "Senha de app", type: "password", required: true },
      { key: "folder", label: "Pasta remota", type: "text", default: "/CoreByte-Backups" },
    ],
  },
  {
    id: "webdav",
    type: "webdav",
    name: "WebDAV (genérico)",
    group: "file",
    logo: "webdav",
    authType: "credentials",
    fields: [
      { key: "url", label: "URL do WebDAV", type: "url", required: true, placeholder: "https://servidor/dav" },
      { key: "username", label: "Usuário", type: "text" },
      { key: "password", label: "Senha", type: "password" },
      { key: "folder", label: "Pasta remota", type: "text", default: "/CoreByte-Backups" },
    ],
  },
  {
    id: "ftp",
    type: "ftp",
    name: "FTP / FTPS",
    group: "file",
    logo: "",
    authType: "credentials",
    fields: [
      { key: "host", label: "Host", type: "text", required: true, placeholder: "ftp.seudominio.com" },
      { key: "port", label: "Porta", type: "number", default: "21" },
      {
        key: "secure",
        label: "Usar FTPS (TLS)",
        type: "switch",
        default: "true",
        help: "Desative apenas se o servidor não suportar TLS.",
      },
      { key: "username", label: "Usuário", type: "text", required: true },
      { key: "password", label: "Senha", type: "password", required: true },
      { key: "folder", label: "Pasta remota", type: "text", default: "/CoreByte-Backups" },
    ],
  },
  {
    id: "sftp",
    type: "sftp",
    name: "SFTP (SSH)",
    group: "file",
    logo: "openssh",
    logoColor: "000000",
    authType: "credentials",
    fields: [
      { key: "host", label: "Host", type: "text", required: true, placeholder: "servidor.seudominio.com" },
      { key: "port", label: "Porta", type: "number", default: "22" },
      { key: "username", label: "Usuário", type: "text", required: true },
      { key: "password", label: "Senha", type: "password", help: "Opcional se usar chave privada." },
      { key: "privateKey", label: "Chave privada (PEM)", type: "textarea", help: "Cole o conteúdo de uma chave id_rsa/id_ed25519." },
      { key: "passphrase", label: "Passphrase da chave", type: "password" },
      { key: "folder", label: "Pasta remota", type: "text", default: "/CoreByte-Backups" },
    ],
  },
];

/* ------------------------------------------------------------------ */

export const STORAGE_PROVIDERS: StorageProviderDef[] = [
  ...s3Family,
  ...oauthFamily,
  ...keyFamily,
  ...fileFamily,
];

export const PROVIDER_GROUPS: { key: StorageProviderDef["group"]; label: string; description: string }[] = [
  { key: "s3", label: "Armazenamento S3", description: "Amazon S3, Cloudflare R2, Backblaze, Wasabi, MinIO, DigitalOcean, Storj e outros." },
  { key: "oauth", label: "Google Drive, OneDrive, Dropbox e Box", description: "Conecte a conta que você já usa. O CoreByte renova o token sozinho." },
  { key: "key", label: "Chave ou token", description: "pCloud, MEGA e TeraBox." },
  { key: "file", label: "Servidor de arquivos", description: "WebDAV, Nextcloud, FTP/FTPS e SFTP." },
];

export function findProviderDef(id: string): StorageProviderDef | undefined {
  return STORAGE_PROVIDERS.find((p) => p.id === id);
}

/** Descobre o adaptador a partir do tipo gravado ou do id do catálogo. */
export function resolveType(idOrType: string): StorageType | undefined {
  const byId = findProviderDef(idOrType);
  if (byId) return byId.type;
  const byType = STORAGE_PROVIDERS.find((p) => p.type === idOrType);
  return byType?.type;
}

export function providerName(idOrType: string): string {
  const def = findProviderDef(idOrType);
  if (def) return def.name;
  const byType = STORAGE_PROVIDERS.find((p) => p.type === idOrType);
  return byType?.name ?? idOrType;
}

/** ícone para exibição: URL do simple-icons ou null para usar ícone neutro. */
export function providerLogoUrl(idOrType: string): string | null {
  const def = findProviderDef(idOrType) ?? STORAGE_PROVIDERS.find((p) => p.type === idOrType);
  if (!def || !def.logo) return null;
  const color = def.logoColor ? `/${def.logoColor}` : "";
  // Para logos claros usamos a versão branca no tema escuro.
  return `https://cdn.simpleicons.org/${def.logo}${color}`;
}

/** Campos padrão quando o serviço não está no catálogo (provedor legado). */
export function fieldsFor(idOrType: string): StorageField[] {
  const def = findProviderDef(idOrType);
  if (def) return def.fields;
  return [
    { key: "endpoint", label: "Endpoint", type: "url" },
    { key: "accessKeyId", label: "Access Key ID", type: "text" },
    { key: "secretAccessKey", label: "Secret Access Key", type: "password" },
    { key: "bucket", label: "Bucket", type: "text" },
    { key: "region", label: "Região", type: "text" },
  ];
}

/**
 * Monta o endpoint quando o serviço usa um padrão (DigitalOcean, Linode, Scaleway).
 */
export function buildEndpoint(defId: string, cfg: Record<string, string>): string {
  const def = findProviderDef(defId);
  const template = def?.defaults?.endpointTemplate;
  if (template) {
    return template.replace("{region}", cfg.region || def?.defaults?.region || "us-east-1");
  }
  return cfg.endpoint || "";
}
