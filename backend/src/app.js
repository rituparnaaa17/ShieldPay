import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { testConnection } from './config/db.js';
import { notFound, globalErrorHandler } from './utils/errorHandler.js';
import pricingRoutes from './routes/pricing.js';
import policyRoutes from './routes/policies.js';
import triggerRoutes from './routes/triggers.js';
import claimRoutes from './routes/claims.js';
import authRoutes from './routes/auth.js';
import { startSchedulers } from './jobs/scheduler.js';

const app = express();

// ── Security middleware ──────────────────────────────────────────
app.use(helmet());
const corsOrigin = process.env.CORS_ORIGIN?.trim();
app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
app.use(express.json({ limit: '10kb' }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000,
    message: { success: false, message: 'Too many requests, slow down.' },
  })
);

// ── Routes ───────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'ShieldPay API is running', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/triggers', triggerRoutes);
app.use('/api/claims', claimRoutes);

// ── Error handling ────────────────────────────────────────────────
app.use(notFound);
app.use(globalErrorHandler);

// ── Start server ──────────────────────────────────────────────────
const start = async () => {
  await testConnection();
  startSchedulers();

  const server = app.listen(config.port, () => {
    console.log(`🚀 ShieldPay API running on http://localhost:${config.port}`);
    console.log(`   ENV: ${config.nodeEnv}`);
  });

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use. Set a different PORT in backend/.env and restart.`);
      process.exit(1);
    }

    throw error;
  });
};

start();
