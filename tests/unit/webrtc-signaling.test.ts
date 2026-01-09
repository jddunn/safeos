/**
 * WebRTC Signaling Unit Tests
 *
 * Tests for the WebRTC signaling server.
 *
 * @module tests/unit/webrtc-signaling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignalingServer, createSignalingServer } from '../../src/lib/webrtc/signaling.js';

// Mock WebSocket
class MockWebSocket {
  readyState = 1; // OPEN
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
}

// =============================================================================
// Test Suite
// =============================================================================

describe('SignalingServer', () => {
  let server: SignalingServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = createSignalingServer();
  });

  // ===========================================================================
  // Connection Tests
  // ===========================================================================

  describe('connection handling', () => {
    it('should register new peer connection', () => {
      const mockWs = new MockWebSocket();

      const peerId = server.handleConnection(mockWs as any, 'peer-1');

      expect(peerId).toBe('peer-1');
      const stats = server.getStats();
      expect(stats.activePeers).toBe(1);
    });

    it('should generate peer ID when not provided', () => {
      const mockWs = new MockWebSocket();

      const peerId = server.handleConnection(mockWs as any);

      expect(peerId).toMatch(/^peer-\d+-/);
    });

    it('should track multiple peers', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      const ws3 = new MockWebSocket();

      server.handleConnection(ws1 as any, 'peer-1');
      server.handleConnection(ws2 as any, 'peer-2');
      server.handleConnection(ws3 as any, 'peer-3');

      const stats = server.getStats();
      expect(stats.activePeers).toBe(3);
      expect(stats.totalConnections).toBe(3);
    });

    it('should remove peer on disconnect', () => {
      const mockWs = new MockWebSocket();

      server.handleConnection(mockWs as any, 'peer-1');
      server.handleDisconnection(mockWs as any);

      const stats = server.getStats();
      expect(stats.activePeers).toBe(0);
    });
  });

  // ===========================================================================
  // Room Join/Leave Tests
  // ===========================================================================

  describe('room management', () => {
    it('should allow peer to join room', () => {
      const mockWs = new MockWebSocket();
      server.handleConnection(mockWs as any, 'peer-1');

      server.joinRoom('peer-1', 'room-123', true);

      const info = server.getRoomInfo('room-123');
      expect(info.exists).toBe(true);
      expect(info.viewerCount).toBe(1);
    });

    it('should create room on first join', () => {
      const mockWs = new MockWebSocket();
      server.handleConnection(mockWs as any, 'peer-1');

      // Room doesn't exist yet
      let info = server.getRoomInfo('room-new');
      expect(info.exists).toBe(false);

      // Join creates the room
      server.joinRoom('peer-1', 'room-new', true);

      info = server.getRoomInfo('room-new');
      expect(info.exists).toBe(true);
    });

    it('should track broadcaster vs viewer', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      server.handleConnection(ws1 as any, 'broadcaster');
      server.handleConnection(ws2 as any, 'viewer');

      server.joinRoom('broadcaster', 'room-123', false); // isViewer = false
      server.joinRoom('viewer', 'room-123', true); // isViewer = true

      const info = server.getRoomInfo('room-123');
      expect(info.hasBroadcaster).toBe(true);
      expect(info.viewerCount).toBe(1);
    });

    it('should allow peer to leave room', () => {
      const mockWs = new MockWebSocket();
      server.handleConnection(mockWs as any, 'peer-1');
      server.joinRoom('peer-1', 'room-123', true);

      server.leaveRoom('peer-1');

      const info = server.getRoomInfo('room-123');
      expect(info.viewerCount).toBe(0);
    });

    it('should clean up room when last peer leaves', () => {
      const mockWs = new MockWebSocket();
      server.handleConnection(mockWs as any, 'peer-1');
      server.joinRoom('peer-1', 'room-123', true);

      server.leaveRoom('peer-1');

      const info = server.getRoomInfo('room-123');
      expect(info.exists).toBe(false);
    });

    it('should notify other peers when someone joins', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      server.handleConnection(ws1 as any, 'peer-1');
      server.handleConnection(ws2 as any, 'peer-2');

      server.joinRoom('peer-1', 'room-123', false); // broadcaster
      server.joinRoom('peer-2', 'room-123', true); // viewer joins

      // peer-1 should be notified about peer-2 joining
      expect(ws1.send).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Message Handling Tests
  // ===========================================================================

  describe('message handling', () => {
    it('should handle join-room message', () => {
      const mockWs = new MockWebSocket();
      server.handleConnection(mockWs as any, 'peer-1');

      server.handleMessage(mockWs as any, {
        type: 'join-room',
        roomId: 'room-123',
        payload: { isViewer: true },
      });

      const info = server.getRoomInfo('room-123');
      expect(info.exists).toBe(true);
      expect(info.viewerCount).toBe(1);
    });

    it('should handle leave-room message', () => {
      const mockWs = new MockWebSocket();
      server.handleConnection(mockWs as any, 'peer-1');
      server.joinRoom('peer-1', 'room-123', true);

      server.handleMessage(mockWs as any, { type: 'leave-room' });

      const info = server.getRoomInfo('room-123');
      expect(info.exists).toBe(false);
    });

    it('should relay offer to target peer', () => {
      const senderWs = new MockWebSocket();
      const receiverWs = new MockWebSocket();

      server.handleConnection(senderWs as any, 'sender');
      server.handleConnection(receiverWs as any, 'receiver');

      // Both must be in the same room for relay to work
      server.joinRoom('sender', 'room-123', false);
      server.joinRoom('receiver', 'room-123', true);

      server.handleMessage(senderWs as any, {
        type: 'offer',
        targetPeerId: 'receiver',
        payload: { sdp: 'v=0...' },
      });

      expect(receiverWs.send).toHaveBeenCalled();
      const stats = server.getStats();
      expect(stats.messagesRelayed).toBeGreaterThan(0);
    });

    it('should relay answer to target peer', () => {
      const senderWs = new MockWebSocket();
      const receiverWs = new MockWebSocket();

      server.handleConnection(senderWs as any, 'sender');
      server.handleConnection(receiverWs as any, 'receiver');

      server.joinRoom('sender', 'room-123', false);
      server.joinRoom('receiver', 'room-123', true);

      server.handleMessage(receiverWs as any, {
        type: 'answer',
        targetPeerId: 'sender',
        payload: { sdp: 'v=0...' },
      });

      expect(senderWs.send).toHaveBeenCalled();
    });

    it('should relay ICE candidates', () => {
      const senderWs = new MockWebSocket();
      const receiverWs = new MockWebSocket();

      server.handleConnection(senderWs as any, 'sender');
      server.handleConnection(receiverWs as any, 'receiver');

      server.joinRoom('sender', 'room-123', false);
      server.joinRoom('receiver', 'room-123', true);

      server.handleMessage(senderWs as any, {
        type: 'ice-candidate',
        targetPeerId: 'receiver',
        payload: { candidate: 'candidate:...' },
      });

      expect(receiverWs.send).toHaveBeenCalled();
    });

    it('should handle room-info request', () => {
      const mockWs = new MockWebSocket();
      server.handleConnection(mockWs as any, 'peer-1');
      server.joinRoom('peer-1', 'room-123', true);

      server.handleMessage(mockWs as any, { type: 'room-info' });

      expect(mockWs.send).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Stats Tests
  // ===========================================================================

  describe('stats tracking', () => {
    it('should track total connections', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      server.handleConnection(ws1 as any, 'peer-1');
      server.handleConnection(ws2 as any, 'peer-2');

      const stats = server.getStats();
      expect(stats.totalConnections).toBe(2);
    });

    it('should track active rooms', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      server.handleConnection(ws1 as any, 'peer-1');
      server.handleConnection(ws2 as any, 'peer-2');

      server.joinRoom('peer-1', 'room-1', true);
      server.joinRoom('peer-2', 'room-2', true);

      const stats = server.getStats();
      expect(stats.activeRooms).toBe(2);
    });

    it('should track messages relayed', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      server.handleConnection(ws1 as any, 'peer-1');
      server.handleConnection(ws2 as any, 'peer-2');

      server.joinRoom('peer-1', 'room-123', false);
      server.joinRoom('peer-2', 'room-123', true);

      server.handleMessage(ws1 as any, {
        type: 'offer',
        targetPeerId: 'peer-2',
        payload: {},
      });

      const stats = server.getStats();
      expect(stats.messagesRelayed).toBe(1);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should handle messages from unknown socket gracefully', () => {
      const unknownWs = new MockWebSocket();

      // Should not throw
      expect(() => server.handleMessage(unknownWs as any, { type: 'offer' })).not.toThrow();
    });

    it('should handle disconnect from unknown socket gracefully', () => {
      const unknownWs = new MockWebSocket();

      // Should not throw
      expect(() => server.handleDisconnection(unknownWs as any)).not.toThrow();
    });

    it('should handle join for non-existent peer gracefully', () => {
      // Should not throw
      expect(() => server.joinRoom('non-existent', 'room-123', true)).not.toThrow();
    });

    it('should handle leave for non-existent peer gracefully', () => {
      // Should not throw
      expect(() => server.leaveRoom('non-existent')).not.toThrow();
    });
  });
});
