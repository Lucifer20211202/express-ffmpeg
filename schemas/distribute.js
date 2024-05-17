const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const distributeSchema = new Schema({
    kaiguan: String,
    domains: [String],
    createAt: {
        type: Date,
        default: Date.now()
    }
});
distributeSchema.pre('save', function (next) {
    if (!this.createAt) {
        this.createAt = Date.now();
    }
    next();
});
module.exports = distributeSchema;