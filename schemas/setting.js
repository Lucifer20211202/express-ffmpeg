const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const SettingSchema = new Schema({
    host: String,
    hd: String,
    antiurl: [String],
    antiredirect: String,
    antikey: String,
    wmpath: String,
    miaoqie: String,
    screenshots: Number,
    tsjiami: String,
    api: String,
    createAt: {
        type: Date,
        default: Date.now()
    }
});
SettingSchema.pre('save', function (next) {
    if (!this.createAt) {
        this.createAt = Date.now();
    }
    next();
});
module.exports = SettingSchema;