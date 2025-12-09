import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AuthenticatedRequest } from '../middleware/auth.js';
import type { RewriteRequest, RewriteResponse } from '@tripmatrix/types';

const router = express.Router();

if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY not set. AI rewrite feature will not work.');
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// Rewrite text using Gemini AI
router.post('/rewrite', async (req: AuthenticatedRequest, res) => {
  try {
    const { text, tone }: RewriteRequest = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    if (!genAI) {
      return res.status(503).json({
        success: false,
        error: 'AI service not configured',
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const toneInstructions: Record<string, string> = {
      friendly: 'Rewrite this text in a friendly, casual, and warm tone. Make it sound like you\'re talking to a friend.',
      professional: 'Rewrite this text in a professional, clear, and concise tone. Use formal language and proper structure.',
      'travel-blog': 'Rewrite this text in an engaging travel blog style. Make it descriptive, inspiring, and capture the essence of the travel experience.',
    };

    const prompt = `${toneInstructions[tone] || toneInstructions.friendly}\n\nOriginal text:\n${text}\n\nRewritten text:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rewrittenText = response.text();

    const rewriteResponse: RewriteResponse = {
      rewrittenText: rewrittenText.trim(),
    };

    res.json({
      success: true,
      data: rewriteResponse,
    });
  } catch (error: any) {
    console.error('AI rewrite error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to rewrite text',
    });
  }
});

export default router;

