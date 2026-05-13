import { useState, type FormEvent } from "react";

export interface MemeSubmission {
  title: string;
  caption: string;
  file: File | null;
  tags: string[];
}

export interface MemeFormProps {
  onSubmit?: (submission: MemeSubmission) => Promise<void> | void;
  maxFileSizeMB?: number;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/**
 * Pixel-art meme submission form. Validates file type/size client-side; the
 * upload/moderation pipeline (IPFS + NSFW filter) is handled by T03.
 */
export function MemeForm({ onSubmit, maxFileSizeMB = 8 }: MemeFormProps) {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleFile = (f: File | null) => {
    setError(null);
    if (!f) return setFile(null);
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError("Unsupported format. Use PNG, JPG, GIF or WebP.");
      return;
    }
    if (f.size > maxFileSizeMB * 1024 * 1024) {
      setError(`File too big (max ${maxFileSizeMB}MB).`);
      return;
    }
    setFile(f);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required.");
    if (!file) return setError("Pick an image first.");
    const tags = tagInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 5);
    setSubmitting(true);
    try {
      await onSubmit?.({ title: title.trim(), caption: caption.trim(), file, tags });
      setDone(true);
      setTitle("");
      setCaption("");
      setTagInput("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="pixel-box" onSubmit={submit} style={{ maxWidth: 420 }}>
      <h3 style={{ margin: "0 0 12px", color: "var(--mario-red)" }}>SUBMIT A MEME</h3>

      <label style={{ display: "block", marginBottom: 10 }}>
        <span style={{ display: "block", marginBottom: 4 }}>Title</span>
        <input
          className="pixel-input"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="It's-a me, meme!"
        />
      </label>

      <label style={{ display: "block", marginBottom: 10 }}>
        <span style={{ display: "block", marginBottom: 4 }}>Caption</span>
        <textarea
          className="pixel-input"
          rows={3}
          maxLength={240}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="A funny one-liner..."
        />
      </label>

      <label style={{ display: "block", marginBottom: 10 }}>
        <span style={{ display: "block", marginBottom: 4 }}>Tags (comma-separated, max 5)</span>
        <input
          className="pixel-input"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="luigi, princess, koopa"
        />
      </label>

      <label style={{ display: "block", marginBottom: 12 }}>
        <span style={{ display: "block", marginBottom: 4 }}>Image (PNG/JPG/GIF/WebP)</span>
        <input
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <div style={{ marginTop: 6, fontSize: 10 }}>
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </div>
        )}
      </label>

      {error && (
        <div
          role="alert"
          style={{
            background: "var(--mario-red)",
            color: "#fff",
            padding: 8,
            marginBottom: 10,
            border: "var(--pixel) solid var(--mario-dark)",
          }}
        >
          {error}
        </div>
      )}

      {done && !error && (
        <div
          role="status"
          style={{
            background: "var(--mario-green)",
            color: "#fff",
            padding: 8,
            marginBottom: 10,
            border: "var(--pixel) solid var(--mario-dark)",
          }}
        >
          Meme submitted! It will appear after moderation.
        </div>
      )}

      <button className="pixel-btn" type="submit" disabled={submitting}>
        {submitting ? "Uploading..." : "Launch Meme"}
      </button>
    </form>
  );
}
