/**
 * WebRTC Signaling Server
 *
 * Handles WebRTC peer connection signaling for P2P video streaming.
 * Reduces server load by enabling direct browser-to-browser streaming.
 *
 * Flow:
 * 1. Client A creates offer, sends to signaling server
 * 2. Server relays offer to Client B
 * 3. Client B creates answer, sends back
 * 4. ICE candidates exchanged via signaling
 * 5. P2P connection established
 *
 * @module lib/webrtc/signaling
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'http';
import { EventEmitter } from 'events';
import { generateId, now } from '../../db/index.js';

// =============================================================================
// Types
// =============================================================================

export type SignalingMessageType =
  | 'join'
  | 'leave'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'peer-joined'
  | 'peer-left'
  | 'room-info'
  | 'error';

export interface SignalingMessage {
  type: SignalingMessageType;
  roomId?: string;
  peerId?: string;
  targetPeerId?: string;
  payload?: unknown;
  timestamp: string;
}

export interface Peer {
  id: string;
  ws: WebSocket;
  roomId: string | null;
  joinedAt: string;
  isViewer: boolean;
  metadata?: Record<string, unknown>;
}

export interface Room {
  id: string;
  name: string;
  streamerId: string | null;
  viewers: Set<string>;
  createdAt: string;
  lastActivity: string;
  maxViewers: number;
}

export interface SignalingServerConfig {
  path?: string;
  maxRooms?: number;
  maxViewersPerRoom?: number;
  roomTimeout?: number; // ms before empty room is cleaned up
}

// =============================================================================
// Signaling Server
// =============================================================================

export class SignalingServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private peers: Map<string, Peer> = new Map();
  private rooms: Map<string, Room> = new Map();
  private peersByWs: WeakMap<WebSocket, string> = new WeakMap();
  private config: Required<SignalingServerConfig>;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: SignalingServerConfig = {}) {
    super();
    this.config = {
      path: config.path ?? '/signaling',
      maxRooms: config.maxRooms ?? 1000,
      maxViewersPerRoom: config.maxViewersPerRoom ?? 50,
      roomTimeout: config.roomTimeout ?? 300000, // 5 minutes
    };
  }

  // ===========================================================================
  // Server Lifecycle
  // ===========================================================================

  /**
   * Attach signaling server to an HTTP server
   */
  attach(server: HttpServer): void {
    this.wss = new WebSocketServer({
      server,
      path: this.config.path,
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    // Start cleanup interval for stale rooms
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleRooms();
    }, 60000);

    console.log(`[Signaling] Server attached on ${this.config.path}`);
  }

  /**
   * Detach and cleanup
   */
  detach(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Disconnect all peers
    for (const peer of this.peers.values()) {
      this.sendMessage(peer.ws, {
        type: 'error',
        payload: { message: 'Server shutting down' },
        timestamp: now(),
      });
      peer.ws.close();
    }

    this.peers.clear();
    this.rooms.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    console.log('[Signaling] Server detached');
  }

  // ===========================================================================
  // Connection Handling
  // ===========================================================================

  private handleConnection(ws: WebSocket): void {
    const peerId = generateId();

    const peer: Peer = {
      id: peerId,
      ws,
      roomId: null,
      joinedAt: now(),
      isViewer: true,
    };

    this.peers.set(peerId, peer);
    this.peersByWs.set(ws, peerId);

    console.log(`[Signaling] Peer connected: ${peerId}`);
    this.emit('peer:connected', { peerId });

    // Send peer their ID
    this.sendMessage(ws, {
      type: 'room-info',
      peerId,
      payload: { message: 'Connected to signaling server' },
      timestamp: now(),
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as SignalingMessage;
        this.handleMessage(peer, message);
      } catch (error) {
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(peer);
    });

    ws.on('error', (error) => {
      console.error(`[Signaling] Peer ${peerId} error:`, error);
    });
  }

  private handleMessage(peer: Peer, message: SignalingMessage): void {
    switch (message.type) {
      case 'join':
        this.handleJoin(peer, message);
        break;

      case 'leave':
        this.handleLeave(peer);
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        this.handleRelay(peer, message);
        break;

      default:
        this.sendError(peer.ws, `Unknown message type: ${message.type}`);
    }
  }

  private handleDisconnect(peer: Peer): void {
    // Leave room if in one
    if (peer.roomId) {
      this.leaveRoom(peer);
    }

    this.peers.delete(peer.id);
    console.log(`[Signaling] Peer disconnected: ${peer.id}`);
    this.emit('peer:disconnected', { peerId: peer.id });
  }

  // ===========================================================================
  // Room Management
  // ===========================================================================

  private handleJoin(peer: Peer, message: SignalingMessage): void {
    const roomId = message.roomId;
    const isStreamer = (message.payload as { isStreamer?: boolean })?.isStreamer ?? false;

    if (!roomId) {
      this.sendError(peer.ws, 'Room ID required');
      return;
    }

    // Leave current room if in one
    if (peer.roomId) {
      this.leaveRoom(peer);
    }

    // Get or create room
    let room = this.rooms.get(roomId);

    if (!room) {
      if (this.rooms.size >= this.config.maxRooms) {
        this.sendError(peer.ws, 'Maximum rooms reached');
        return;
      }

      room = {
        id: roomId,
        name: roomId,
        streamerId: null,
        viewers: new Set(),
        createdAt: now(),
        lastActivity: now(),
        maxViewers: this.config.maxViewersPerRoom,
      };
      this.rooms.set(roomId, room);
      console.log(`[Signaling] Room created: ${roomId}`);
    }

    // Join as streamer or viewer
    if (isStreamer) {
      if (room.streamerId && room.streamerId !== peer.id) {
        this.sendError(peer.ws, 'Room already has a streamer');
        return;
      }
      room.streamerId = peer.id;
      peer.isViewer = false;
    } else {
      if (room.viewers.size >= room.maxViewers) {
        this.sendError(peer.ws, 'Room is full');
        return;
      }
      room.viewers.add(peer.id);
      peer.isViewer = true;
    }

    peer.roomId = roomId;
    room.lastActivity = now();

    // Notify peer of join success
    this.sendMessage(peer.ws, {
      type: 'room-info',
      roomId,
      peerId: peer.id,
      payload: {
        isStreamer: !peer.isViewer,
        streamerId: room.streamerId,
        viewerCount: room.viewers.size,
      },
      timestamp: now(),
    });

    // Notify other peers
    this.broadcastToRoom(room, peer.id, {
      type: 'peer-joined',
      roomId,
      peerId: peer.id,
      payload: { isStreamer: !peer.isViewer },
      timestamp: now(),
    });

    console.log(
      `[Signaling] Peer ${peer.id} joined room ${roomId} as ${peer.isViewer ? 'viewer' : 'streamer'}`
    );
    this.emit('peer:joined', { peerId: peer.id, roomId, isStreamer: !peer.isViewer });
  }

  private handleLeave(peer: Peer): void {
    if (!peer.roomId) {
      return;
    }

    this.leaveRoom(peer);

    this.sendMessage(peer.ws, {
      type: 'room-info',
      payload: { message: 'Left room' },
      timestamp: now(),
    });
  }

  private leaveRoom(peer: Peer): void {
    const roomId = peer.roomId;
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) {
      peer.roomId = null;
      return;
    }

    // Remove from room
    if (room.streamerId === peer.id) {
      room.streamerId = null;
    }
    room.viewers.delete(peer.id);

    peer.roomId = null;
    room.lastActivity = now();

    // Notify other peers
    this.broadcastToRoom(room, null, {
      type: 'peer-left',
      roomId,
      peerId: peer.id,
      timestamp: now(),
    });

    // Clean up empty room
    if (!room.streamerId && room.viewers.size === 0) {
      this.rooms.delete(roomId);
      console.log(`[Signaling] Room deleted: ${roomId}`);
    }

    console.log(`[Signaling] Peer ${peer.id} left room ${roomId}`);
    this.emit('peer:left', { peerId: peer.id, roomId });
  }

  // ===========================================================================
  // Message Relay
  // ===========================================================================

  private handleRelay(peer: Peer, message: SignalingMessage): void {
    const targetPeerId = message.targetPeerId;

    if (!targetPeerId) {
      this.sendError(peer.ws, 'Target peer ID required');
      return;
    }

    const targetPeer = this.peers.get(targetPeerId);

    if (!targetPeer) {
      this.sendError(peer.ws, 'Target peer not found');
      return;
    }

    // Verify both peers are in the same room
    if (peer.roomId !== targetPeer.roomId) {
      this.sendError(peer.ws, 'Peers not in same room');
      return;
    }

    // Relay the message
    this.sendMessage(targetPeer.ws, {
      type: message.type,
      roomId: peer.roomId || undefined,
      peerId: peer.id, // Sender's ID
      payload: message.payload,
      timestamp: now(),
    });

    // Update room activity
    if (peer.roomId) {
      const room = this.rooms.get(peer.roomId);
      if (room) {
        room.lastActivity = now();
      }
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  private sendMessage(ws: WebSocket, message: SignalingMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      payload: { error },
      timestamp: now(),
    });
  }

  private broadcastToRoom(room: Room, excludePeerId: string | null, message: SignalingMessage): void {
    // Send to streamer
    if (room.streamerId && room.streamerId !== excludePeerId) {
      const streamer = this.peers.get(room.streamerId);
      if (streamer) {
        this.sendMessage(streamer.ws, message);
      }
    }

    // Send to viewers
    for (const viewerId of room.viewers) {
      if (viewerId !== excludePeerId) {
        const viewer = this.peers.get(viewerId);
        if (viewer) {
          this.sendMessage(viewer.ws, message);
        }
      }
    }
  }

  private cleanupStaleRooms(): void {
    const now_time = Date.now();

    for (const [roomId, room] of this.rooms) {
      const lastActivityTime = new Date(room.lastActivity).getTime();

      if (
        now_time - lastActivityTime > this.config.roomTimeout &&
        !room.streamerId &&
        room.viewers.size === 0
      ) {
        this.rooms.delete(roomId);
        console.log(`[Signaling] Cleaned up stale room: ${roomId}`);
      }
    }
  }

  // ===========================================================================
  // Stats
  // ===========================================================================

  getStats(): {
    peerCount: number;
    roomCount: number;
    rooms: Array<{ id: string; streamer: boolean; viewers: number }>;
  } {
    const rooms = Array.from(this.rooms.values()).map((room) => ({
      id: room.id,
      streamer: !!room.streamerId,
      viewers: room.viewers.size,
    }));

    return {
      peerCount: this.peers.size,
      roomCount: this.rooms.size,
      rooms,
    };
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getPeer(peerId: string): Peer | undefined {
    return this.peers.get(peerId);
  }
}

// =============================================================================
// Singleton
// =============================================================================

let defaultServer: SignalingServer | null = null;

export function getDefaultSignalingServer(): SignalingServer {
  if (!defaultServer) {
    defaultServer = new SignalingServer();
  }
  return defaultServer;
}

export function createSignalingServer(config?: SignalingServerConfig): SignalingServer {
  return new SignalingServer(config);
}

