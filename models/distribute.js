const mongoose = require('mongoose');
const DistributeSchema = require('../schemas/distribute');
const Distribute = mongoose.model('Distribute', DistributeSchema);

module.exports = Distribute;