import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { testConnection } from './config/db.js';
import { notFound, globalErrorHandler } from './utils/errorHandler.js';
import prisma from './config/db.js';

// Routes
import authRoutes    from './routes/auth.js';
import userRoutes    from './routes/user.js';
import pricingRoutes from './routes/pricing.js';
import policyRoutes  from './routes/policies.js';
import triggerRoutes from './routes/triggers.js';
import claimRoutes   from './routes/claims.js';
import weatherRoutes from './routes/weather.js';

// Scheduler
import { startSchedulers }        from './jobs/scheduler.js';
import { startTriggerScheduler }   from './jobs/triggerScheduler.js';

const app = express();

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: true,          // reflect the request origin — allows any domain
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: { success: false, message: 'Too many requests, slow down.' },
}));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message:   'ShieldPay API is running',
    version:   '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/user',     userRoutes);
app.use('/api/pricing',  pricingRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/triggers', triggerRoutes);
app.use('/api/claims',   claimRoutes);
app.use('/api/weather',  weatherRoutes);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(globalErrorHandler);

// ── Auto-seed zones (runs on every startup, upserts so safe to repeat) ────────
const ZONES = [
  { zoneName: 'Mumbai Central',    zoneCode: 'MUM-C',   city: 'Mumbai',     state: 'Maharashtra', riskLevel: 'high',      riskFactor: 1.50, basePremium: 120.00 },
  { zoneName: 'Mumbai Suburbs',    zoneCode: 'MUM-S',   city: 'Mumbai',     state: 'Maharashtra', riskLevel: 'medium',    riskFactor: 1.20, basePremium: 100.00 },
  { zoneName: 'Delhi NCR Core',    zoneCode: 'DEL-C',   city: 'Delhi',      state: 'Delhi',       riskLevel: 'very_high', riskFactor: 1.80, basePremium: 150.00 },
  { zoneName: 'Delhi Outer Ring',  zoneCode: 'DEL-O',   city: 'Delhi',      state: 'Delhi',       riskLevel: 'high',      riskFactor: 1.45, basePremium: 130.00 },
  { zoneName: 'Bangalore Urban',   zoneCode: 'BLR-U',   city: 'Bengaluru',  state: 'Karnataka',   riskLevel: 'medium',    riskFactor: 1.15, basePremium:  95.00 },
  { zoneName: 'Bangalore Rural',   zoneCode: 'BLR-R',   city: 'Bengaluru',  state: 'Karnataka',   riskLevel: 'low',       riskFactor: 0.90, basePremium:  80.00 },
  { zoneName: 'Pune Central',      zoneCode: 'PUN-C',   city: 'Pune',       state: 'Maharashtra', riskLevel: 'medium',    riskFactor: 1.10, basePremium:  90.00 },
  { zoneName: 'Chennai Central',   zoneCode: 'CHN-C',   city: 'Chennai',    state: 'Tamil Nadu',  riskLevel: 'medium',    riskFactor: 1.20, basePremium: 100.00 },
  { zoneName: 'Chennai Velachery', zoneCode: 'CHN-VEL', city: 'Chennai',    state: 'Tamil Nadu',  riskLevel: 'high',      riskFactor: 1.35, basePremium: 112.00 },
  { zoneName: 'Hyderabad Central', zoneCode: 'HYD-C',   city: 'Hyderabad',  state: 'Telangana',   riskLevel: 'medium',    riskFactor: 1.18, basePremium:  98.00 },
  { zoneName: 'Kolkata Central',   zoneCode: 'KOL-C',   city: 'Kolkata',    state: 'West Bengal', riskLevel: 'high',      riskFactor: 1.40, basePremium: 115.00 },
  { zoneName: 'Default Zone',      zoneCode: 'DEFAULT', city: 'Unknown',    state: 'Unknown',     riskLevel: 'medium',    riskFactor: 1.00, basePremium:  95.00 },
];

async function ensureZonesSeeded() {
  try {
    const count = await prisma.zone.count();
    if (count >= ZONES.length) {
      console.log(`✅ Zones already seeded (${count} zones found)`);
      return;
    }
    console.log('🌱 Auto-seeding zones...');
    for (const zone of ZONES) {
      await prisma.zone.upsert({
        where:  { zoneCode: zone.zoneCode },
        create: zone,
        update: { riskLevel: zone.riskLevel, riskFactor: zone.riskFactor, basePremium: zone.basePremium, city: zone.city },
      });
    }
    console.log(`✅ ${ZONES.length} zones seeded`);
  } catch (err) {
    console.error('⚠️ Zone seeding failed (non-fatal):', err.message);
  }
}

// ── Start server ──────────────────────────────────────────────────────────────
const start = async () => {
  await testConnection();
  await ensureZonesSeeded();   // ← auto-seed zones on every cold start
  startSchedulers();
  startTriggerScheduler();     // ← parametric pipeline (every 30 min)

  const server = app.listen(config.port, () => {
    console.log(`🚀 ShieldPay API v2.0 → http://localhost:${config.port}`);
    console.log(`   ENV: ${config.nodeEnv} | DB: Prisma/PostgreSQL`);
  });

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use. Change PORT in backend/.env`);
      process.exit(1);
    }
    throw error;
  });
};

start();
