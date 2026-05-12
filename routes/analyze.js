const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const {
  upload,
  UPLOADS_DIR,
} = require('../middleware/upload');
const { buildPrompt } = require('../prompts/analyze');
const {
  addEntry,
  getHistory,
  getEntryById,
  clearHistory,
} = require('../storage/history');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

router.post(
  '/',
  upload.array('images', 10),
  async (req, res) => {
    try {
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json({
          error: 'No images uploaded',
        });
      }

      if (files.length < 2) {
        return res.status(400).json({
          error:
            'Upload at least 2 images so patterns can be detected',
        });
      }

      const imageContent = files
        .map((file, index) => {
          const imageData = fs.readFileSync(file.path);
          return [
            {
              type: 'text',
              text: `Image ${index + 1} of ${files.length} (filename: ${file.filename}):`,
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.mimetype,
                data: imageData.toString('base64'),
              },
            },
          ];
        })
        .flat();

      imageContent.push({
        type: 'text',
        text: buildPrompt(files.length),
      });

      const response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: imageContent,
          },
        ],
      });

      const raw = response.content[0].text;
      const cleaned = raw
        .replace(/```json|```/g, '')
        .trim();
      const result = JSON.parse(cleaned);

      const imagePaths = files.map((file) =>
        path.join('uploads', req.sessionId, file.filename),
      );
      const entry = addEntry(
        req.sessionId,
        files.length,
        imagePaths,
        result,
      );

      res.json({
        success: true,
        sessionId: req.sessionId,
        entry,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      res.status(500).json({
        error:
          error.message ||
          'Something went wrong during analysis',
      });
    }
  },
);

router.get('/history', (req, res) => {
  try {
    const history = getHistory();
    res.json({ success: true, history });
  } catch (error) {
    res
      .status(500)
      .json({ error: 'Failed to load history' });
  }
});

router.get('/history/:id', (req, res) => {
  try {
    const entry = getEntryById(req.params.id);
    if (!entry) {
      return res
        .status(404)
        .json({ error: 'Analysis not found' });
    }
    res.json({ success: true, entry });
  } catch (error) {
    res
      .status(500)
      .json({ error: 'Failed to load analysis' });
  }
});

router.delete('/history', (req, res) => {
  try {
    clearHistory();
    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    res
      .status(500)
      .json({ error: 'Failed to clear history' });
  }
});

module.exports = router;
