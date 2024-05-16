const mongoose = require('mongoose');
const ArticleSchema = require('../schemas/article');
const Article = mongoose.model('Article', ArticleSchema);

module.exports = Article;