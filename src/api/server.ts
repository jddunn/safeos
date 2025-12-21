/**
 * SafeOS API Server
 *
 * Express + WebSocket server for stream management and real-time communication.
 *
 * @module api/server
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createServer, type Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { WSMessage, ApiResponse } from '../types/index.js';
import { getSafeOSDatabase, now } from '../db/index.js';
import { getDefaultOllamaClient } from '../lib/ollama/client.js';

// =============================================================================
// Configuration
// =============================================================================

const PORT = parseInt(process.env['SAFEOS_PORT'] || '8474', 10);
const HOST = process.env['SAFEOS_HOST'] || '0.0.0.0';

// =============================================================================
// Express App
// =============================================================================

const app: Express = express();

// Middleware
app.use(express.json({ limit: '10mb' })); // Large for base64 frames
app.use(express.urlencoded({ extended: true }));

// CORS for development
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// =============================================================================
// Health & Status Routes
// =============================================================================

app.get('/health', async (_req: Request, res: Response) => {
  const ollama = getDefaultOllamaClient();
  const ollamaHealthy = await ollama.isHealthy();

  const response: ApiResponse<{
    status: string;
    ollama: boolean;
    timestamp: string;
  }> = {
    success: true,
    data: {
      status: 'healthy',
      ollama: ollamaHealthy,
      timestamp: now(),
    },
  };

  res.json(response);
});

app.get('/api/status', async (_req: Request, res: Response) => {
  try {
    const db = await getSafeOSDatabase();
    const ollama = getDefaultOllamaClient();

    // Get counts
    const streamCount = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM streams WHERE status = ?',
      ['active']
    );
    const alertCount = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM alerts WHERE acknowledged = 0'
    );
    const queueCount = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM analysis_queue WHERE status = ?',
      ['pending']
    );

    // Check Ollama
    const ollamaHealthy = await ollama.isHealthy();
    let ollamaModels: { triageReady: boolean; analysisReady: boolean; missing: string[] } | null = null;
    if (ollamaHealthy) {
      ollamaModels = await ollama.ensureModels();
    }

    const response: ApiResponse = {
      success: true,
      data: {
        activeStreams: streamCount?.count || 0,
        pendingAlerts: alertCount?.count || 0,
        queuedJobs: queueCount?.count || 0,
        ollama: {
          healthy: ollamaHealthy,
          models: ollamaModels,
        },
        connectedClients: wss?.clients?.size || 0,
        uptime: process.uptime(),
        timestamp: now(),
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// =============================================================================
// Stream Routes
// =============================================================================

app.get('/api/streams', async (_req: Request, res: Response) => {
  try {
    const db = await getSafeOSDatabase();
    const streams = await db.all('SELECT * FROM streams ORDER BY created_at DESC');

    res.json({
      success: true,
      data: streams,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

app.post('/api/streams', async (req: Request, res: Response) => {
  try {
    const { name, profileId } = req.body as { name: string; profileId: string };

    if (!name || !profileId) {
      res.status(400).json({
        success: false,
        error: 'name and profileId are required',
      });
      return;
    }

    const db = await getSafeOSDatabase();
    const id = crypto.randomUUID();
    const timestamp = now();

    await db.run(
      `INSERT INTO streams (id, name, profile_id, status, created_at)
       VALUES (?, ?, ?, 'active', ?)`,
      [id, name, profileId, timestamp]
    );

    const stream = await db.get('SELECT * FROM streams WHERE id = ?', [id]);

    res.status(201).json({
      success: true,
      data: stream,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

app.delete('/api/streams/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getSafeOSDatabase();

    await db.run('UPDATE streams SET status = ? WHERE id = ?', ['disconnected', id]);

    res.json({
      success: true,
      message: 'Stream disconnected',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// =============================================================================
// Alert Routes
// =============================================================================

app.get('/api/alerts', async (req: Request, res: Response) => {
  try {
    const { acknowledged, streamId, limit = '50' } = req.query;
    const db = await getSafeOSDatabase();

    let query = 'SELECT * FROM alerts';
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (acknowledged !== undefined) {
      conditions.push('acknowledged = ?');
      params.push(acknowledged === 'true' ? 1 : 0);
    }

    if (streamId) {
      conditions.push('stream_id = ?');
      params.push(String(streamId));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(String(limit), 10));

    const alerts = await db.all(query, params);

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

app.post('/api/alerts/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getSafeOSDatabase();

    await db.run(
      'UPDATE alerts SET acknowledged = 1, acknowledged_at = ? WHERE id = ?',
      [now(), id]
    );

    res.json({
      success: true,
      message: 'Alert acknowledged',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// =============================================================================
// Profile Routes
// =============================================================================

app.get('/api/profiles', async (_req: Request, res: Response) => {
  try {
    const db = await getSafeOSDatabase();
    const profiles = await db.all('SELECT * FROM monitoring_profiles ORDER BY scenario');

    res.json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// =============================================================================
// WebSocket Server
// =============================================================================

let wss: WebSocketServer;
const clientStreams = new Map<WebSocket, string>(); // ws -> streamId

function setupWebSocket(server: HttpServer): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[SafeOS WS] Client connected');

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        await handleWSMessage(ws, message);
      } catch (error) {
        sendWSError(ws, String(error));
      }
    });

    ws.on('close', () => {
      const streamId = clientStreams.get(ws);
      if (streamId) {
        console.log(`[SafeOS WS] Client disconnected from stream ${streamId}`);
        clientStreams.delete(ws);
      }
    });

    ws.on('error', (error) => {
      console.error('[SafeOS WS] Error:', error);
    });

    // Send initial ping
    sendWSMessage(ws, { type: 'ping', payload: {}, timestamp: now() });
  });

  console.log('[SafeOS WS] WebSocket server ready on /ws');
}

async function handleWSMessage(ws: WebSocket, message: WSMessage): Promise<void> {
  switch (message.type) {
    case 'ping':
      sendWSMessage(ws, { type: 'pong', payload: {}, timestamp: now() });
      break;

    case 'frame':
      await handleFrame(ws, message);
      break;

    case 'audio_level':
      await handleAudioLevel(ws, message);
      break;

    case 'stream_status':
      if (message.streamId) {
        clientStreams.set(ws, message.streamId);
        console.log(`[SafeOS WS] Client subscribed to stream ${message.streamId}`);
      }
      break;

    default:
      console.log(`[SafeOS WS] Unknown message type: ${message.type}`);
  }
}

async function handleFrame(ws: WebSocket, message: WSMessage): Promise<void> {
  const { frameData, motionScore, audioLevel } = message.payload as {
    frameData: string;
    motionScore: number;
    audioLevel: number;
  };
  const streamId = message.streamId || clientStreams.get(ws);

  if (!streamId) {
    sendWSError(ws, 'No stream ID associated with this connection');
    return;
  }

  try {
    const db = await getSafeOSDatabase();
    const id = crypto.randomUUID();
    const timestamp = now();

    // Store frame in buffer
    await db.run(
      `INSERT INTO frame_buffer (id, stream_id, frame_data, captured_at, motion_score, audio_level)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, streamId, frameData, timestamp, motionScore, audioLevel]
    );

    // Update stream last_frame_at
    await db.run(
      'UPDATE streams SET last_frame_at = ? WHERE id = ?',
      [timestamp, streamId]
    );

    // Acknowledge frame receipt
    sendWSMessage(ws, {
      type: 'frame',
      streamId,
      payload: { received: true, frameId: id },
      timestamp,
    });
  } catch (error) {
    sendWSError(ws, String(error));
  }
}

async function handleAudioLevel(_ws: WebSocket, message: WSMessage): Promise<void> {
  const { level } = message.payload as { level: number };
  const streamId = message.streamId;

  if (streamId && level > 0.8) {
    console.log(`[SafeOS] High audio level detected on stream ${streamId}: ${level}`);
    // Could trigger audio-based alerts here
  }
}

function sendWSMessage(ws: WebSocket, message: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendWSError(ws: WebSocket, error: string): void {
  sendWSMessage(ws, {
    type: 'error',
    payload: { error },
    timestamp: now(),
  });
}

/**
 * Broadcast a message to all connected clients
 */
export function broadcast(message: WSMessage): void {
  if (!wss) return;

  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

/**
 * Send a message to clients subscribed to a specific stream
 */
export function broadcastToStream(streamId: string, message: WSMessage): void {
  if (!wss) return;

  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && clientStreams.get(client) === streamId) {
      client.send(data);
    }
  });
}

// =============================================================================
// Server Startup
// =============================================================================

const server: HttpServer = createServer(app);
setupWebSocket(server);

// Only start if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, HOST, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   SafeOS API Server                                           ║
║   Part of SuperCloud's humanitarian mission                   ║
║                                                               ║
║   REST API:    http://${HOST}:${PORT}                              ║
║   WebSocket:   ws://${HOST}:${PORT}/ws                             ║
║   Health:      http://${HOST}:${PORT}/health                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
}

export { app, server };

