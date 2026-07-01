import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import problemsRouter from './routes/problems';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Mount core endpoints
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
