import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import eventsRouter from './routes/events.routes';
import pairingRouter from './routes/pairing.routes';
import reviewsRouter from './routes/reviews.routes';
import queueRouter from './routes/queue.routes';
import statsRouter from './routes/stats.routes';
import setsRouter from './routes/sets.routes';
import problemsRouter from './routes/problems.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Mount core endpoints
app.use('/api/events', eventsRouter);
app.use('/api', pairingRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/queue', queueRouter);
app.use('/api/stats', statsRouter);
app.use('/api/sets', setsRouter);
app.use('/api/problems', problemsRouter);

// API health endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
