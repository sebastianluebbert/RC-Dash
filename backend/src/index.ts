import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth';
import { proxmoxRouter } from './routes/proxmox';
import { dnsRouter } from './routes/dns';
import { mailRouter } from './routes/mail';
import { pleskRouter } from './routes/plesk';
import { settingsRouter } from './routes/settings';
import { hetznerRouter } from './routes/hetzner';
import { vncRouter } from './routes/vnc';
import { scriptsRouter } from './routes/scripts';
import { customersRouter } from './routes/customers';
import { errorHandler } from './middleware/errorHandler';
import { initDatabase } from './database/init';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/proxmox', proxmoxRouter);
app.use('/api/dns', dnsRouter);
app.use('/api/mail', mailRouter);
app.use('/api/plesk', pleskRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/hetzner', hetznerRouter);
app.use('/api/vnc', vncRouter);
app.use('/api/scripts', scriptsRouter);
app.use('/api/customers', customersRouter);

// Error handling
app.use(errorHandler);

// Initialize database and start server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 RexCloud Backend running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔒 Security: Helmet enabled, CORS configured`);
    });
  })
  .catch((error) => {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  });

export default app;
