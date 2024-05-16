const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const categorySchema = new Schema({
    title: String,
    antiurl: String,
    open: String,
    createAt: {
        type: Date
    }
});
categorySchema.pre('save', function (next) {
    if (!this.createAt) {
        this.createAt = Date.now();
    }
    next();
});
module.exports = categorySchema;