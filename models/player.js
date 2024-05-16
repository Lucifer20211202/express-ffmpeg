const mongoose = require('mongoose');
const PlayerSchema = require('../schemas/player');
const Player = mongoose.model('Player', PlayerSchema);

module.exports = Player;