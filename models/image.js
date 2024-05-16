const mongoose = require('mongoose');
const ImageSchema = require('../schemas/image');
const Image = mongoose.model('Image', ImageSchema);

module.exports = Image;