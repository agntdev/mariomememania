import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { MemeService, NotFoundError, ValidationError } from "./memeService.js";
import { MemoryIpfsClient } from "./ipfs.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

export function createApp(service = new MemeService({ ipfs: new MemoryIpfsClient() })) {
  const app = express();
  app.use(express.json());

  app.post("/api/memes", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) throw new ValidationError("file field required");
      const { title, caption, tags, author } = req.body as Record<string, string>;
      const meme = await service.upload({
        title: title ?? "",
        caption: caption ?? "",
        tags: (tags ?? "")
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean),
        author: author ?? "anonymous",
        mimeType: req.file.mimetype,
        data: req.file.buffer,
      });
      res.status(201).json(meme);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/memes", (req, res) => {
    const status = (req.query.status as string | undefined) as
      | "pending"
      | "approved"
      | "rejected"
      | "nsfw"
      | undefined;
    const tag = req.query.tag as string | undefined;
    res.json(service.list({ status, tag }));
  });

  app.get("/api/memes/pending", (_req, res) => {
    res.json(service.pendingQueue());
  });

  app.get("/api/memes/:id", (req, res, next) => {
    const m = service.get(req.params.id);
    if (!m) return next(new NotFoundError("meme not found"));
    res.json(m);
  });

  app.post("/api/memes/:id/moderate", (req, res, next) => {
    try {
      const { status, reason } = req.body as { status: "approved" | "rejected"; reason?: string };
      res.json(service.setStatus(req.params.id, status, reason ?? null));
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/memes/:id/vote", (req, res, next) => {
    try {
      const { direction, voter } = req.body as { direction: "up" | "down"; voter: string };
      res.json(service.vote({ memeId: req.params.id, voter, direction }));
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/challenges", (req, res, next) => {
    try {
      const { date, theme } = req.body as { date: string; theme: string };
      res.status(201).json(service.startChallenge(date, theme));
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/challenges/:date/submissions", (req, res, next) => {
    try {
      const { memeId } = req.body as { memeId: string };
      res.json(service.submitToChallenge(req.params.date, memeId));
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/challenges/:date/close", (req, res, next) => {
    try {
      res.json(service.closeChallenge(req.params.date));
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/challenges/:date", (req, res, next) => {
    const c = service.getChallenge(req.params.date);
    if (!c) return next(new NotFoundError("no challenge"));
    res.json(c);
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
    const msg = err instanceof Error ? err.message : "internal error";
    res.status(500).json({ error: msg });
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4000);
  createApp().listen(port, () => {
    console.log(`memes service listening on :${port}`);
  });
}
