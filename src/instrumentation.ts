// Runs once when the server starts: fail fast with a readable message on bad configuration.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/env");
    await import("./lib/env.server");
  }
}
