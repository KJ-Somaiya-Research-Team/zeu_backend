try {
  process.loadEnvFile();
} catch (e) {
  // Ignore if .env is missing
}

const connectDB = require('./src/v1/utils/db');
const app = require('./api/index');
const PORT = process.env.PORT || 3000;

// Connect to MongoDB Atlas
connectDB();

app.listen(PORT, () => {
  console.log(`🚀 Zeu Backend Server running at http://localhost:${PORT}`);
  console.log(`📍 Architecture: Express Monolith (Render / Cloud Ready)`);
  console.log(`📍 Health Check: GET http://localhost:${PORT}/`);
});
