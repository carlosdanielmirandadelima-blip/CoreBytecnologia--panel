import { assertHost } from "./validate";

/**
 * Atualização de registros DNS dos provedores suportados.
 *
 * Centraliza as chamadas para não espalhar lógica de provedor pelas rotas
 * (como acontecia antes, com cada rota montando sua própria requisição).
 */

export interface DnsUpdateParams {
  zoneId: string;
  recordId: string;
  hostname: string;
  type: string;
  token: string;
  content: string;
}

export async function updateDnsRecord(provider: string, params: DnsUpdateParams): Promise<void> {
  assertHost(params.content, "endereço");
  switch (provider) {
    case "cloudflare":
      return updateCloudflare(params);
    case "digitalocean":
      return updateDigitalOcean(params);
    case "namecheap":
      return updateNamecheap(params);
    default:
      throw new Error(`Provedor de DNS não suportado: ${provider}`);
  }
}

async function updateCloudflare(params: DnsUpdateParams): Promise<void> {
  if (!params.zoneId || !params.recordId) {
    throw new Error("Informe o zoneId e o recordId do Cloudflare");
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(params.zoneId)}/dns_records/${encodeURIComponent(params.recordId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: params.content }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cloudflare recusou a atualização (HTTP ${res.status}) ${text.slice(0, 200)}`);
  }
}

async function updateDigitalOcean(params: DnsUpdateParams): Promise<void> {
  if (!params.hostname) throw new Error("Informe o domínio do registro");
  const res = await fetch(
    `https://api.digitalocean.com/v2/domains/${encodeURIComponent(params.hostname)}/records/${encodeURIComponent(params.recordId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: params.content }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DigitalOcean recusou a atualização (HTTP ${res.status}) ${text.slice(0, 200)}`);
  }
}

async function updateNamecheap(params: DnsUpdateParams): Promise<void> {
  // Namecheap usa o protocolo dyndns2.
  const host = params.hostname.split(".")[0];
  const domain = params.hostname.split(".").slice(1).join(".");
  const url = new URL("https://dynamicdns.park-your-domain.com/update");
  url.searchParams.set("host", host);
  url.searchParams.set("domain", domain);
  url.searchParams.set("password", params.token);
  url.searchParams.set("ip", params.content);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Namecheap recusou a atualização (HTTP ${res.status})`);
  const body = await res.text();
  if (!/Done|nochg/i.test(body)) {
    throw new Error("Namecheap não confirmou a atualização");
  }
}
