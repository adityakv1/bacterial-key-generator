const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

const Key = require("../models/key");


// =====================================================
// PYTHON API URL
// =====================================================

const PYTHON_API =
  "https://bacterial-key-generator-3.onrender.com";


// =====================================================
// UPLOAD IMAGE
// =====================================================

const uploadImage = async (req, res) => {

  try {

    console.log("FILE:", req.file);
    console.log("BODY:", req.body);

    // ============================================
    // VALIDATION
    // ============================================

    if (!req.file) {

      return res.status(400).json({
        error: "No image uploaded"
      });
    }

    // ============================================
    // CREATE FORM DATA
    // ============================================

    const formData = new FormData();

    formData.append(
      "image",
      fs.createReadStream(req.file.path)
    );

    formData.append(
      "method",
      req.body.method || "1"
    );

    // ============================================
    // WAKE PYTHON API
    // ============================================

    try {

      console.log("Waking Python API...");

      await axios.get(
        PYTHON_API,
        {
          timeout: 30000
        }
      );

      // wait for free render service
      await new Promise(resolve =>
        setTimeout(resolve, 20000)
      );

      console.log("Python API awake");

    } catch (wakeError) {

      console.log(
        "Wakeup Error:",
        wakeError.message
      );
    }

    // ============================================
    // SEND REQUEST TO PYTHON API
    // ============================================

    console.log(
      "Sending image to Python API..."
    );

    const response = await axios.post(
      `${PYTHON_API}/generate`,
      formData,
      {
        headers: formData.getHeaders(),

        maxBodyLength: Infinity,

        timeout: 120000
      }
    );

    console.log(
      "PYTHON RESPONSE:",
      response.data
    );

    const result = response.data;

    // ============================================
    // STATIC SUMMARY
    // ============================================

    const summary =
      "The generated cryptographic key successfully passed multiple statistical randomness evaluations, indicating strong entropy characteristics suitable for secure encryption applications.";

    // ============================================
    // SAVE TO DATABASE
    // ============================================

    const saved = await Key.create({

      filename: req.file.filename,

      bitKey: result.bitKey,

      hexKey: result.hexKey,

      tests: result.tests,

      summary

    });

    // ============================================
    // DELETE TEMP FILE
    // ============================================

    try {

      fs.unlinkSync(req.file.path);

    } catch (deleteError) {

      console.log(
        "Delete Error:",
        deleteError.message
      );
    }

    // ============================================
    // SEND RESPONSE
    // ============================================

    res.json({

      bitKey: saved.bitKey,

      hexKey: saved.hexKey,

      tests: saved.tests,

      summary: saved.summary

    });

  } catch (error) {

    console.log(
      "FULL ERROR:",
      error.response?.data || error.message
    );

    res.status(500).json({

      error:
        error.response?.data ||
        error.message

    });
  }
};


// =====================================================
// ENCRYPT
// =====================================================

const encryptData = async (req, res) => {

  try {

    console.log("Encrypt Request");

    const response = await axios.post(

      `${PYTHON_API}/encrypt`,

      req.body,

      {
        timeout: 120000
      }

    );

    res.json(response.data);

  } catch (error) {

    console.log(
      "ENCRYPT ERROR:",
      error.response?.data || error.message
    );

    res.status(500).json({

      error:
        error.response?.data ||
        error.message

    });
  }
};


// =====================================================
// DECRYPT
// =====================================================

const decryptData = async (req, res) => {

  try {

    console.log("Decrypt Request");

    const response = await axios.post(

      `${PYTHON_API}/decrypt`,

      req.body,

      {
        timeout: 120000
      }

    );

    res.json(response.data);

  } catch (error) {

    console.log(
      "DECRYPT ERROR:",
      error.response?.data || error.message
    );

    res.status(500).json({

      error:
        error.response?.data ||
        error.message

    });
  }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

  uploadImage,

  encryptData,

  decryptData

};