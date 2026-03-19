import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import fs from 'fs';
import os from 'os';

const upload = multer({ dest: os.tmpdir() });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // POST /api/analyze — upload a video, run Gemini highlight detection
  app.post(
    '/api/analyze',
    (req: Request, res: Response, next) => {
      req.setTimeout(900_000); // 15 min — Gemini processing can be slow on long VODs
      next();
    },
    upload.single('video'),
    async (req: Request & { file?: Express.Multer.File }, res: Response) => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });
      }

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      const fileManager = new GoogleAIFileManager(apiKey);
      const genAI = new GoogleGenerativeAI(apiKey);

      try {
        // 1. Upload to Gemini File API
        const uploadResult = await fileManager.uploadFile(file.path, {
          mimeType: file.mimetype || 'video/mp4',
          displayName: file.originalname || 'clipr-video',
        });

        // 2. Poll until ACTIVE (large files can take several minutes to process)
        let geminiFile = uploadResult.file;
        let polls = 0;
        while (geminiFile.state === 'PROCESSING' && polls < 120) {
          await new Promise(r => setTimeout(r, 5_000));
          geminiFile = await fileManager.getFile(geminiFile.name);
          polls++;
        }

        if (geminiFile.state !== 'ACTIVE') {
          throw new Error(`Gemini file processing failed with state: ${geminiFile.state}`);
        }

        // 3. Run analysis
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Analyze this gaming video recording.

1. Identify what game is being played. Be specific about the title and game mode if visible.
2. Find the top highlight moments (aim for 5–15 clips depending on video length).

For each highlight provide:
- type: one of: kill, multi-kill, clutch, objective, reaction, funny, death, ability, other
- label: a short clip name, max 4 words
- description: one sentence describing what happens
- startTime: seconds from video start — start ~2 seconds before the action begins
- endTime: seconds from video start — end ~2 seconds after the action ends

Return ONLY valid JSON with no markdown code fences, exactly this structure:
{
  "game": "Game Title",
  "gameMode": "Mode name or null",
  "highlights": [
    {
      "type": "kill",
      "label": "Triple Kill Clutch",
      "description": "Player eliminates 3 enemies in quick succession to win the round.",
      "startTime": 142.5,
      "endTime": 158.0
    }
  ]
}`;

        const result = await model.generateContent([
          {
            fileData: {
              mimeType: geminiFile.mimeType,
              fileUri: geminiFile.uri,
            },
          },
          prompt,
        ]);

        const text = result.response.text().trim();

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          // Strip any accidental markdown fences and retry
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            parsed = JSON.parse(match[0]);
          } else {
            throw new Error('Could not parse Gemini response as JSON');
          }
        }

        // 4. Clean up — best effort
        try { await fileManager.deleteFile(geminiFile.name); } catch { /* ignore */ }
        try { fs.unlinkSync(file.path); } catch { /* ignore */ }

        return res.json(parsed);
      } catch (err: any) {
        try { fs.unlinkSync(file.path); } catch { /* ignore */ }
        return res.status(500).json({ error: err.message || 'Analysis failed' });
      }
    }
  );

  return httpServer;
}
