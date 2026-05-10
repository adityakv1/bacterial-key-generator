const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const connectDB = require("./config/db");

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/keys", require("./routes/keyRoutes"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});