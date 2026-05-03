const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const Key = require("../models/Key");
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

const uploadImage = async (req, res) => {
  try {
    const formData = new FormData();

    formData.append(
      "image",
      fs.createReadStream(req.file.path)
    );
    if (req.body.method) {
      formData.append("method", req.body.method);
    }

    // Python API
    const response = await axios.post(
      "http://127.0.0.1:8000/generate",
      formData,
      {
        headers: formData.getHeaders()
      }
    );

    const result = response.data;

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

    const summary =
      ai.choices[0].message.content;

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
    const formData = new FormData();
    formData.append("key", key);
    formData.append("text", text);

    const response = await axios.post("http://127.0.0.1:8000/encrypt", formData, {
      headers: formData.getHeaders()
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const decryptData = async (req, res) => {
  try {
    const { key, encrypted } = req.body;
    const formData = new FormData();
    formData.append("key", key);
    formData.append("encrypted", encrypted);

    const response = await axios.post("http://127.0.0.1:8000/decrypt", formData, {
      headers: formData.getHeaders()
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { uploadImage, encryptData, decryptData };