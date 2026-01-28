
import dotenv from "dotenv";
dotenv.config();

import  express  from "express";

import cors from 'cors'
import  fetch  from "node-fetch";
import bodyParser from 'body-parser'



var app=express()

app.use(cors())
app.use(bodyParser.json())
app.post("/exchange-code", async (req, res) => {
  const { code } = req.body;

  try {
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code
        })
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.listen(4000,function(){
    console.log("cors server running on port :4000")
})