import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Minimal 1:1 voice call hook using WebRTC + Supabase Realtime as signaling.
 *
 * Signaling messages live in `call_signals` table (RLS protected).
 * - kind="ring"   : caller invites callee (no SDP yet, just notify ringing UI)
 * - kind="offer"  : caller SDP after callee accepts
 * - kind="answer" : callee SDP
 * - kind="ice"    : trickle ICE candidates
 * - kind="reject" : callee declined
 * - kind="hangup" : either side ended the call
 */

export type CallStatus =
  | "idle"
  | "ringing-out" // I'm calling, waiting for them
  | "ringing-in"  // they're calling me
  | "connecting"
  | "in-call"
  | "ended";

export type IncomingCall = {
  callId: string;
  fromUserId: string;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export const useVoiceCall = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<CallStatus>("idle");
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);

  /** Send a signal row. */
  const sendSignal = useCallback(
    async (
      cid: string,
      to: string,
      kind: "ring" | "offer" | "answer" | "ice" | "reject" | "hangup",
      payload?: unknown
    ) => {
      if (!user) return;
      const { error } = await supabase.from("call_signals").insert({
        call_id: cid,
        from_user: user.id,
        to_user: to,
        kind,
        payload: (payload ?? null) as never,
      });
      if (error) console.warn("[call] signal send error", error.message);
    },
    [user]
  );

  /** Tear down everything. */
  const cleanup = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => {
      try {
        s.track?.stop();
      } catch {
        /* ignore */
      }
    });
    try {
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    pendingIceRef.current = [];
    remoteSetRef.current = false;
    setMuted(false);
    setStartedAt(null);
  }, []);

  const endCall = useCallback(
    async (notify = true) => {
      if (notify && callId && peerId) {
        await sendSignal(callId, peerId, "hangup");
      }
      cleanup();
      setStatus("ended");
      setPeerId(null);
      setCallId(null);
      // Brief flash of "ended", then back to idle
      window.setTimeout(() => setStatus("idle"), 600);
    },
    [callId, peerId, cleanup, sendSignal]
  );

  /** Build a fresh peer connection wired to handlers. */
  const makePeer = useCallback(
    (cid: string, remoteUserId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal(cid, remoteUserId, "ice", e.candidate.toJSON());
        }
      };
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {});
        }
      };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "connected") {
          setStatus("in-call");
          setStartedAt((v) => v ?? Date.now());
        } else if (s === "failed" || s === "disconnected" || s === "closed") {
          // Don't auto-end on transient disconnects, only on closed/failed
          if (s !== "disconnected") endCall(true);
        }
      };
      pcRef.current = pc;
      return pc;
    },
    [endCall, sendSignal]
  );

  /** Acquire mic. */
  const getLocalStream = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  /** Caller: start ringing the partner. */
  const startCall = useCallback(
    async (partnerUserId: string) => {
      if (!user || status !== "idle") return;
      const cid = crypto.randomUUID();
      setCallId(cid);
      setPeerId(partnerUserId);
      setStatus("ringing-out");
      await sendSignal(cid, partnerUserId, "ring");
    },
    [sendSignal, status, user]
  );

  /** Callee: accept the ringing call — exchange SDP. */
  const acceptCall = useCallback(async () => {
    if (!incoming || !user) return;
    const { callId: cid, fromUserId } = incoming;
    setIncoming(null);
    setCallId(cid);
    setPeerId(fromUserId);
    setStatus("connecting");
    try {
      const stream = await getLocalStream();
      const pc = makePeer(cid, fromUserId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      // Tell caller we accepted by sending an empty "answer-ready" — we use a "ring" reply
      // Caller will create the offer when it sees connection start; simpler: callee sends signal then waits.
      // To keep it simple, callee sends a "ring" back meaning "ready", and caller responds with an offer.
      await sendSignal(cid, fromUserId, "ring", { ack: true });
    } catch (e) {
      console.error("[call] accept failed", e);
      cleanup();
      setStatus("idle");
      setCallId(null);
      setPeerId(null);
    }
  }, [cleanup, getLocalStream, incoming, makePeer, sendSignal, user]);

  const rejectCall = useCallback(async () => {
    if (!incoming) return;
    await sendSignal(incoming.callId, incoming.fromUserId, "reject");
    setIncoming(null);
  }, [incoming, sendSignal]);

  const toggleMute = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  /** Subscribe to incoming signals. */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`call:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
          filter: `to_user=eq.${user.id}`,
        },
        async (payload) => {
          const sig = payload.new as {
            id: string;
            call_id: string;
            from_user: string;
            kind: string;
            payload: unknown;
          };

          // Incoming ring (no current call) -> show ringing-in UI
          if (sig.kind === "ring" && (!sig.payload || (sig.payload as { ack?: boolean }).ack !== true)) {
            // Only if I'm idle
            if (status === "idle" && !incoming) {
              setIncoming({ callId: sig.call_id, fromUserId: sig.from_user });
            }
            return;
          }

          // Caller side: callee acked the ring → create offer
          if (sig.kind === "ring" && (sig.payload as { ack?: boolean })?.ack === true) {
            if (status !== "ringing-out" || sig.call_id !== callId) return;
            setStatus("connecting");
            try {
              const stream = await getLocalStream();
              const pc = makePeer(sig.call_id, sig.from_user);
              stream.getTracks().forEach((t) => pc.addTrack(t, stream));
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              await sendSignal(sig.call_id, sig.from_user, "offer", offer);
            } catch (e) {
              console.error("[call] offer failed", e);
              endCall(true);
            }
            return;
          }

          // Callee side: receive offer → answer
          if (sig.kind === "offer") {
            const pc = pcRef.current;
            if (!pc || sig.call_id !== callId) return;
            try {
              await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit);
              remoteSetRef.current = true;
              // Drain any queued ICE
              for (const c of pendingIceRef.current) {
                await pc.addIceCandidate(c).catch(() => {});
              }
              pendingIceRef.current = [];
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await sendSignal(sig.call_id, sig.from_user, "answer", answer);
            } catch (e) {
              console.error("[call] answer failed", e);
              endCall(true);
            }
            return;
          }

          // Caller side: receive answer
          if (sig.kind === "answer") {
            const pc = pcRef.current;
            if (!pc || sig.call_id !== callId) return;
            try {
              await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit);
              remoteSetRef.current = true;
              for (const c of pendingIceRef.current) {
                await pc.addIceCandidate(c).catch(() => {});
              }
              pendingIceRef.current = [];
            } catch (e) {
              console.error("[call] set answer failed", e);
            }
            return;
          }

          // ICE candidate from peer
          if (sig.kind === "ice") {
            const pc = pcRef.current;
            const cand = sig.payload as RTCIceCandidateInit;
            if (!pc) return;
            if (!remoteSetRef.current) {
              pendingIceRef.current.push(cand);
            } else {
              await pc.addIceCandidate(cand).catch(() => {});
            }
            return;
          }

          if (sig.kind === "reject") {
            if (callId === sig.call_id) {
              cleanup();
              setStatus("ended");
              setPeerId(null);
              setCallId(null);
              window.setTimeout(() => setStatus("idle"), 800);
            }
            return;
          }

          if (sig.kind === "hangup") {
            if (callId === sig.call_id || incoming?.callId === sig.call_id) {
              setIncoming(null);
              cleanup();
              setStatus("ended");
              setPeerId(null);
              setCallId(null);
              window.setTimeout(() => setStatus("idle"), 800);
            }
            return;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, status, callId, incoming, cleanup, endCall, getLocalStream, makePeer, sendSignal]);

  return {
    status,
    incoming,
    peerId,
    muted,
    startedAt,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  };
};
