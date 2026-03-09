import { startControlPlaneServer } from './src/app.mjs';

const server = await startControlPlaneServer();

function shutdown(signal) {
  console.log(`[control-plane-api] shutting down on ${signal}`);
  server.close().finally(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
