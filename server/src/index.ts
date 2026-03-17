import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateAWSResponse } from './awsAgent';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'DevOps Server is running' });
});

app.post('/api/chat', (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Generate AWS-aware response
  const response = generateAWSResponse(message);

  res.json(response);
});

// Start server
app.listen(port, () => {
  console.log(`✓ DevOps Server running on http://localhost:${port}`);
});
