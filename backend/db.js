import postgres from 'postgres';

/**
 * Create a postgres client using Cloudflare Hyperdrive.
 * Hyperdrive provides a connection string via env.HYPERDRIVE.connectionString
 * which is a local proxy that handles pooling and TLS for you.
 *
 * In local `wrangler dev`, set DATABASE_URL in .dev.vars as a fallback.
 *
 * @param {object} env - Cloudflare Workers env bindings
 * @returns postgres SQL client
 */
export function createDb(env) {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('No database connection: set HYPERDRIVE binding or DATABASE_URL in .dev.vars');
  }
  return postgres(connectionString, {
    // Hyperdrive manages the pool; keep max=1 per Worker invocation
    max: 1,
    // Disable prepare for Hyperdrive compatibility
    prepare: false,
  });
}
