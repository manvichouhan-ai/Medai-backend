import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import passport from './config/passport.js';
import { env } from './config/env.js';
import router from './routes/index.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { logger } from './src/utils/logger.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(morgan('dev', { stream: { write: (msg) => logger.http(msg.trim()) } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});

app.use('/api/auth', authLimiter);
app.use('/api', router);

app.use(errorMiddleware);

export default app;
