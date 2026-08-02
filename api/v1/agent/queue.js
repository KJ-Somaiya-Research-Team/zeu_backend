module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({
    success: true,
    message: 'Queue endpoint is online!',
    timestamp: new Date().toISOString()
  }));
};
