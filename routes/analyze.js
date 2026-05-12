const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const {
  upload,
  validateUploadedImages,
  cleanupUploadedFiles,
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

const uploadImages = upload.array('images', 10);
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ANALYSES_PER_WINDOW = 5;
const analysisRateLimits = new Map();

const getClientKey = (req) => req.ip || req.socket.remoteAddress;

const cleanupSession = async (sessionId) => {
  try {
    await cleanupUploadedFiles(sessionId);
  } catch (cleanupError) {
    console.error('Upload cleanup error:', cleanupError);
  }
};

const analysisRateLimit = (req, res, next) => {
  const now = Date.now();
  const key = getClientKey(req);

  for (const [clientKey, value] of analysisRateLimits.entries()) {
    if (value.resetAt <= now) {
      analysisRateLimits.delete(clientKey);
    }
  }

  const current = analysisRateLimits.get(key);

  if (!current || current.resetAt <= now) {
    analysisRateLimits.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return next();
  }

  if (current.count >= MAX_ANALYSES_PER_WINDOW) {
    return res.status(429).json({
      error: 'Too many analyses. Please try again later.',
    });
  }

  current.count += 1;
  return next();
};

const handleImageUpload = (req, res, next) => {
  uploadImages(req, res, async (error) => {
    if (!error) {
      return next();
    }

    await cleanupSession(req.sessionId);
    return res.status(400).json({
      error: error.message || 'Invalid upload',
    });
  });
};

class AIResponseError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 502;
  }
}

const extractJsonObject = (text) => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

const assertString = (value, field) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AIResponseError(
      `Invalid AI response: ${field} is required`,
    );
  }
};

const assertStringArray = (value, field) => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== 'string')
  ) {
    throw new AIResponseError(
      `Invalid AI response: ${field} must be a non-empty string array`,
    );
  }
};

const parseAnalysisResult = (response) => {
  if (!Array.isArray(response.content)) {
    throw new AIResponseError(
      'Invalid AI response: missing content',
    );
  }

  const textBlock = response.content.find(
    (block) =>
      block.type === 'text' && typeof block.text === 'string',
  );

  if (!textBlock) {
    throw new AIResponseError(
      'Invalid AI response: missing text content',
    );
  }

  let result;
  try {
    result = JSON.parse(extractJsonObject(textBlock.text));
  } catch {
    throw new AIResponseError(
      'Invalid AI response: expected JSON',
    );
  }

  const plant = result.plant_identification;
  if (!plant || typeof plant !== 'object') {
    throw new AIResponseError(
      'Invalid AI response: plant_identification is required',
    );
  }

  assertString(plant.common_name, 'plant_identification.common_name');
  assertString(
    plant.scientific_name,
    'plant_identification.scientific_name',
  );
  assertString(plant.family, 'plant_identification.family');
  assertString(plant.confidence, 'plant_identification.confidence');
  assertString(
    plant.identifying_features,
    'plant_identification.identifying_features',
  );

  if (
    typeof result.overall_health_score !== 'number' ||
    result.overall_health_score < 1 ||
    result.overall_health_score > 10
  ) {
    throw new AIResponseError(
      'Invalid AI response: overall_health_score must be 1-10',
    );
  }

  assertString(result.health_status, 'health_status');
  assertStringArray(result.observations, 'observations');
  assertStringArray(result.patterns_detected, 'patterns_detected');
  assertString(result.prediction, 'prediction');
  assertStringArray(
    result.recommended_actions,
    'recommended_actions',
  );
  assertString(result.confidence_level, 'confidence_level');
  assertString(result.confidence_reasoning, 'confidence_reasoning');

  return result;
};

router.post(
  '/',
  analysisRateLimit,
  handleImageUpload,
  async (req, res) => {
    const files = req.files || [];
    try {
      if (files.length === 0) {
        return res.status(400).json({
          error: 'No images uploaded',
        });
      }

      if (files.length < 2) {
        await cleanupSession(req.sessionId);
        return res.status(400).json({
          error:
            'Upload at least 2 images so patterns can be detected',
        });
      }

      await validateUploadedImages(files);

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

      const result = parseAnalysisResult(response);

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
      await cleanupSession(req.sessionId);
      res.status(error.statusCode || 500).json({
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
