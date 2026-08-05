// api/feedback.js — User feedback/rating endpoint
const multiparty = require('multiparty');
const { logResearchEvent } = require('./v1/_utils/logger');
const store = require('./v1/_utils/store');

const handler = async (req, res) => {
  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error parsing form:', err);
      return res.status(500).json({ error: 'Failed to parse feedback submission' });
    }

    try {
      console.log('--- Received Feedback Submission ---');
      console.log('Fields:', fields);

      // Save feedback to database
      const sessionId = fields.sessionId ? fields.sessionId[0] : null;
      const rating = fields.rating ? parseInt(fields.rating[0]) : null;
      const comment = fields.comment ? fields.comment[0] : null;

      await store.saveFeedback({ sessionId, rating, comment, fields });

      // Log research event
      await logResearchEvent('USER_FEEDBACK', { sessionId, rating, comment, filesCount: Object.keys(files).length });
      
      // Log received files
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

module.exports = handler;
