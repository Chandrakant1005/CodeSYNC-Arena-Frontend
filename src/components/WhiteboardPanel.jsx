import { useEffect, useMemo, useRef, useState } from "react";
import { FiEdit3, FiRefreshCcw, FiSlash } from "react-icons/fi";

function drawStroke(ctx, stroke, width, height) {
  if (!stroke?.points?.length) {
    return;
  }

  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  stroke.points.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    ctx.arc(point.x * width, point.y * height, stroke.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

export default function WhiteboardPanel({
  strokes,
  canCurrentUserDraw,
  canGuestsDraw,
  isOwner,
  embedded = false,
  onToggleGuestsDrawing,
  onClearBoard,
  onStartStroke,
  onAppendStrokePoint,
  onEndStroke
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const activeStrokeRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const statusCopy = useMemo(() => {
    if (isOwner) {
      return canGuestsDraw ? "Everyone can draw" : "Only you can draw";
    }

    return canCurrentUserDraw ? "Drawing enabled by owner" : "Read-only board";
  }, [canCurrentUserDraw, canGuestsDraw, isOwner]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      setCanvasSize({
        width: Math.max(Math.floor(width), 1),
        height: Math.max(Math.floor(height), 1)
      });
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasSize.width || !canvasSize.height) {
      return;
    }

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach((stroke) => drawStroke(ctx, stroke, canvas.width, canvas.height));
  }, [canvasSize, strokes]);

  function getNormalizedPoint(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1)
    };
  }

  function handlePointerDown(event) {
    if (!canCurrentUserDraw) {
      return;
    }

    const point = getNormalizedPoint(event);
    const strokeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeStrokeRef.current = strokeId;
    onStartStroke({
      id: strokeId,
      color: "#232844",
      size: 3,
      points: [point]
    });
  }

  function handlePointerMove(event) {
    if (!activeStrokeRef.current || !canCurrentUserDraw) {
      return;
    }

    onAppendStrokePoint(activeStrokeRef.current, getNormalizedPoint(event));
  }

  function finishStroke() {
    if (!activeStrokeRef.current) {
      return;
    }

    onEndStroke(activeStrokeRef.current);
    activeStrokeRef.current = null;
  }

  const wrapperClass = embedded ? "whiteboard-panel whiteboard-panel-embedded" : "whiteboard-panel";

  return (
    <section className={wrapperClass}>
      <div className="whiteboard-header">
        <div>
          <p className="eyebrow">Whiteboard</p>
          <h3>Collaborative sketch space</h3>
          <p className="whiteboard-status">{statusCopy}</p>
        </div>
        <div className="whiteboard-actions">
          {isOwner ? (
            <button
              type="button"
              className={`whiteboard-toggle ${canGuestsDraw ? "active" : ""}`.trim()}
              onClick={() => onToggleGuestsDrawing(!canGuestsDraw)}
            >
              {canGuestsDraw ? <FiEdit3 /> : <FiSlash />}
              <span>{canGuestsDraw ? "Guests can draw" : "Lock drawing"}</span>
            </button>
          ) : null}
          {isOwner ? (
            <button type="button" className="whiteboard-clear" onClick={onClearBoard}>
              <FiRefreshCcw />
              <span>Clear</span>
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={containerRef}
        className={`whiteboard-canvas-shell ${canCurrentUserDraw ? "editable" : "readonly"}`.trim()}
      >
        <canvas
          ref={canvasRef}
          className="whiteboard-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerLeave={finishStroke}
        />
        {!canCurrentUserDraw ? (
          <div className="whiteboard-readonly-banner">Waiting for owner to enable drawing</div>
        ) : null}
      </div>
    </section>
  );
}
