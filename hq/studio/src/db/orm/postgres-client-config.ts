import type { ClientConfig } from "pg";
import type { TlsOptions } from "node:tls";

/** Railway public Postgres requires TLS; internal `.railway.internal` often does not. */
export function postgresSslForUrl(connectionUrl: string): boolean | TlsOptions | undefined {
  const parsed = new URL(connectionUrl);
  const useSsl =
    process.env.DATABASE_SSL === "1" ||
    (process.env.DATABASE_SSL !== "0" &&
      (parsed.hostname.includes("rlwy.net") || parsed.hostname.includes("proxy.rlwy.net")));

  return useSsl ? { rejectUnauthorized: false } : undefined;
}

export function postgresClientConfigFromUrl(connectionUrl: string): ClientConfig {
  const ssl = postgresSslForUrl(connectionUrl);
  return {
    connectionString: connectionUrl,
    ssl: ssl as ClientConfig["ssl"],
  };
}
