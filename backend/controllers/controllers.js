const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const Key = require("../models/key");
const OpenAI = require("openai");
const { exec } = require("child_process");
const path = require("path");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

const uploadImage = async (req, res) => {
  try {
    const method = req.body.method || "1";
    const imagePath = req.file.path;

    // Execute Python script for key generation
    const pythonCommand = `python3 python/app.py generate "${imagePath}" ${method}`;
    exec(pythonCommand, { cwd: path.join(__dirname, "..") }, async (error, stdout, stderr) => {
      if (error) {
        console.error("Python exec error:", error);
        console.error("stderr:", stderr);
        return res.status(500).json({ message: error.message });
      }

      let result;
      try {
        result = JSON.parse(stdout.trim());
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.error("stdout:", stdout);
        return res.status(500).json({ message: "Failed to parse Python output" });
      }

      if (result.error) {
        return res.status(500).json({ message: result.error });
      }

      const prompt = `
You are a cybersecurity and cryptography expert.

Interpret these NIST randomness results:

${JSON.stringify(result.tests, null, 2)}

Write one short professional paragraph about how strong the generated key is.
`;

      const ai = await client.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.4
      });

      const summary = ai.choices[0].message.content;

      const saved = await Key.create({
        filename: req.file.filename,
        bitKey: result.bitKey,
        hexKey: result.hexKey,
        tests: result.tests,
        summary
      });

      const responsePayload = {
        bitKey: result.bitKey || result.generatedKey,
        hexKey: result.hexKey || result.generatedKey,
        tests: saved.tests,
        summary: saved.summary
      };
      if (result.visualization) {
        responsePayload.visualization = result.visualization;
      }

      res.json(responsePayload);
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: error.message
    });
  }
};

const encryptData = async (req, res) => {
  try {
    const { key, text } = req.body;

    // Execute Python script for encryption
    const pythonCommand = `python3 python/app.py encrypt "${key}" "${text}"`;
    exec(pythonCommand, { cwd: path.join(__dirname, "..") }, (error, stdout, stderr) => {
      if (error) {
        console.error("Python exec error:", error);
        console.error("stderr:", stderr);
        return res.status(500).json({ error: error.message });
      }

      let result;
      try {
        result = JSON.parse(stdout.trim());
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.error("stdout:", stdout);
        return res.status(500).json({ error: "Failed to parse Python output" });
      }

      if (result.error) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const decryptData = async (req, res) => {
  try {
    const { key, encrypted } = req.body;

    // Execute Python script for decryption
    const pythonCommand = `python3 python/app.py decrypt "${key}" "${encrypted}"`;
    exec(pythonCommand, { cwd: path.join(__dirname, "..") }, (error, stdout, stderr) => {
      if (error) {
        console.error("Python exec error:", error);
        console.error("stderr:", stderr);
        return res.status(500).json({ error: error.message });
      }

      let result;
      try {
        result = JSON.parse(stdout.trim());
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.error("stdout:", stdout);
        return res.status(500).json({ error: "Failed to parse Python output" });
      }

      if (result.error) {
        return res.status(500).json({ error: result.error });
      }

      res.json(result);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
console.log("STDOUT:", stdout);
console.log("STDERR:", stderr);

module.exports = { uploadImage, encryptData, decryptData };