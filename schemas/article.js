const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ArticleSchema = new Schema({
    title: String,
    content: String,
    contentmd: String,
    createAt: {
        type: Date
    },
    updateAt: {
        type: Date
    }
});
ArticleSchema.pre('save', function (next) {
    if (!this.createAt) {
        this.createAt = this.updateAt = Date.now();
    } else {
        this.updateAt = Date.now();
    }
    next();
});
module.exports = ArticleSchema;