module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({
    status: 'online',
    message: 'Zeu Chatbot API Backend is running!',
    timestamp: new Date().toISOString()
  }));
};
