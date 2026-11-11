//utils/generateShortId.js
const { customAlphabet } = require('nanoid');

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateShortId = customAlphabet(alphabet, 8);

console.log(generateShortId());
module.exports = generateShortId;