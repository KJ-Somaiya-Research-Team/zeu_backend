try {
  process.loadEnvFile();
} catch (e) {
  // Ignore if .env is missing (e.g. in cloud production where env vars are injected)
}

const http = require('http');
const generateHandler = require('./api/generate');
const feedbackHandler = require('./api/feedback');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // Polyfill helper methods for res.status and res.json for Vercel handler compatibility
  if (!res.status) {
    res.status = function (code) {
      this.statusCode = code;
      return this;
    };
  }
  if (!res.json) {
    res.json = function (data) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(data));
      return this;
    };
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost:' + PORT}`);

  if (url.pathname === '/api/generate') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          req.body = body ? JSON.parse(body) : {};
        } catch (e) {
          req.body = {};
        }
        generateHandler(req, res);
      });
    } else {
      generateHandler(req, res);
    }
  } else if (url.pathname === '/api/feedback') {
    // Feedback endpoint uses multiparty to parse raw req stream
    feedbackHandler(req, res);
  } else if (url.pathname === '/' || url.pathname === '/api') {
    res.status(200).json({
      status: 'online',
      message: 'Zeu Chatbot API Backend is running!',
      endpoints: ['POST /api/generate', 'POST /api/feedback']
    });
  } else {
    res.status(404).json({ error: 'Endpoint Not Found' });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Zeu Backend Server running locally at http://localhost:${PORT}`);
  console.log(`📍 Health Check: GET  http://localhost:${PORT}/`);
  console.log(`📍 AI Generate:  POST http://localhost:${PORT}/api/generate`);
  console.log(`📍 Feedback:     POST http://localhost:${PORT}/api/feedback`);
});
