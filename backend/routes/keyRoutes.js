const express = require("express");
const multer = require("multer");

const router = express.Router();

const { uploadImage, encryptData, decryptData } = require("../controllers/controllers");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },

  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

router.post("/upload", upload.single("image"), uploadImage);
router.post("/encrypt", encryptData);
router.post("/decrypt", decryptData);

module.exports = router;