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

    // Python API
    const response = await axios.post(
      "http://localhost:8000/generate",
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
      generatedKey: result.generatedKey,
      tests: result.tests,
      summary
    });

    res.json({
      generatedKey: saved.generatedKey,
      tests: saved.tests,
      summary: saved.summary
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: error.message
    });
  }
};

module.exports = { uploadImage };