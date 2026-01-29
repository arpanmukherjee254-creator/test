import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.post("/exchange-code", async (req, res) => {
  const { code } = req.body;

  try {
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Server running on port:", PORT);
});
