const mongoose = require('mongoose');
const PortalSchema = require('../schemas/portal');
const Portal = mongoose.model('Portal', PortalSchema);

module.exports = Portal;