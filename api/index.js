module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify({
    status: 'online',
    message: 'Zeu Chatbot API Backend is running!',
    timestamp: new Date().toISOString()
  }));
};
