const multiparty = require('multiparty');

// Enable CORS for Vercel
const allowCors = (fn) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

// In Vercel serverless, we must disable the default body parser to handle multipart form data manually
const config = {
  api: {
    bodyParser: false,
  },
};

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const form = new multiparty.Form();

  form.parse(req, (err, fields, files) => {
    if (err) {
      console.error('Error parsing form:', err);
      return res.status(500).json({ error: 'Failed to parse feedback submission' });
    }

    try {
      // In a real application, you would upload the files (e.g., to Vercel Blob or AWS S3)
      // and save the fields to a database (e.g., MongoDB, PostgreSQL, Convex).
      
      console.log('--- Received Feedback Submission ---');
      console.log('Fields:', fields);
      
      // Log received files (images)
      Object.keys(files).forEach((key) => {
        const uploadedFiles = files[key];
        console.log(`Received ${uploadedFiles.length} file(s) for section: ${key}`);
        uploadedFiles.forEach(f => {
          console.log(` - File Name: ${f.originalFilename}, Size: ${f.size} bytes`);
        });
      });

      return res.status(200).json({ 
        success: true, 
        message: 'Feedback and images processed successfully',
        receivedSections: Object.keys(fields),
        receivedFiles: Object.keys(files)
      });
    } catch (processError) {
      console.error('Processing error:', processError);
      return res.status(500).json({ error: 'Failed to process feedback data' });
    }
  });
};

module.exports = allowCors(handler);
