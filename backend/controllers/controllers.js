const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

const Key = require("../models/key");

const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});


// =====================================================
// UPLOAD IMAGE
// =====================================================

const uploadImage = async (req, res) => {

  try {

    const formData = new FormData();

    formData.append(
      "image",
      fs.createReadStream(req.file.path)
    );

    formData.append(
      "method",
      req.body.method || "1"
    );

    // CALL DEPLOYED PYTHON API
    const response = await axios.post(
      "https://bacterial-key-generator-3.onrender.com/generate",
      formData,
      {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity
      }
    );

    const result = response.data;

    // AI INTERPRETATION
    const prompt = `
You are a cybersecurity and cryptography expert.

Interpret these NIST randomness results:

${JSON.stringify(result.tests, null, 2)}

Write one short professional paragraph about how strong the generated key is.
`;

    let summary = "Analysis completed.";

    try {

      const ai = await client.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.4
      });

      summary = ai.choices[0].message.content;

    } catch (aiError) {

      console.log("AI ERROR:", aiError.message);
    }

    // SAVE TO MONGODB
    const saved = await Key.create({
      filename: req.file.filename,
      bitKey: result.bitKey,
      hexKey: result.hexKey,
      tests: result.tests,
      summary
    });

    // DELETE TEMP FILE
    fs.unlinkSync(req.file.path);

    // SEND RESPONSE
    res.json({
      bitKey: saved.bitKey,
      hexKey: saved.hexKey,
      tests: saved.tests,
      summary: saved.summary
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: error.message
    });
  }
};


// =====================================================
// ENCRYPT
// =====================================================

const encryptData = async (req, res) => {

  try {

    const response = await axios.post(
      "https://bacterial-key-generator-3.onrender.com/encrypt",
      req.body
    );

    res.json(response.data);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: error.message
    });
  }
};


// =====================================================
// DECRYPT
// =====================================================

const decryptData = async (req, res) => {

  try {

    const response = await axios.post(
      "https://bacterial-key-generator-3.onrender.com/decrypt",
      req.body
    );

    res.json(response.data);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: error.message
    });
  }
};


module.exports = {
  uploadImage,
  encryptData,
  decryptData
};