require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

require('./db/db');

const authRoute = require('./routes/auth');
const publicRoute = require('./routes/public');
const batchesRoute = require('./routes/batches');
const marketRoute = require('./routes/market');
const centresRoute = require('./routes/centres');
const adminRoute = require('./routes/admin');
const aiRoute = require('./routes/ai');
const dashboardRoute = require('./routes/dashboard');
const officerRoute = require('./routes/officer');
const notificationsRoute = require('./routes/notifications');
const storeRoute = require('./routes/store');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || true,
  credentials: true,
}));
app.use(express.json({ limit: '4mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'aranyavalue' });
});

app.use('/api/auth', authRoute);
app.use('/api/batches', batchesRoute);
app.use('/api/centres', centresRoute);
app.use('/api/admin', adminRoute);
app.use('/api/ai', aiRoute);
app.use('/api/dashboard', dashboardRoute);
app.use('/api/officer', officerRoute);
app.use('/api/notifications', notificationsRoute);
app.use('/api/store', storeRoute);
app.use('/api', marketRoute);
app.use('/api', publicRoute);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong while handling that request.' });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AranyaValue API on http://localhost:${PORT}`);
  });
}

module.exports = app;
