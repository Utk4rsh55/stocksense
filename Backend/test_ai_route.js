const axios = require("axios");
const jwt = require("jsonwebtoken");

const token = jwt.sign({ id: 1, role: "admin" }, "stocksense_super_secret_key_2026", { expiresIn: "1h" });

axios.post("http://localhost:5000/ai/ask", {
  question: "tell me product that have not sold"
}, {
  headers: {
    Authorization: "Bearer " + token
  }
}).then(res => {
  console.log("Success:", res.data);
}).catch(err => {
  console.error("Error:", err.response ? err.response.data : err.message);
});
