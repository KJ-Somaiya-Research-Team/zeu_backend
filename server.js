try {
  process.loadEnvFile();
} catch (e) {
  // Ignore if .env is missing
}

const app = require('./api/index');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Zeu Backend Server running locally at http://localhost:${PORT}`);
  console.log(`📍 Architecture: Monolithic Express API (Vercel Limit Bypassed)`);
  console.log(`📍 Health Check: GET http://localhost:${PORT}/api`);
});
