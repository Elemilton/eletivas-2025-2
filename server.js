import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Initialize database tables
async function initializeDatabase() {
  try {
    const inscricoesApi = await import(path.join(__dirname, 'api', 'inscricoes.js'));
    // Call the handler to ensure tables are created
    await inscricoesApi.default({ method: 'GET', query: {} }, { status: () => ({ end: () => {}, json: () => {} }) });
    console.log('Database tables initialized successfully.');
  } catch (error) {
    console.error('Error initializing database tables:', error);
  }
}

// API routes
app.all('/api/:folder/:file', (req, res) => {
  const { folder, file } = req.params;
  const apiPath = path.join(__dirname, 'api', folder, `${file}.js`);
  if (fs.existsSync(apiPath)) {
    import(apiPath).then(module => module.default(req, res));
  } else {
    res.status(404).send('Not Found');
  }
});

app.all('/api/:file', (req, res) => {
  const { file } = req.params;
  const apiPath = path.join(__dirname, 'api', `${file}.js`);
  if (fs.existsSync(apiPath)) {
    import(apiPath).then(module => module.default(req, res));
  } else {
    res.status(404).send('Not Found');
  }
});

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});


