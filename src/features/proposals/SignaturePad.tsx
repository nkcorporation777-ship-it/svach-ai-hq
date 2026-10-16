import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, PointerEvent } from "react"
import { Button } from "@/components/ui/button"

const WIDTH = 600
const HEIGHT = 200
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

type Mode = "draw" | "upload"

/** Signature capture for the public proposal page — the client either draws
 * with a mouse/finger or uploads an image of their signature. Either way it's
 * normalised onto one fixed-size white canvas, so what gets stored is always a
 * small, same-shaped image (drawn → PNG, uploaded → JPEG, which keeps photos
 * of a signature small). Reports a data URL via onChange, or null when empty. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [mode, setMode] = useState<Mode>("draw")
  const [hasInk, setHasInk] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  function paintBlank() {
    const c = canvasRef.current!.getContext("2d")!
    c.fillStyle = "#ffffff"
    c.fillRect(0, 0, WIDTH, HEIGHT)
  }

  useEffect(() => {
    paintBlank()
  }, [])

  function clear() {
    paintBlank()
    setHasInk(false)
    setUploadError(null)
    onChange(null)
  }

  function switchMode(next: Mode) {
    if (next === mode) return
    setMode(next)
    clear()
  }

  function point(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (WIDTH / rect.width),
      y: (e.clientY - rect.top) * (HEIGHT / rect.height),
    }
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (mode !== "draw") return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const { x, y } = point(e)
    const c = canvasRef.current!.getContext("2d")!
    c.lineWidth = 2.5
    c.lineCap = "round"
    c.lineJoin = "round"
    c.strokeStyle = "#111111"
    c.beginPath()
    c.moveTo(x, y)
    c.lineTo(x + 0.01, y)
    c.stroke()
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const { x, y } = point(e)
    const c = canvasRef.current!.getContext("2d")!
    c.lineTo(x, y)
    c.stroke()
  }

  function endStroke() {
    if (!drawing.current) return
    drawing.current = false
    setHasInk(true)
    onChange(canvasRef.current!.toDataURL("image/png"))
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploadError(null)
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setUploadError("Please choose a PNG or JPG image.")
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("That image is too large — please use one under 5 MB.")
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      paintBlank()
      const c = canvasRef.current!.getContext("2d")!
      const scale = Math.min(WIDTH / img.width, HEIGHT / img.height)
      const w = img.width * scale
      const h = img.height * scale
      c.drawImage(img, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h)
      URL.revokeObjectURL(url)
      setHasInk(true)
      onChange(canvasRef.current!.toDataURL("image/jpeg", 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setUploadError("We couldn't read that image — please try another.")
    }
    img.src = url
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "draw" ? "default" : "ghost"}
          onClick={() => switchMode("draw")}
        >
          Draw
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "upload" ? "default" : "ghost"}
          onClick={() => switchMode("upload")}
        >
          Upload image
        </Button>
        {hasInk && (
          <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={clear}>
            Clear
          </Button>
        )}
      </div>

      {mode === "upload" && (
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={onFile}
          className="text-sm text-muted-foreground"
        />
      )}

      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        className="w-full touch-none rounded-md border border-border bg-white"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}`, cursor: mode === "draw" ? "crosshair" : "default" }}
      />
      <p className="text-xs text-muted-foreground">
        {mode === "draw"
          ? "Sign inside the box using your mouse or finger."
          : "Upload a clear photo or scan of your signature on a plain background."}
      </p>
      {uploadError && <p className="text-xs text-status-error">{uploadError}</p>}
    </div>
  )
}
