const express = require("express");
const app = express();
const bodyParser = require('body-parser')
require('dotenv').config()
const api = require("./routes/api");
app.use(bodyParser.json())
app.set("json spaces", 2);
app.use("/", api);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
