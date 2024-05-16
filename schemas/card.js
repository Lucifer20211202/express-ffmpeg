const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const CardSchema = new Schema({
    card: String,
    days: Number,
    status: {type: String},
    useby: String,
    createAt: {
        type: Date
    }
});
CardSchema.pre('save', function (next) {
    if (!this.createAt) {
        this.createAt = Date.now();
    }
    next();
});
module.exports = CardSchema;