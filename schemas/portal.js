const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const portalSchema = new Schema({
    host: String,
    screenshots: Number,
    title: String,
    seotitle: String,
    keywords: String,
    kaiguan: String,
    usersystem: String,
    description: String,
    moviestitle: String,
    images: String,
    imagestitle: String,
    articles: String,
    articlestitle: String,
    theme: String,
    tongji: String,
    createAt: {
        type: Date
    }
});
portalSchema.pre('save', function (next) {
    if (!this.createAt) {
        this.createAt = Date.now();
    }
    next();
});
module.exports = portalSchema;