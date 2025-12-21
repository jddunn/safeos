/**
 * WebRTC Client
 *
 * Browser-side WebRTC peer connection management for P2P video streaming.
 *
 * @module lib/webrtc-client
 */

// =============================================================================
// Types
// =============================================================================

export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';

export interface WebRTCClientConfig {
  signalingUrl: string;
  iceServers?: RTCIceServer[];
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream, peerId: string) => void;
  onStateChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
}

interface SignalingMessage {
  type: string;
  roomId?: string;
  peerId?: string;
  targetPeerId?: string;
  payload?: unknown;
  timestamp: string;
}

// =============================================================================
// Default ICE Servers (STUN only - free)
// =============================================================================

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

// =============================================================================
// WebRTC Client
// =============================================================================

export class WebRTCClient {
  private config: Required<WebRTCClientConfig>;
  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private peerId: string | null = null;
  private roomId: string | null = null;
  private isStreamer = false;
  private state: ConnectionState = 'new';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: WebRTCClientConfig) {
    this.config = {
      signalingUrl: config.signalingUrl,
      iceServers: config.iceServers ?? DEFAULT_ICE_SERVERS,
      onLocalStream: config.onLocalStream ?? (() => {}),
      onRemoteStream: config.onRemoteStream ?? (() => {}),
      onStateChange: config.onStateChange ?? (() => {}),
      onError: config.onError ?? console.error,
    };
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Connect to signaling server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setState('connecting');

      try {
        this.ws = new WebSocket(this.config.signalingUrl);

        this.ws.onopen = () => {
          console.log('[WebRTC] Connected to signaling server');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as SignalingMessage;
            void this.handleSignalingMessage(message);
          } catch (error) {
            console.error('[WebRTC] Failed to parse message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('[WebRTC] Signaling connection closed');
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[WebRTC] Signaling error:', error);
          this.config.onError(new Error('Signaling connection error'));
          reject(new Error('Failed to connect to signaling server'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Start streaming to a room
   */
  async startStreaming(roomId: string): Promise<MediaStream> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to signaling server');
    }

    // Get local media stream
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: true,
    });

    this.config.onLocalStream(this.localStream);
    this.isStreamer = true;
    this.roomId = roomId;

    // Join room as streamer
    this.sendSignaling({
      type: 'join',
      roomId,
      payload: { isStreamer: true },
      timestamp: new Date().toISOString(),
    });

    this.setState('connected');
    return this.localStream;
  }

  /**
   * Join a room as viewer
   */
  async joinAsViewer(roomId: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to signaling server');
    }

    this.isStreamer = false;
    this.roomId = roomId;

    // Join room as viewer
    this.sendSignaling({
      type: 'join',
      roomId,
      payload: { isStreamer: false },
      timestamp: new Date().toISOString(),
    });

    this.setState('connecting');
  }

  /**
   * Leave the current room
   */
  leaveRoom(): void {
    if (this.roomId) {
      this.sendSignaling({
        type: 'leave',
        roomId: this.roomId,
        timestamp: new Date().toISOString(),
      });
    }

    this.cleanup();
  }

  /**
   * Disconnect from signaling and cleanup
   */
  disconnect(): void {
    this.leaveRoom();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
  }

  /**
   * Get current state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote streams
   */
  getRemoteStreams(): Map<string, MediaStream> {
    return new Map(this.remoteStreams);
  }

  // ===========================================================================
  // Signaling Message Handlers
  // ===========================================================================

  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    switch (message.type) {
      case 'room-info':
        this.peerId = message.peerId || null;
        console.log(`[WebRTC] Assigned peer ID: ${this.peerId}`);
        break;

      case 'peer-joined':
        await this.handlePeerJoined(message);
        break;

      case 'peer-left':
        this.handlePeerLeft(message);
        break;

      case 'offer':
        await this.handleOffer(message);
        break;

      case 'answer':
        await this.handleAnswer(message);
        break;

      case 'ice-candidate':
        await this.handleIceCandidate(message);
        break;

      case 'error':
        const error = (message.payload as { error?: string })?.error || 'Unknown error';
        console.error('[WebRTC] Signaling error:', error);
        this.config.onError(new Error(error));
        break;
    }
  }

  private async handlePeerJoined(message: SignalingMessage): Promise<void> {
    const remotePeerId = message.peerId;
    const isRemoteStreamer = (message.payload as { isStreamer?: boolean })?.isStreamer;

    if (!remotePeerId || remotePeerId === this.peerId) {
      return;
    }

    console.log(`[WebRTC] Peer joined: ${remotePeerId} (streamer: ${isRemoteStreamer})`);

    // If we're the streamer and a viewer joined, create offer
    if (this.isStreamer && !isRemoteStreamer) {
      await this.createPeerConnection(remotePeerId, true);
    }
  }

  private handlePeerLeft(message: SignalingMessage): void {
    const remotePeerId = message.peerId;
    if (!remotePeerId) return;

    console.log(`[WebRTC] Peer left: ${remotePeerId}`);

    const pc = this.peerConnections.get(remotePeerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(remotePeerId);
    }

    const stream = this.remoteStreams.get(remotePeerId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      this.remoteStreams.delete(remotePeerId);
    }
  }

  private async handleOffer(message: SignalingMessage): Promise<void> {
    const remotePeerId = message.peerId;
    const offer = message.payload as RTCSessionDescriptionInit;

    if (!remotePeerId || !offer) {
      return;
    }

    console.log(`[WebRTC] Received offer from ${remotePeerId}`);

    // Create peer connection if needed
    let pc = this.peerConnections.get(remotePeerId);
    if (!pc) {
      pc = await this.createPeerConnection(remotePeerId, false);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignaling({
      type: 'answer',
      targetPeerId: remotePeerId,
      payload: answer,
      timestamp: new Date().toISOString(),
    });
  }

  private async handleAnswer(message: SignalingMessage): Promise<void> {
    const remotePeerId = message.peerId;
    const answer = message.payload as RTCSessionDescriptionInit;

    if (!remotePeerId || !answer) {
      return;
    }

    console.log(`[WebRTC] Received answer from ${remotePeerId}`);

    const pc = this.peerConnections.get(remotePeerId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      this.setState('connected');
    }
  }

  private async handleIceCandidate(message: SignalingMessage): Promise<void> {
    const remotePeerId = message.peerId;
    const candidate = message.payload as RTCIceCandidateInit;

    if (!remotePeerId || !candidate) {
      return;
    }

    const pc = this.peerConnections.get(remotePeerId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  // ===========================================================================
  // Peer Connection Management
  // ===========================================================================

  private async createPeerConnection(
    remotePeerId: string,
    createOffer: boolean
  ): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    });

    this.peerConnections.set(remotePeerId, pc);

    // Add local tracks if we're streaming
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received track from ${remotePeerId}`);

      let stream = this.remoteStreams.get(remotePeerId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteStreams.set(remotePeerId, stream);
      }

      stream.addTrack(event.track);
      this.config.onRemoteStream(stream, remotePeerId);
      this.setState('connected');
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling({
          type: 'ice-candidate',
          targetPeerId: remotePeerId,
          payload: event.candidate.toJSON(),
          timestamp: new Date().toISOString(),
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${remotePeerId}: ${pc.connectionState}`);

      switch (pc.connectionState) {
        case 'connected':
          this.setState('connected');
          break;
        case 'failed':
        case 'disconnected':
          this.handlePeerDisconnected(remotePeerId);
          break;
      }
    };

    // Create offer if initiating
    if (createOffer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignaling({
        type: 'offer',
        targetPeerId: remotePeerId,
        payload: offer,
        timestamp: new Date().toISOString(),
      });
    }

    return pc;
  }

  private handlePeerDisconnected(remotePeerId: string): void {
    const pc = this.peerConnections.get(remotePeerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(remotePeerId);
    }

    this.remoteStreams.delete(remotePeerId);

    if (this.peerConnections.size === 0) {
      this.setState(this.isStreamer ? 'connected' : 'disconnected');
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  private sendSignaling(message: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.config.onStateChange(state);
    }
  }

  private handleDisconnect(): void {
    this.cleanup();
    this.setState('disconnected');

    // Attempt reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => {
        this.reconnectAttempts++;
        void this.connect();
      }, delay);
    }
  }

  private cleanup(): void {
    // Close all peer connections
    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();

    // Stop remote streams
    for (const stream of this.remoteStreams.values()) {
      stream.getTracks().forEach((track) => track.stop());
    }
    this.remoteStreams.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.roomId = null;
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createWebRTCClient(config: WebRTCClientConfig): WebRTCClient {
  return new WebRTCClient(config);
}

