import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import crypto from "crypto";

const app = express();

async function configureApp() {
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API to handle history persistence (mocking database with a JSON file)
  const historyPath = path.join(process.cwd(), 'history.json');
  const sharesDir = path.join(process.cwd(), 'shares');

  if (!fs.existsSync(historyPath)) {
    try {
      fs.writeFileSync(historyPath, JSON.stringify([]));
    } catch (e) {
      console.warn("Could not create history.json (Read-only environment)");
    }
  }
  if (!fs.existsSync(sharesDir)) {
    try {
      fs.mkdirSync(sharesDir);
    } catch (e) {
      console.warn("Could not create shares dir (Read-only environment)");
    }
  }

  // Serve shared reports
  app.use('/shares', express.static(sharesDir));

  app.post("/api/reports/share", (req, res) => {
    try {
      const { data, filename } = req.body;
      if (!data) return res.status(400).json({ error: 'No data provided' });
      
      const fileId = crypto.randomUUID();
      const filePath = path.join(sharesDir, `${fileId}.pdf`);
      
      // Save base64 data to file
      const base64Data = data.split('base64,')[1] || data;
      fs.writeFileSync(filePath, base64Data, 'base64');
      
      const publicUrl = `${req.protocol}://${req.get('host')}/shares/${fileId}.pdf`;
      res.json({ url: publicUrl });
    } catch (error) {
      console.error('Sharing failed:', error);
      res.status(500).json({ error: 'Failed to share report' });
    }
  });

  app.get("/api/history", (req, res) => {
    try {
      const data = fs.readFileSync(historyPath, 'utf8');
      res.json(JSON.parse(data));
    } catch (e) {
      res.json([]);
    }
  });

  app.post("/api/history", (req, res) => {
    try {
      const newItem = req.body;
      const data = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      data.unshift(newItem); // Newest first
      if (data.length > 20) data.pop(); // Keep last 20
      fs.writeFileSync(historyPath, JSON.stringify(data));
      res.status(201).json(newItem);
    } catch (e) {
      res.status(500).json({ error: 'Storage failed' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

configureApp();

export default app;
