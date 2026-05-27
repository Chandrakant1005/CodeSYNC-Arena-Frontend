import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import VideoPanel from "../components/VideoPanel";
import ParticipantList from "../components/ParticipantList";
import ChatPanel from "../components/ChatPanel";
import api from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuth } from "../context/AuthContext";

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

export default function MeetingRoomPage() {
  const navigate = useNavigate();
  const { identifier } = useParams();
  const { user, token } = useAuth();
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [whiteboardVisible, setWhiteboardVisible] = useState(false);
  const [whiteboardRequestPending, setWhiteboardRequestPending] = useState(false);
  const [whiteboardStrokes, setWhiteboardStrokes] = useState([]);
  const [canGuestsDraw, setCanGuestsDraw] = useState(false);
  const [codeEditorVisible, setCodeEditorVisible] = useState(false);
  const [codeEditorRequestPending, setCodeEditorRequestPending] = useState(false);
  const [codeEditorContent, setCodeEditorContent] = useState("");
  const [codeEditorLanguage, setCodeEditorLanguage] = useState("javascript");
  const [canGuestsEditCode, setCanGuestsEditCode] = useState(false);
  const [codeEditorTestCases, setCodeEditorTestCases] = useState("[]");
  const [codeEditorValidationScript, setCodeEditorValidationScript] = useState("");
  const [codeEditorUpdatedAt, setCodeEditorUpdatedAt] = useState(null);
  const [codeEditorUpdatedBy, setCodeEditorUpdatedBy] = useState(null);
  const [selectedMainId, setSelectedMainId] = useState("auto");
  const [copyFeedback, setCopyFeedback] = useState("Copy join URL");
  const peerConnectionsRef = useRef(new Map());
  const pendingIceCandidatesRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const joinedRoomRef = useRef(false);
  const isOwner = meeting?.owner.id === user?.id;
  const canCurrentUserDraw = isOwner || canGuestsDraw;
  const canCurrentUserEditCode = isOwner || canGuestsEditCode;
  const participantTiles = useMemo(() => {
    const remoteStreamMap = new Map(remoteStreams.map((item) => [item.socketId, item.stream]));

    const rosterTiles = participants.map((participant) => ({
      id: participant.socketId,
      label: participant.user.fullName,
      isLocal: participant.user.id === user?.id,
      stream:
        participant.user.id === user?.id
          ? localStream
          : remoteStreamMap.get(participant.socketId) || null
    }));

    const hasLocalTile = rosterTiles.some((item) => item.isLocal);
    if (!hasLocalTile && user) {
      rosterTiles.unshift({
        id: "local",
        label: user.fullName || "You",
        isLocal: true,
        stream: localStream
      });
    }

    return rosterTiles.map((tile) => ({
      ...tile,
      id: tile.isLocal ? "local" : tile.id
    }));
  }, [localStream, participants, remoteStreams, user]);
  const selectedMainStream = useMemo(() => {
    if (selectedMainId === "auto") {
      const firstRemote = participantTiles.find((tile) => !tile.isLocal);
      if (firstRemote) {
        return {
          id: firstRemote.id,
          label: firstRemote.label,
          type: "remote",
          stream: firstRemote.stream
        };
      }
    }

    const selectedTile = participantTiles.find((tile) => tile.id === selectedMainId);
    if (selectedTile) {
      return {
        id: selectedTile.id,
        label: selectedTile.label,
        type: selectedTile.isLocal ? "local" : "remote",
        stream: selectedTile.stream
      };
    }

    return {
      id: "local",
      label: user?.fullName || "You",
      type: "local",
      stream: localStream
    };
  }, [localStream, participantTiles, selectedMainId, user?.fullName]);

  const joinUrl = useMemo(
    () => `${window.location.origin}/meeting/${meeting?.roomSlug || identifier}`,
    [identifier, meeting?.roomSlug]
  );

  useEffect(() => {
    if (copyFeedback === "Copy join URL") {
      return;
    }

    const timer = window.setTimeout(() => setCopyFeedback("Copy join URL"), 1800);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  async function requestLocalMedia() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotifications((current) => [
        {
          id: `media-unsupported-${Date.now()}`,
          title: "Camera unavailable",
          message: "This browser does not support camera and microphone access."
        },
        ...current
      ]);
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = stream;
      setLocalStream(stream);
      setAudioEnabled(true);
      setVideoEnabled(true);
      return stream;
    } catch (_error) {
      setNotifications((current) => [
        {
          id: `media-${Date.now()}`,
          title: "Camera access blocked",
          message: "Allow camera and microphone access to start video calling."
        },
        ...current
      ]);
      return null;
    }
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    api
      .get(`/meetings/${identifier}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((response) => {
        setMeeting(response.data.meeting);
        setParticipants(
          response.data.participants
            .filter((entry) => entry.isActive)
            .map((entry) => ({
              user: entry.user,
              socketId: entry.id,
              joinedAt: entry.joinedAt
            }))
        );
      })
      .catch(() => navigate("/dashboard"));
  }, [identifier, navigate, token]);

  useEffect(() => {
    let active = true;

    async function setupMedia() {
      const stream = await requestLocalMedia();
      if (!active && stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    }

    setupMedia();

    return () => {
      active = false;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    };
  }, []);

  function upsertRemoteStream(socketId, stream, peerUser) {
    setRemoteStreams((current) => {
      const existing = current.find((item) => item.socketId === socketId);
      if (existing) {
        return current.map((item) =>
          item.socketId === socketId ? { ...item, stream, user: peerUser || item.user } : item
        );
      }

      return [...current, { socketId, stream, user: peerUser }];
    });
  }

  function removePeer(socketId) {
    const connection = peerConnectionsRef.current.get(socketId);
    if (connection) {
      connection.close();
      peerConnectionsRef.current.delete(socketId);
    }

    pendingIceCandidatesRef.current.delete(socketId);
    setRemoteStreams((current) => current.filter((item) => item.socketId !== socketId));
    setSelectedMainId((current) => (current === socketId ? "auto" : current));
  }

  function createPeerConnection(socket, peerSocketId, peerUser) {
    const existing = peerConnectionsRef.current.get(peerSocketId);
    if (existing) {
      return existing;
    }

    const peerConnection = new RTCPeerConnection(rtcConfig);

    localStreamRef.current?.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStreamRef.current);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc:ice-candidate", {
          target: peerSocketId,
          candidate: event.candidate
        });
      }
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        upsertRemoteStream(peerSocketId, stream, peerUser);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(peerConnection.connectionState)) {
        removePeer(peerSocketId);
      }
    };

    peerConnectionsRef.current.set(peerSocketId, peerConnection);
    return peerConnection;
  }

  useEffect(() => {
    if (!meeting || !user) {
      return;
    }

    const socket = getSocket();
    const sessionId = window.localStorage.getItem("meeting_token") || `${user.id}`;

    const handleRoster = (roster) => setParticipants(roster);
    const handleChat = (entry) => setMessages((current) => [...current, entry]);
    const handleOwnerPrompt = (prompt) => {
      if (prompt.ownerId !== user.id) {
        return;
      }

      if (prompt.type !== "whiteboard-request" && prompt.member.id === user.id) {
        return;
      }

      if (prompt.type === "whiteboard-request") {
        setNotifications((current) => [
          {
            id: `whiteboard-request-${prompt.member.id}-${prompt.createdAt}`,
            type: "whiteboard-request",
            title: "Whiteboard access request",
            message: `${prompt.member.fullName} requested to open the whiteboard for this meeting.`,
            requesterId: prompt.member.id
          },
          ...current
        ]);
        return;
      }

      if (prompt.type === "code-editor-request") {
        setNotifications((current) => [
          {
            id: `code-editor-request-${prompt.member.id}-${prompt.createdAt}`,
            type: "code-editor-request",
            title: "Code editor access request",
            message: `${prompt.member.fullName} requested to open the live code editor for this meeting.`,
            requesterId: prompt.member.id
          },
          ...current
        ]);
        return;
      }

      setNotifications((current) => [
        {
          id: `${prompt.type}-${prompt.member.id}-${prompt.createdAt}`,
          title: prompt.type === "join" ? "Participant joined" : "Participant left",
          message:
            prompt.type === "join"
              ? `${prompt.member.fullName} joined your meeting.`
              : `${prompt.member.fullName} left your meeting.`
        },
        ...current
      ]);
    };

    const handleJoined = ({ peers }) => {
      for (const peer of peers) {
        createPeerConnection(socket, peer.socketId, peer.user);
      }
    };

    const handlePeerJoined = async ({ socketId, user: peerUser }) => {
      const peerConnection = createPeerConnection(socket, socketId, peerUser);
      if (peerConnection.signalingState !== "stable") {
        return;
      }

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit("webrtc:offer", {
        target: socketId,
        offer,
        caller: {
          socketId: socket.id,
          user
        }
      });
    };

    const handleOffer = async ({ source, offer, caller }) => {
      const peerConnection = createPeerConnection(socket, source, caller?.user);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const queuedCandidates = pendingIceCandidatesRef.current.get(source) || [];
      for (const candidate of queuedCandidates) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingIceCandidatesRef.current.delete(source);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("webrtc:answer", {
        target: source,
        answer,
        responder: {
          socketId: socket.id,
          user
        }
      });
    };

    const handleAnswer = async ({ source, answer, responder }) => {
      const peerConnection = createPeerConnection(socket, source, responder?.user);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      const queuedCandidates = pendingIceCandidatesRef.current.get(source) || [];
      for (const candidate of queuedCandidates) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingIceCandidatesRef.current.delete(source);
    };

    const handleIceCandidate = async ({ source, candidate }) => {
      const peerConnection = peerConnectionsRef.current.get(source);
      if (!peerConnection || !candidate) {
        return;
      }

      if (!peerConnection.remoteDescription) {
        const queued = pendingIceCandidatesRef.current.get(source) || [];
        queued.push(candidate);
        pendingIceCandidatesRef.current.set(source, queued);
        return;
      }

      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (_error) {
        // Ignore ICE candidates that arrive after a peer disconnects.
      }
    };

    const handlePeerLeft = ({ socketId }) => {
      removePeer(socketId);
    };

    const handleWhiteboardInit = ({ visible, strokes, canGuestsDraw: nextCanGuestsDraw }) => {
      setWhiteboardVisible(Boolean(visible));
      setWhiteboardStrokes(Array.isArray(strokes) ? strokes : []);
      setCanGuestsDraw(Boolean(nextCanGuestsDraw));
    };

    const handleWhiteboardVisibility = ({ visible, approvedRequesterId }) => {
      setWhiteboardVisible(Boolean(visible));
      if (!visible) {
        setWhiteboardRequestPending(false);
        return;
      }

      if (approvedRequesterId === user.id || isOwner) {
        setWhiteboardRequestPending(false);
      }
    };

    const handleWhiteboardPermission = ({ canGuestsDraw: nextCanGuestsDraw }) => {
      setCanGuestsDraw(Boolean(nextCanGuestsDraw));
    };

    const handleWhiteboardClear = () => {
      setWhiteboardStrokes([]);
    };

    const handleWhiteboardStrokeStart = ({ stroke }) => {
      setWhiteboardStrokes((current) => [...current, stroke]);
    };

    const handleWhiteboardStrokePoint = ({ strokeId, point }) => {
      setWhiteboardStrokes((current) =>
        current.map((stroke) =>
          stroke.id === strokeId ? { ...stroke, points: [...stroke.points, point] } : stroke
        )
      );
    };

    const handleWhiteboardStrokeEnd = ({ strokeId }) => {
      setWhiteboardStrokes((current) =>
        current.map((stroke) =>
          stroke.id === strokeId ? { ...stroke, completed: true } : stroke
        )
      );
    };

    const handleCodeEditorInit = ({
      visible,
      canGuestsEdit: nextCanGuestsEdit,
      language,
      content,
      testCases,
      validationScript,
      updatedAt,
      updatedBy
    }) => {
      setCodeEditorVisible(Boolean(visible));
      setCanGuestsEditCode(Boolean(nextCanGuestsEdit));
      setCodeEditorLanguage(language || "javascript");
      setCodeEditorContent(typeof content === "string" ? content : "");
      setCodeEditorTestCases(typeof testCases === "string" ? testCases : "[]");
      setCodeEditorValidationScript(
        typeof validationScript === "string" ? validationScript : ""
      );
      setCodeEditorUpdatedAt(updatedAt || null);
      setCodeEditorUpdatedBy(updatedBy || null);
    };

    const handleCodeEditorVisibility = ({ visible, approvedRequesterId }) => {
      setCodeEditorVisible(Boolean(visible));
      if (!visible) {
        setCodeEditorRequestPending(false);
        return;
      }

      if (approvedRequesterId === user.id || isOwner) {
        setCodeEditorRequestPending(false);
      }
    };

    const handleCodeEditorPermission = ({ canGuestsEdit: nextCanGuestsEdit }) => {
      setCanGuestsEditCode(Boolean(nextCanGuestsEdit));
    };

    const handleCodeEditorUpdate = ({
      content,
      language,
      testCases,
      validationScript,
      updatedAt,
      updatedBy
    }) => {
      if (typeof content === "string") {
        setCodeEditorContent(content);
      }

      if (language) {
        setCodeEditorLanguage(language);
      }

      if (typeof testCases === "string") {
        setCodeEditorTestCases(testCases);
      }

      if (typeof validationScript === "string") {
        setCodeEditorValidationScript(validationScript);
      }

      setCodeEditorUpdatedAt(updatedAt || new Date().toISOString());
      setCodeEditorUpdatedBy(updatedBy || null);
    };

    const handleCodeEditorTestConfig = ({
      testCases,
      validationScript,
      updatedAt,
      updatedBy
    }) => {
      if (typeof testCases === "string") {
        setCodeEditorTestCases(testCases);
      }

      if (typeof validationScript === "string") {
        setCodeEditorValidationScript(validationScript);
      }

      setCodeEditorUpdatedAt(updatedAt || new Date().toISOString());
      setCodeEditorUpdatedBy(updatedBy || null);
    };

    socket.on("meeting:roster", handleRoster);
    socket.on("meeting:chat", handleChat);
    socket.on("meeting:ownerPrompt", handleOwnerPrompt);
    socket.on("meeting:joined", handleJoined);
    socket.on("meeting:peer-joined", handlePeerJoined);
    socket.on("meeting:peer-left", handlePeerLeft);
    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);
    socket.on("whiteboard:init", handleWhiteboardInit);
    socket.on("whiteboard:visibility", handleWhiteboardVisibility);
    socket.on("whiteboard:permission", handleWhiteboardPermission);
    socket.on("whiteboard:clear", handleWhiteboardClear);
    socket.on("whiteboard:stroke-start", handleWhiteboardStrokeStart);
    socket.on("whiteboard:stroke-point", handleWhiteboardStrokePoint);
    socket.on("whiteboard:stroke-end", handleWhiteboardStrokeEnd);
    socket.on("code-editor:init", handleCodeEditorInit);
    socket.on("code-editor:visibility", handleCodeEditorVisibility);
    socket.on("code-editor:permission", handleCodeEditorPermission);
    socket.on("code-editor:update", handleCodeEditorUpdate);
    socket.on("code-editor:test-config", handleCodeEditorTestConfig);

    if (!joinedRoomRef.current) {
      socket.emit("meeting:join", { identifier: meeting.roomSlug, user, sessionId });
      joinedRoomRef.current = true;
    }

    return () => {
      socket.emit("meeting:leave");
      joinedRoomRef.current = false;
      socket.off("meeting:roster", handleRoster);
      socket.off("meeting:chat", handleChat);
      socket.off("meeting:ownerPrompt", handleOwnerPrompt);
      socket.off("meeting:joined", handleJoined);
      socket.off("meeting:peer-joined", handlePeerJoined);
      socket.off("meeting:peer-left", handlePeerLeft);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
      socket.off("whiteboard:init", handleWhiteboardInit);
      socket.off("whiteboard:visibility", handleWhiteboardVisibility);
      socket.off("whiteboard:permission", handleWhiteboardPermission);
      socket.off("whiteboard:clear", handleWhiteboardClear);
      socket.off("whiteboard:stroke-start", handleWhiteboardStrokeStart);
      socket.off("whiteboard:stroke-point", handleWhiteboardStrokePoint);
      socket.off("whiteboard:stroke-end", handleWhiteboardStrokeEnd);
      socket.off("code-editor:init", handleCodeEditorInit);
      socket.off("code-editor:visibility", handleCodeEditorVisibility);
      socket.off("code-editor:permission", handleCodeEditorPermission);
      socket.off("code-editor:update", handleCodeEditorUpdate);
      socket.off("code-editor:test-config", handleCodeEditorTestConfig);
      peerConnectionsRef.current.forEach((connection) => connection.close());
      peerConnectionsRef.current.clear();
      pendingIceCandidatesRef.current.clear();
      setRemoteStreams([]);
    };
  }, [meeting, user]);

  useEffect(() => {
    if (!localStream) {
      return;
    }

    const socket = getSocket();

    async function syncTracksToPeers() {
      for (const [peerSocketId, peerConnection] of peerConnectionsRef.current.entries()) {
        const senders = peerConnection.getSenders();

        localStream.getTracks().forEach((track) => {
          const existingSender = senders.find((sender) => sender.track?.kind === track.kind);
          if (existingSender) {
            existingSender.replaceTrack(track);
          } else {
            peerConnection.addTrack(track, localStream);
          }
        });

        if (peerConnection.signalingState === "stable") {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          socket.emit("webrtc:offer", {
            target: peerSocketId,
            offer,
            caller: {
              socketId: socket.id,
              user
            }
          });
        }
      }
    }

    syncTracksToPeers();
  }, [localStream, user]);

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!draftMessage.trim() || !meeting) {
      return;
    }

    const socket = getSocket();
    socket.emit("meeting:sendMessage", {
      identifier: meeting.roomSlug,
      message: draftMessage.trim(),
      user
    });
    setDraftMessage("");
  }

  async function handleEndMeeting() {
    if (!meeting || !isOwner) {
      navigate("/dashboard");
      return;
    }

    await api.patch(
      `/meetings/${meeting.roomSlug}/end`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    navigate("/dashboard");
  }

  function handleWhiteboardPermissionChange(nextValue) {
    const socket = getSocket();
    socket.emit("whiteboard:permission", { canGuestsDraw: nextValue });
    setCanGuestsDraw(nextValue);
  }

  function handleCodeEditorPermissionChange(nextValue) {
    const socket = getSocket();
    socket.emit("code-editor:permission", { canGuestsEdit: nextValue });
    setCanGuestsEditCode(nextValue);
  }

  function handleWhiteboardToggle() {
    const socket = getSocket();

    if (isOwner) {
      const nextVisible = !whiteboardVisible;
      setWhiteboardVisible(nextVisible);
      socket.emit("whiteboard:toggle-visible", { visible: nextVisible });
      return;
    }

    if (whiteboardVisible || whiteboardRequestPending) {
      return;
    }

    setWhiteboardRequestPending(true);
    setNotifications((current) => [
      {
        id: `whiteboard-requested-${Date.now()}`,
        title: "Whiteboard request sent",
        message: "The meeting owner has been asked to open the whiteboard."
      },
      ...current
    ]);
    socket.emit("whiteboard:request-open");
  }

  function handleCodeEditorToggle() {
    const socket = getSocket();

    if (isOwner) {
      const nextVisible = !codeEditorVisible;
      setCodeEditorVisible(nextVisible);
      if (nextVisible) {
        setWhiteboardVisible(false);
      }
      socket.emit("code-editor:toggle-visible", { visible: nextVisible });
      return;
    }

    if (codeEditorVisible || codeEditorRequestPending) {
      return;
    }

    setCodeEditorRequestPending(true);
    setNotifications((current) => [
      {
        id: `code-editor-requested-${Date.now()}`,
        title: "Code editor request sent",
        message: "The meeting owner has been asked to open the live code editor."
      },
      ...current
    ]);
    socket.emit("code-editor:request-open");
  }

  function handleApproveWhiteboardRequest(requesterId) {
    const socket = getSocket();
    setWhiteboardVisible(true);
    setCodeEditorVisible(false);
    setNotifications((current) =>
      current.filter(
        (notification) =>
          !(notification.type === "whiteboard-request" && notification.requesterId === requesterId)
      )
    );
    socket.emit("whiteboard:approve-request", { requesterId });
  }

  function handleApproveCodeEditorRequest(requesterId) {
    const socket = getSocket();
    setCodeEditorVisible(true);
    setWhiteboardVisible(false);
    setNotifications((current) =>
      current.filter(
        (notification) =>
          !(notification.type === "code-editor-request" && notification.requesterId === requesterId)
      )
    );
    socket.emit("code-editor:approve-request", { requesterId });
  }

  useEffect(() => {
    if (
      selectedMainId !== "auto" &&
      selectedMainId !== "local" &&
      !participantTiles.some((item) => item.id === selectedMainId)
    ) {
      setSelectedMainId(participantTiles.some((item) => !item.isLocal) ? "auto" : "local");
    }
  }, [participantTiles, selectedMainId]);

  function handleWhiteboardClear() {
    const socket = getSocket();
    socket.emit("whiteboard:clear");
    setWhiteboardStrokes([]);
  }

  function handleWhiteboardStrokeStart(stroke) {
    const socket = getSocket();
    setWhiteboardStrokes((current) => [...current, stroke]);
    socket.emit("whiteboard:stroke-start", { stroke });
  }

  function handleWhiteboardStrokePoint(strokeId, point) {
    const socket = getSocket();
    setWhiteboardStrokes((current) =>
      current.map((stroke) =>
        stroke.id === strokeId ? { ...stroke, points: [...stroke.points, point] } : stroke
      )
    );
    socket.emit("whiteboard:stroke-point", { strokeId, point });
  }

  function handleWhiteboardStrokeEnd(strokeId) {
    const socket = getSocket();
    setWhiteboardStrokes((current) =>
      current.map((stroke) =>
        stroke.id === strokeId ? { ...stroke, completed: true } : stroke
      )
    );
    socket.emit("whiteboard:stroke-end", { strokeId });
  }

  function handleCodeEditorUpdate(nextContent, nextLanguage = codeEditorLanguage) {
    const socket = getSocket();
    const timestamp = new Date().toISOString();
    setCodeEditorContent(nextContent);
    setCodeEditorLanguage(nextLanguage);
    setCodeEditorUpdatedAt(timestamp);
    setCodeEditorUpdatedBy(user?.fullName || null);
    socket.emit("code-editor:update", {
      content: nextContent,
      language: nextLanguage
    });
  }

  function handleCodeEditorContentChange(nextContent) {
    handleCodeEditorUpdate(nextContent, codeEditorLanguage);
  }

  function handleCodeEditorLanguageChange(nextLanguage) {
    handleCodeEditorUpdate(codeEditorContent, nextLanguage);
  }

  function handleCodeEditorReset() {
    const socket = getSocket();
    socket.emit("code-editor:reset");
  }

  function handleCodeEditorTestCasesChange(nextTestCases) {
    if (!isOwner) {
      return;
    }

    const socket = getSocket();
    const timestamp = new Date().toISOString();
    setCodeEditorTestCases(nextTestCases);
    setCodeEditorUpdatedAt(timestamp);
    setCodeEditorUpdatedBy(user?.fullName || null);
    socket.emit("code-editor:test-config", {
      testCases: nextTestCases
    });
  }

  function handleCodeEditorValidationScriptChange(nextValidationScript) {
    if (!isOwner) {
      return;
    }

    const socket = getSocket();
    const timestamp = new Date().toISOString();
    setCodeEditorValidationScript(nextValidationScript);
    setCodeEditorUpdatedAt(timestamp);
    setCodeEditorUpdatedBy(user?.fullName || null);
    socket.emit("code-editor:test-config", {
      validationScript: nextValidationScript
    });
  }

  function handleToggleAudio() {
    if (!localStreamRef.current) {
      requestLocalMedia();
      return;
    }

    const nextEnabled = !audioEnabled;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setAudioEnabled(nextEnabled);
  }

  function handleToggleVideo() {
    if (!localStreamRef.current) {
      requestLocalMedia();
      return;
    }

    const nextEnabled = !videoEnabled;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setVideoEnabled(nextEnabled);
  }

  async function handleShareScreen() {
    if (!localStreamRef.current) {
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = displayStream.getVideoTracks()[0];

      peerConnectionsRef.current.forEach((peerConnection) => {
        const sender = peerConnection.getSenders().find((item) => item.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      const [cameraTrack] = localStreamRef.current.getVideoTracks();
      const updatedStream = new MediaStream([
        screenTrack,
        ...localStreamRef.current.getAudioTracks()
      ]);
      localStreamRef.current = updatedStream;
      setLocalStream(updatedStream);
      setVideoEnabled(true);

      screenTrack.onended = () => {
        if (!cameraTrack) {
          return;
        }

        const restoredStream = new MediaStream([
          cameraTrack,
          ...updatedStream.getAudioTracks()
        ]);
        localStreamRef.current = restoredStream;
        setLocalStream(restoredStream);
        peerConnectionsRef.current.forEach((peerConnection) => {
          const sender = peerConnection.getSenders().find((item) => item.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(cameraTrack);
          }
        });
      };
    } catch (_error) {
      setNotifications((current) => [
        {
          id: `share-${Date.now()}`,
          title: "Screen share unavailable",
          message: "Your browser blocked screen sharing for this meeting."
        },
        ...current
      ]);
    }
  }

  if (!meeting) {
    return <div className="page-shell centered-shell">Loading meeting room...</div>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="meeting-room">
        <section className="meeting-stage">
          <div className="room-header">
            <div>
              <p className="eyebrow">CodeSYNC Arena</p>
              <h1>{meeting.title}</h1>
            </div>
            <div className="room-header-actions">
              <span className="share-pill">{meeting.meetingId}</span>
              <button
                type="button"
                className="secondary-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(joinUrl);
                    setCopyFeedback("Copied");
                  } catch (_error) {
                    setCopyFeedback("Copy failed");
                  }
                }}
              >
                {copyFeedback}
              </button>
              <button
                type="button"
                className={isOwner ? "danger-button" : "secondary-button"}
                onClick={async () => {
                  if (isOwner) {
                    await handleEndMeeting();
                    return;
                  }

                  getSocket().emit("meeting:leave");
                  navigate("/dashboard");
                }}
              >
                {isOwner ? "End meeting" : "Leave room"}
              </button>
            </div>
          </div>

          <div className="room-grid">
            <div className="meeting-main-column">
              <VideoPanel
                currentUser={user}
                meeting={meeting}
                onLeave={async () => {
                  if (isOwner) {
                    await handleEndMeeting();
                    return;
                  }

                  getSocket().emit("meeting:leave");
                  navigate("/dashboard");
                }}
                localStream={localStream}
                remoteStreams={remoteStreams}
                participantTiles={participantTiles}
                audioEnabled={audioEnabled}
                videoEnabled={videoEnabled}
                whiteboardVisible={whiteboardVisible}
                whiteboardPending={whiteboardRequestPending}
                codeEditorVisible={codeEditorVisible}
                codeEditorPending={codeEditorRequestPending}
                isOwner={isOwner}
                selectedMainStream={selectedMainStream}
                selectedMainId={selectedMainId === "auto" ? selectedMainStream.id : selectedMainId}
                onSelectParticipant={setSelectedMainId}
                onToggleAudio={handleToggleAudio}
                onToggleVideo={handleToggleVideo}
                onShareScreen={handleShareScreen}
                onWhiteboardClick={handleWhiteboardToggle}
                onCodeEditorClick={handleCodeEditorToggle}
                whiteboardProps={{
                  strokes: whiteboardStrokes,
                  canCurrentUserDraw,
                  canGuestsDraw,
                  isOwner,
                  onToggleGuestsDrawing: handleWhiteboardPermissionChange,
                  onClearBoard: handleWhiteboardClear,
                  onStartStroke: handleWhiteboardStrokeStart,
                  onAppendStrokePoint: handleWhiteboardStrokePoint,
                  onEndStroke: handleWhiteboardStrokeEnd
                }}
                codeEditorProps={{
                  content: codeEditorContent,
                  language: codeEditorLanguage,
                  testCases: codeEditorTestCases,
                  validationScript: codeEditorValidationScript,
                  isOwner,
                  canCurrentUserEdit: canCurrentUserEditCode,
                  canGuestsEdit: canGuestsEditCode,
                  updatedAt: codeEditorUpdatedAt,
                  updatedBy: codeEditorUpdatedBy,
                  onToggleGuestsEditing: handleCodeEditorPermissionChange,
                  onResetEditor: handleCodeEditorReset,
                  onChangeLanguage: handleCodeEditorLanguageChange,
                  onChangeContent: handleCodeEditorContentChange,
                  onChangeTestCases: handleCodeEditorTestCasesChange,
                  onChangeValidationScript: handleCodeEditorValidationScriptChange
                }}
              />
            </div>

            <div className="room-sidebar">
              <ParticipantList participants={participants} ownerId={meeting.owner.id} />
              <ChatPanel
                messages={messages}
                draftMessage={draftMessage}
                setDraftMessage={setDraftMessage}
                onSend={handleSendMessage}
                notifications={notifications}
                onApproveWhiteboardRequest={handleApproveWhiteboardRequest}
                onApproveCodeEditorRequest={handleApproveCodeEditorRequest}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
