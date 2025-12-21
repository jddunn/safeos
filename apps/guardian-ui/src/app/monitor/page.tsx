'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import CameraFeed from '@/components/CameraFeed';
import MotionDetector from '@/components/MotionDetector';
import AudioMonitor from '@/components/AudioMonitor';
import AlertPanel from '@/components/AlertPanel';
import { useWebSocket } from '@/lib/websocket';

export default function MonitorPage() {
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [motionScore, setMotionScore] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    severity: string;
    message: string;
    createdAt: string;
  }>>([]);
  
  const { connected, send, lastMessage } = useWebSocket('ws://localhost:8474/ws');

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage?.type === 'alert') {
      const alert = lastMessage.payload as {
        id: string;
        severity: string;
        message: string;
        createdAt: string;
      };
      setAlerts((prev) => [alert, ...prev.slice(0, 9)]);
    }
  }, [lastMessage]);

  // Subscribe to stream
  useEffect(() => {
    if (connected && streamId) {
      send({
        type: 'stream_status',
        streamId,
        payload: { action: 'subscribe' },
        timestamp: new Date().toISOString(),
      });
    }
  }, [connected, streamId, send]);

  const handleFrameCapture = useCallback(
    (frameData: string, motion: number, audio: number) => {
      setMotionScore(motion);
      setAudioLevel(audio);

      if (connected && streamId) {
        send({
          type: 'frame',
          streamId,
          payload: { frameData, motionScore: motion, audioLevel: audio },
          timestamp: new Date().toISOString(),
        });
      }
    },
    [connected, streamId, send]
  );

  const startMonitoring = async () => {
    try {
      // Create a new stream
      const res = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Guardian Monitor',
          profileId: 'default', // TODO: Use selected profile
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStreamId(data.data.id);
        setIsStreaming(true);
      }
    } catch (error) {
      console.error('Failed to start stream:', error);
    }
  };

  const stopMonitoring = async () => {
    if (streamId) {
      try {
        await fetch(`/api/streams/${streamId}`, { method: 'DELETE' });
      } catch (error) {
        console.error('Failed to stop stream:', error);
      }
    }
    setStreamId(null);
    setIsStreaming(false);
    setMotionScore(0);
    setAudioLevel(0);
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await fetch(`/api/alerts/${alertId}/acknowledge`, { method: 'POST' });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Monitoring</h1>
          <p className="text-white/60">
            {isStreaming
              ? 'Monitoring active - AI is analyzing your feed'
              : 'Start monitoring to begin'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-white/60">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {/* Start/Stop Button */}
          <button
            onClick={isStreaming ? stopMonitoring : startMonitoring}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              isStreaming
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-safeos-500 hover:bg-safeos-600 text-white'
            }`}
          >
            {isStreaming ? 'Stop Monitoring' : 'Start Monitoring'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Camera Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="camera-container aspect-video">
            {isStreaming ? (
              <>
                <CameraFeed onFrame={handleFrameCapture} />
                <div className="camera-overlay">
                  {/* Motion Indicator */}
                  <div className="motion-indicator">
                    <span>Motion</span>
                    <div className="motion-bar">
                      <div
                        className="motion-bar-fill"
                        style={{ width: `${motionScore * 100}%` }}
                      />
                    </div>
                    <span>{Math.round(motionScore * 100)}%</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white/40">
                <svg
                  className="w-16 h-16 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p>Click &quot;Start Monitoring&quot; to begin</p>
              </div>
            )}
          </div>

          {/* Audio Monitor */}
          {isStreaming && (
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Audio Level</span>
                <AudioMonitor level={audioLevel} />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Alerts Panel */}
          <AlertPanel alerts={alerts} onAcknowledge={acknowledgeAlert} />

          {/* Stats */}
          {isStreaming && (
            <div className="bg-white/5 rounded-lg p-4">
              <h3 className="text-sm font-medium text-white/80 mb-3">Session Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Stream ID</span>
                  <span className="text-white/80 font-mono text-xs">
                    {streamId?.slice(0, 8)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Motion Score</span>
                  <span className="text-white/80">{Math.round(motionScore * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Audio Level</span>
                  <span className="text-white/80">{Math.round(audioLevel * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Active Alerts</span>
                  <span className="text-white/80">{alerts.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 text-center text-xs text-white/40">
        This is a supplementary monitoring tool. It does NOT replace in-person
        supervision.
      </div>
    </div>
  );
}

