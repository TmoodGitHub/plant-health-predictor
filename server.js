require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const analyzeRouter = require('./routes/analyze');

const app = express();
const allowedCorsOrigin = process.env.CORS_ORIGIN;

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use(
  cors({
    origin: allowedCorsOrigin || false,
  }),
);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/analyze', analyzeRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/{*path}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(
      path.join(__dirname, 'public', 'index.html'),
    );
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    `Plant Health Predictor running on http://localhost:${PORT}`,
  );
});
