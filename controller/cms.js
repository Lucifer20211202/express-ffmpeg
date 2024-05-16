const Movie = require('../models/movie');
const Category = require('../models/category');
const Portal = require('../models/portal');
const Image = require('../models/image');
const Article = require('../models/article');
const moment = require('moment');
const fs = require('fs');
const sharp = require('sharp');
const async = require('async');
const _ = require('underscore');
exports.index = (req, res) => {
    const perPage = 12;
    async.parallel({
        movies: callback => {
            Movie.find({status: 'finished'})
                .sort('-createAt')
                .limit(perPage)
                .then(movies => {
                    callback(null, movies);
                })
        },
        images: callback => {
            Image.find()
                .sort('-createAt')
                .limit(perPage)
                .then(images => {
                    callback(null, images);
                })
        },
        articles: callback => {
            Article.find()
                .sort("-createAt")
                .limit(perPage)
                .then(articles => {
                    callback(null, articles);
                })
        }
    }, (err, results) => {
        if (err) {
            console.log(err);
        }
        var lists = [];
        lists = lists.concat(results.movies, results.images, results.articles);
        lists = _.shuffle(lists);
        res.render(req.portal.theme + '/index', {
            portal: req.portal,
            lists: lists,
            user: req.session.leveluser
        })
    });
}
exports.getmovies = (req, res) => {
    const page = req.query.page > 0 ? req.query.page : 1;
    const perPage = 12;
    Portal.find()
        .then(portals => {
            console.log(`portals`,portals)
            if (portals[0].kaiguan === "on") {
                Category.find()
                    .then(categories => {
                        Movie.find({status: 'finished'})
                            .sort('-createAt')
                            .limit(perPage)
                            .skip(perPage * (page - 1))
                            .then(movies => {
                                Movie.find({status: 'finished'}).count(count => {
                                    const length = movies.length;
                                    const jiange = parseInt(perPage / 3);
                                    const results = [];
                                    for (let i = 0; i < length; i = i + jiange) {
                                        results.push(movies.slice(i, i + jiange));
                                    }
                                    res.render(portals[0].theme + '/movies', {
                                        categories: categories,
                                        movies: results,
                                        page: page,
                                        user: req.session.leveluser,
                                        pages: Math.ceil(count / perPage),
                                        portal: portals[0]
                                    })
                                })
                            })
                    })
            } else {
                res.status(404).send('对不起，页面不存在');
            }
        })
}

exports.getmovie = (req, res) => {
    const id = req.params.id;
    Movie.findOne({_id: id})
        .then(movie => {
            if (!movie) {
                return res.status(404).send('视频不存在');
            }
            Category.find()
                .then(categories => {
                    res.render(req.portal.theme + '/cmsmovie', {
                        portal: req.portal,
                        movie: movie,
                        user: req.session.leveluser,
                        categories: categories
                    })
                })
        })
}

exports.getcategory = (req, res) => {
    const category = req.params.category;
    const page = req.query.page > 0 ? req.query.page : 1;
    const perPage = 12;
    Category.find()
        .then(categories => {
            Movie.find({status: 'finished'})
                .where({category: category})
                .sort('-createAt')
                .limit(perPage)
                .skip(perPage * (page - 1))
                .then(movies => {
                    if (movies.length === 0) {
                        return res.status(404).send('该分类无内容');
                    }
                    Movie.find({status: 'finished', category: category}).count(count => {
                        var length = movies.length;
                        var jiange = parseInt(perPage / 3);
                        var results = [];
                        for (var i = 0; i < length; i = i + jiange) {
                            results.push(movies.slice(i, i + jiange));
                        }
                        res.render(req.portal.theme + '/movies', {
                            categories: categories,
                            movies: results,
                            page: page,
                            user: req.session.leveluser,
                            currentcategory: category,
                            pages: Math.ceil(count / perPage),
                            portal: req.portal
                        })
                    })
                })
        })
}

exports.manager = (req, res) => {
    res.render("cmsmanager", {
        title: "cms管理系统页面"
    })
}

exports.cmsimages = (req, res) => {
    const page = req.query.page > 0 ? req.query.page : 1;
    const perPage = 15;
    Image.find()
        .sort('-createAt')
        .limit(perPage)
        .skip(perPage * (page - 1))
        .then(images => {
            Image.find().count(count => {
                res.render("cmsimages", {
                    title: "cms图集管理",
                    page: page,
                    pages: Math.ceil(count / perPage),
                    images: images
                });
            })
        })
}

exports.cmsarticles = (req, res) => {
    const page = req.query.page > 0 ? req.query.page : 1;
    const perPage = 15;
    Article.find()
        .sort('-createAt')
        .limit(perPage)
        .skip(perPage * (page - 1))
        .then(articles => {
            Article.find().count(count => {
                res.render("cmsarticles", {
                    title: "cms图集管理",
                    page: page,
                    pages: Math.ceil(count / perPage),
                    articles: articles
                });
            })
        })
}
exports.postarticles = (req, res) => {
    res.render("cmspostarticles", {
        title: "发布文章"
    })
}
exports.dopostarticles = (req, res) => {
    const title = req.body.title;
    const content = req.body['editormd-html-code'][1];
    const contentmd = req.body['editormd-html-code'][0];
    const articleobj = {
        title: title,
        content: content,
        contentmd: contentmd
    };
    const newaritcle = new Article(articleobj);
    newaritcle.save()
    res.redirect("/cms/articles");
}
exports.uploadimage = (req, res) => {
    const url = "/uploads/" + req.file.filename;
    res.json({
        success: 1,
        message: "上传图片成功！",
        url: url
    })
}
exports.postimages = (req, res) => {
    res.render("cmspostimages", {
        title: "发布图集"
    })
}
exports.dopostimages = (req, res) => {
    const title = req.body.title;
    let images = [];
    images = images.concat(req.body.images);
    let poster = req.body.poster;
    if (!poster) {
        poster = images[0];
    }
    const imageobj = {
        title: title
    };
    const image = new Image(imageobj);
    image.save(image => {
        const path = './public/images/' + image._id;
        const filepath = '/images/' + image._id;
        fs.exists(path, exists => {
            if (!exists) {
                fs.mkdir(path, err => {
                    if (err) {
                        console.log(err);
                    }
                    const newimages = [];
                    for (let index = 0; index < images.length; index++) {
                        var imagearr = images[index].split('.');
                        var houzhui = imagearr[imagearr.length - 1];
                        var des = path + '/' + index + '.' + houzhui;
                        var src = filepath + '/' + index + '.' + houzhui;
                        fs.renameSync(images[index], des);
                        if (images[index] == poster) {
                            sharp(des)
                                .resize(400, 300)
                                .toFile(path + '/poster.jpg', err => {
                                    if (err) {
                                        console.log(err);
                                    }
                                });
                        }
                        newimages.push(src);
                    }
                    image.images = newimages;
                    image.poster = filepath + '/poster.jpg';
                    image.save()
                    res.redirect('/cms/images');
                })
            }
        });
    })
}
exports.imagesupload = (req, res) => {
    res.json({
        code: 0,
        image: '/images/' + req.file.originalname,
        imagepath: './public/images/' + req.file.originalname
    })
}
exports.getimages = (req, res) => {
    const page = req.query.page > 0 ? req.query.page : 1;
    const perPage = 12;
    Image.find()
        .sort('-createAt')
        .limit(perPage)
        .skip(perPage * (page - 1))
        .then(images => {
            Image.find().count(count => {
                res.render(req.portal.theme + "/images", {
                    title: req.portal.imagestitle,
                    images: images,
                    page: page,
                    user: req.session.leveluser,
                    pages: Math.ceil(count / perPage),
                    portal: req.portal
                })
            })
        })
}
exports.getarticles = (req, res) => {
    const page = req.query.page > 0 ? req.query.page : 1;
    const perPage = 12;
    Article.find()
        .sort('-createAt')
        .limit(perPage)
        .skip(perPage * (page - 1))
        .then(articles => {
            Article.find().count(count => {
                res.render(req.portal.theme + "/articles", {
                    title: req.portal.articlestitle,
                    articles: articles,
                    page: page,
                    user: req.session.leveluser,
                    pages: Math.ceil(count / perPage),
                    portal: req.portal
                })
            })
        })
}
exports.getimage = (req, res) => {
    let page = req.query.page > 0 ? req.query.page : 1;
    const id = req.params.id;
    Image.findOne({_id: id})
        .then(image => {
            const length = image.images.length;
            if (parseInt(page) > length) {
                page = length;
            }
            Image.find()
                .sort('-createAt')
                .limit(4)
                .then(newimages => {
                    res.render(req.portal.theme + '/image', {
                        title: image.title,
                        page: page,
                        image: image.images[page - 1],
                        length: length,
                        user: req.session.leveluser,
                        newimages: newimages,
                        portal: req.portal
                    })
                })
        })
}
exports.getarticle = (req, res) => {
    const id = req.params.id;
    Article.findOne({_id: id})
        .then(article => {
            res.render(req.portal.theme + '/article', {
                title: article.title,
                article: article,
                user: req.session.leveluser,
                data: moment(article.createAt).format('YYYY年MM月DD日, HH:mm:ss'),
                portal: req.portal
            })
        })
}
exports.deleteimage = (req, res) => {
    const id = req.query.id;
    Image.findOne({_id: id})
        .then(image => {
            image.remove()
            deleteall('./public/images/' + image._id);
            res.json({success: 1});
        });
}
exports.deletearticle = (req, res) => {
    const id = req.query.id;
    Article.findOne({_id: id})
        .then(article => {
            article.remove()
            res.json({success: 1});
        });
}
exports.editarticle = (req, res) => {
    const id = req.params.id;
    Article.findOne({_id: id})
        .then(article => {
            res.render('editarticle', {
                title: '编辑文章',
                article: article
            })
        })
}
exports.posteditarticle = (req, res) => {
    const id = req.params.id;
    const title = req.body.title;
    const content = req.body['editormd-html-code'][1];
    const contentmd = req.body['editormd-html-code'][0];
    Article.findOne({_id: id})
        .then(article => {
            article.title = title;
            article.content = content;
            article.contentmd = contentmd;
            article.save()
            res.redirect("/cms/articles");
        })
}

function deleteall(path) {
    let files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach((file, index) => {
            const curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) { // recurse
                deleteall(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}