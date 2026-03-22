const jwt = require("jsonwebtoken");
const token = jwt.sign({ id: 1, role: "admin" }, "stocksense_super_secret_key_2026", { expiresIn: "1h" });
console.log(token);
