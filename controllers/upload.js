const fs = require("fs");
const FormData = require("form-data");
const axios = require("axios");

const files = ["./upload/App.jsx", "./upload/index.css", "./upload/main.tsx"];

const upload = async () => {
  try {
    const form = new FormData();
    files.forEach((file) => {
      const test = fs.createReadStream(file);
      form.append('file', test);
    });

    const resp = await axios.post("http://localhost:3000/upload", form, {
      headers: {
        ...form.getHeaders(),
      },
    });
  } catch (error) {

  }
};

const uploadFile = async (req, res) => {};

module.exports = uploadFile;
