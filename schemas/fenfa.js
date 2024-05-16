const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const fenfaSchema = new Schema({
    kaiguan: String,
    domains: [String],
    createAt: {
        type: Date,
        default: Date.now()
    }
});
fenfaSchema.pre('save', function (next) {
    if (!this.createAt) {
        this.createAt = Date.now();
    }
    next();
});
module.exports = fenfaSchema;