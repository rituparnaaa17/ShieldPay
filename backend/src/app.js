import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { testConnection } from './config/db.js';
import { notFound, globalErrorHandler } from './utils/errorHandler.js';
import pricingRoutes from './routes/pricing.js';
import policyRoutes from './routes/policies.js';

const app = express();

// ── Security middleware ──────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests, slow down.' },
  })
);

// ── Routes ───────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'ShieldPay API is running', timestamp: new Date().toISOString() });
});

app.use('/api/pricing', pricingRoutes);
app.use('/api/policies', policyRoutes);

// ── Error handling ────────────────────────────────────────────────
app.use(notFound);
app.use(globalErrorHandler);

// ── Start server ──────────────────────────────────────────────────
const start = async () => {
  await testConnection();
  app.listen(config.port, () => {
    console.log(`🚀 ShieldPay API running on http://localhost:${config.port}`);
    console.log(`   ENV: ${config.nodeEnv}`);
  });
};

start();
