const { modp_div } = require("./modp_div.js");

const p = 97n;
console.log(modp_div(55n, 11n, p)); // 5n  (55 / 11 mod 97)
