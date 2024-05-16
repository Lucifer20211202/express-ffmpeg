const mongoose = require('mongoose');
const FenfaSchema = require('../schemas/fenfa');
const Fenfa = mongoose.model('Fenfa', FenfaSchema);

module.exports = Fenfa;