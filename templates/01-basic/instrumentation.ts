export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { initializeSystem } = await import("./lib/veap");
  await initializeSystem();
}
