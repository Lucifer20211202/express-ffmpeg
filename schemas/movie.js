const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MovieSchema = new Schema({
    status: String,
    size: String,
    category: String,
    originalname: String,
    poster: String,
    count: {type: Number, default: 0},
    path: String,
    createAt: {
        type: Date
    }
});
MovieSchema.pre('save', function (next) {
    if (!this.createAt) {
        this.createAt = Date.now();
    }
    next();
});
module.exports = MovieSchema;