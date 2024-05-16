const Movie = require('../models/movie');
const Setting = require("../models/setting");
const Fenfa = require("../models/fenfa");
const FFmpeghelper = require('../helper/newffmpeg');
const ListsFFmpegHelper = require("../helper/listsffmpeg");
const ffmpegcut = require('../helper/ffmpegcut');
const Category = require("../models/category");
const Portal = require("../models/portal");
const Player = require("../models/player");
const User = require("../models/user");
const Card = require("../models/card");
const fs = require('fs');
const _ = require('underscore');
const moment = require('moment');
const crypto = require('crypto');
const async = require('async');
const redis = require('ioredis');
redis.createClient(process.env.REDIS_CONNECTION_STRING);
const cache = require('../helper/rediscache');
const {validationResult} = require('express-validator/check');
exports.getadmin = (req, res) => {
    res.render('admin', {
        user: req.session.user,
        title: "云转码后台管理平台"
    })
}

exports.getupload = (req, res) => {
    res.render('upload', {
        user: req.session.user,
        title: "上传电影"
    })
}

exports.postupload = (req, res) => {
    const file = req.file;
    const body = req.body;
    const des = "./movies/";
    const filename = file.originalname;
    const filearr = filename.split(".");
    filearr.pop();
    const path = filearr.join('.');
    const tmppath = des + path;
    const exitst = fs.existsSync(tmppath);
    if (!exitst) {
        fs.mkdirSync(tmppath);
    }
    const newfilename = filename + body.dzchunkindex;
    fs.renameSync(file.path, tmppath + "/" + newfilename);
    if (body.dzchunkindex * 1 + 1 == body.dztotalchunkcount * 1) {
        const files = fs.readdirSync(tmppath);
        for (let i = 0; i < files.length; i++) {
            fs.appendFileSync(file.path + "", fs.readFileSync(tmppath + "/" + filename + i));
            fs.unlinkSync(tmppath + "/" + filename + i);
        }
        fs.rmdirSync(tmppath);
        const movieObj = {
            status: "waiting",
            originalname: file.originalname,
            path: file.path,
            size: body.dztotalfilesize
        };
        const movie = new Movie(movieObj);
        movie.save();
    }
    return res.json({success: 1});
}

exports.getmovies = (req, res) => {
    const page = req.query.page > 0 ? req.query.page : 1;
    const perPage = req.query.counts > 0 ? req.query.counts * 1 : 10;
    const keyword = req.query.keyword;
    if (keyword && keyword !== "") {
        var reg = /^[A-Za-z0-9]{24}$/;
        if (reg.test(keyword)) {
            Movie
                .find({_id: keyword})
                .then(movies => {
                    Category.find()
                        .then(categories => res.render("movies", {
                            user: req.session.user,
                            title: '搜索结果',
                            movies: movies,
                            categories: categories,
                            page: 1,
                            pages: 1
                        }))
                })
        } else {
            var reg = new RegExp(keyword);
            Movie
                .find({originalname: reg})
                .then(movies => {
                    Category.find()
                        .then(categories => res.render("movies", {
                            user: req.session.user,
                            title: '搜索结果',
                            movies: movies,
                            categories: categories,
                            page: 1,
                            pages: 1
                        }))
                })
        }
    } else {
        var category = req.query.category;
        var search = {};
        if (category && category !== "") {
            search = {category: category};
        }
        Movie
            .find(search)
            .sort('-createAt')
            .limit(perPage)
            .skip(perPage * (page - 1))
            .then(movies => {
                Movie.find().count(count => {
                    Category.find()
                        .then(categories => {
                            res.render("movies", {
                                user: req.session.user,
                                title: "全部电影库",
                                movies: movies,
                                categories: categories,
                                page: page,
                                pages: Math.ceil(count / perPage)
                            })
                        })
                })

            })
    }

}
// apimanager
exports.apim3u8 = (req, res) => {
    const id = req.params.id;
    const refer = req.headers.referer;
    const agent = req.headers["user-agent"];
    if (!refer || !agent) {
        return res.status(404).send("错误页面");
    }
    const referarr = refer.split("/");
    const urlarr = [];
    urlarr.push(referarr[0], referarr[1], referarr[2]);
    const url = urlarr.join('/');
    Movie.findOne({_id: id})
        .then(movie => {

            if (!movie) {
                return res.status(404).send("页面已删除");
            } else {
                Setting.find()
                    .then(setting => {
                        var antiurl = setting[0].antiurl;
                        if (antiurl.indexOf(url) != -1 || refer.indexOf(setting[0].host) == 0) {
                            var path = "./public/videos/" + id + "/index.m3u8";
                            // cache.getTokenByRedis(function(err, token){
                            //     if(err) {
                            //         console.log(err);
                            //     }
                            //     var m3u8 = path + "?token="+token;

                            // });
                            var data = fs.readFileSync(path);
                            var datastring = data.toString('utf-8');
                            var m3u8arr = datastring.split("index");
                            var m3u8strings = m3u8arr.join(setting[0].host + "/videos/" + id + "/index");
                            res.header('Content-Type', 'application/octet-stream');
                            res.header('Content-Disposition', 'attachment; filename=index.m3u8');
                            return res.status(200).send(m3u8strings);
                        } else {
                            res.status(404).send("无权访问");
                        }
                    })
            }
        })
}

// end apimanager
exports.transcode = async (req, res) => {
    const movies = await Movie.find({status: "waiting"})
    for (const movie of movies) {
        FFmpeghelper.transcode(movie);
    }
    res.json({
        success: 1
    });
}

exports.listszhuanma = async (req, res) => {
    await ListsFFmpegHelper.transcode();
    res.json({
        success: 1
    })
}
exports.delete = (req, res) => {
    const id = req.query.id;
    Movie.findOne({_id: id})
        .then(movie => {
            movie.remove(err => {
                if (err) {
                    console.log(err);
                }
                fs.exists(movie.path, exists => {
                    if (exists) {
                        fs.unlinkSync(movie.path);
                    }
                });
                deleteall("./public/videos/" + id);
                res.json({success: 1});
            })
        });
}

exports.delcategory = (req, res) => {
    const id = req.query.id;
    Category.deleteOne({_id: id})
    res.json({success: 1});
}

exports.deluser = (req, res) => {
    const id = req.query.id;
    User.deleteOne({_id: id})
    res.json({success: 1});
}

exports.getmovie = (req, res) => {
    const id = req.params.id;
    async.parallel({
        movie: callback => {
            Movie.findOneAndUpdate({
                _id: id
            }, {
                $inc: {
                    count: 1
                }
            })
                .then(movie => {
                    callback(null, movie);
                });
        },
        setting: callback => {
            Setting.find()
                .then(setting => {
                    callback(null, setting[0]);
                })
        },
        player: callback => {
            Player.find()
                .then(players => {
                    callback(null, players[0]);
                });
        }
    }, (err, results) => {
        const phoneviewer = agent.match(/(iphone|ipod|ipad|android)/);
        if (err) {
            console.log(err);
        }
        if (!results.movie) {
            res.statusCode = 404;
            return res.send("对不起，此页面不存在");
        }
        let waplock = true;
        if (results.player.waplock === 'on') {
            const agent = req.headers["user-agent"].toLowerCase();
            const browser = agent.match(/mqqbrowser/);
            if (phoneviewer) {
                if (browser) {
                    waplock = false;
                }
            }
        }
        Category.findOne({title: results.movie.category})
            .then(category => {
                let categoryanti = "";
                let open = "";
                if (category) {
                    categoryanti = category.antiurl ? category.antiurl : "";
                    open = category.open ? category.open : "";
                }
                const rgba = colorRgba(results.player.wenzibackground, results.player.wenzibackgroundopacity);
                if (results.setting.antikey != "") {
                    cache.getTokenByRedis((err, token) => {
                        if (err) {
                            console.log(err);
                        }
                        res.render("movie", {
                            level: req.level,
                            title: results.movie.originalname + "在线播放",
                            id: id,
                            token: token,
                            poster: results.movie.poster,
                            phoneviewer: phoneviewer,
                            antiredirect: results.setting.antiredirect,
                            waplock: waplock,
                            player: results.player,
                            rgba: rgba,
                            antiurl: results.setting.antiurl,
                            categoryanti: categoryanti,
                            open: open
                        })
                    })
                } else {
                    res.render("movie", {
                        level: req.level,
                        title: results.movie.originalname + "在线播放",
                        id: id,
                        token: '',
                        poster: results.movie.poster,
                        phoneviewer: phoneviewer,
                        antiredirect: results.setting.antiredirect,
                        waplock: waplock,
                        player: results.player,
                        rgba: rgba,
                        antiurl: results.setting.antiurl,
                        categoryanti: categoryanti,
                        open: open
                    })
                }
            })
    });
}
exports.setting = (req, res) => {
    Setting.find()
        .then(setting => {
            var newset;
            if (setting.length > 0) {
                newset = setting[0];
            } else {
                newset = {
                    host: "",
                    hd: "",
                    antiurl: [""],
                    antiredirect: "https://ffmpeg.moejj.com",
                    antikey: "",
                    wmpath: "./public/mark/mark.png",
                    miaoqie: "",
                    tsjiami: "",
                    api: "",
                    screenshots: 0
                }
            }
            Fenfa.find()
                .then(fenfa => {
                    var newfenfa;
                    if (fenfa.length > 0) {
                        newfenfa = fenfa[0]
                    } else {
                        newfenfa = {
                            kaiguan: "off",
                            domains: [""]
                        }
                    }
                    res.render("setting", {
                        user: req.session.user,
                        title: "云转码设置",
                        setting: newset,
                        fenfa: newfenfa
                    })
                });
        })

}
exports.postfenfa = (req, res) => {
    var kaiguan = req.body.kaiguan;
    var domains = req.body.domains;
    if (!kaiguan) {
        kaiguan = "";
    }
    Fenfa.find()
        .then(fenfa => {
            console.log(fenfa[0]);
            if (fenfa.length > 0) {
                fenfa[0].kaiguan = kaiguan;
                fenfa[0].domains = domains;
                fenfa[0].save()
            } else {
                var fenfaobj = {
                    kaiguan: kaiguan,
                    domains: domains
                }
                var newfenfa = new Fenfa(fenfaobj);
                newfenfa.save()
            }
            res.redirect("/admin/setting");
        })
}
exports.postsetting = (req, res) => {
    var host = req.body.host;
    var hd = req.body.hd;
    var antiurl = req.body.antiurl;
    var antiredirect = req.body.antiredirect;
    var antikey = req.body.key;
    var wmpath = req.body.watermark;
    var miaoqie = req.body.miaoqie;
    var screenshots = req.body.screenshots;
    var tsjiami = req.body.tsjiami;
    var api = req.body.api;
    antiurlarr = antiurl.split("|");
    if (!miaoqie) {
        miaoqie = "";
    }
    Setting.find()
        .then(setting => {
            if (setting.length > 0) {
                setting[0].host = host;
                setting[0].hd = hd;
                setting[0].antikey = antikey;
                setting[0].wmpath = wmpath;
                setting[0].antiurl = antiurlarr;
                setting[0].antiredirect = antiredirect;
                setting[0].miaoqie = miaoqie;
                setting[0].screenshots = screenshots;
                setting[0].tsjiami = tsjiami;
                setting[0].api = api;
                setting[0].save();
            } else {
                var settingobj = {
                    host: host,
                    hd: hd,
                    antiurl: antiurlarr,
                    antiredirect: antiredirect,
                    antikey: antikey,
                    miaoqie: miaoqie,
                    screenshots: screenshots,
                    wmpath: wmpath,
                    tsjiami: tsjiami,
                    api: api
                }
                var setting1 = new Setting(settingobj);
                setting1.save();
            }
        });
    res.redirect("/admin/setting");
}
exports.editmovie = (req, res) => {
    const id = req.params.id;
    Movie.findOne({_id: id})
        .then(movie => {
            res.render("editmovie", {
                title: "修改电影标题",
                movie: movie
            })
        })
}
exports.postupdatemovie = (req, res) => {
    const id = req.params.id;
    const originalname = req.body.originalname;
    Movie.findOne({_id: id})
        .then(movie => {
            movie.originalname = originalname;
            movie.save()
            res.redirect("/admin/movies");
        })
}
exports.uploadwatermark = (req, res) => {
    const file = req.file;
    const path = file.path;
    res.json({
        code: 0,
        img: path
    })
}
exports.uploadvtt = (req, res) => {
    const path = req.file.path;
    const des = './public/videos/' + req.body.id;
    const exists = fs.existsSync(des);
    if (exists) {
        fs.rename(path, des + "/1.vtt", err => {
            if (err) {
                console.log(err);
            }
            res.json({
                code: 0
            })
        })
    }
}
exports.uploadposter = (req, res) => {
    const path = req.file.path;
    const id = req.body.id;
    const des = './public/videos/' + id;
    const exists = fs.existsSync(des);
    if (!exists) {
        fs.mkdirSync(des);
    }
    fs.rename(path, des + "/poster.jpg", err => {
        if (err) {
            console.log(err);
        }
        Movie.findOne({_id: id})
            .then(movie => {
                movie.poster = '/videos/' + id + '/poster.jpg';
                movie.save()
                res.json({
                    code: 0
                });
            })
    })
}
exports.postzimu = (req, res) => {
    res.json({
        code: 0
    })
}

exports.playmagnet = (req, res) => {
    Setting.find()
        .then(setting => {
            res.render("playmagnet", {
                title: "在线播放磁力链接",
                antiurl: setting[0].antiurl
            })
        })

}

exports.ruku = (req, res) => {
    fs.readdir('./movies', (err, files) => {
        if (err) {
            console.log(err);
        }
        var path = "./movies/";
        files.forEach(file => {
            fs.stat(path + file, (err, stats) => {
                if (err) {
                    console.log(err);
                }
                if (stats.isFile && stats.size > 500000) {
                    Movie.findOne({originalname: file})
                        .then(movie => {
                            if (!movie) {
                                var movieobj = {
                                    originalname: file,
                                    status: "waiting",
                                    path: path + file,
                                    size: stats.size,
                                    createAt: Date.now()
                                }
                                var newmovie = new Movie(movieobj);
                                newmovie.save()
                            }
                        })
                }
            })
        })
        res.json({success: 1});
    });
}
exports.addcategory = function (req, res) {
    var id = req.body.id;
    var inputcategory = req.body.inputcategory;
    var selectcategory = req.body.selectcategory;
    if (selectcategory && selectcategory != "") {
        Movie.findOne({_id: id})
            .then(movie => {
                movie.category = selectcategory;
                movie.save()
            })
    }
    if (inputcategory && inputcategory != "") {
        var categoryarr = inputcategory.split(",");
        var newcategoryarr = [];
        categoryarr.forEach(element => {
            newcategoryarr.push({title: element});
        });
        Category.insertMany(newcategoryarr);
    }
    res.json({
        success: 1
    });
}
exports.getCategories = (req, res) => {
    Category.find()
        .then(categories => {
            res.render('categories', {
                title: "分类管理",
                categories: categories
            })
        })
}
exports.portal = (req, res) => {
    let portal;
    Portal.find()
        .then(portals => {

            if (portals.length > 0) {
                portal = portals[0];
            } else {
                portal = {
                    title: '',
                    seotitle: '',
                    kaiguan: '',
                    usersystem: '',
                    host: '',
                    screenshots: 0,
                    keywords: '',
                    description: '',
                    moviestitle: '视频',
                    images: '',
                    imagestitle: '图集',
                    articles: '',
                    articlestitle: '文章',
                    theme: 'default',
                    tongji: ''
                }
            }
            res.render('portal', {
                title: '门户cms设置',
                portal: portal
            })
        });
}
exports.postportal = (req, res) => {
    var title = req.body.title;
    var seotitle = req.body.seotitle;
    var keywords = req.body.keywords;
    var kaiguan = req.body.kaiguan;
    var host = req.body.host;
    var screenshots = req.body.screenshots;
    var moviestitle = req.body.moviestitle;
    var description = req.body.description;
    var usersystem = req.body.usersystem;
    var images = req.body.images;
    var imagestitle = req.body.imagestitle;
    var articles = req.body.articles;
    var articlestitle = req.body.articlestitle;
    var theme = req.body.theme;
    var tongji = req.body.tongji;
    Portal.find()
        .then(portals => {
            if (portals.length > 0) {
                portals[0].screenshots = screenshots;
                portals[0].host = host;
                portals[0].title = title;
                portals[0].seotitle = seotitle;
                portals[0].kaiguan = kaiguan;
                portals[0].usersystem = usersystem;
                portals[0].keywords = keywords;
                portals[0].description = description;
                portals[0].moviestitle = moviestitle;
                portals[0].images = images;
                portals[0].imagestitle = imagestitle;
                portals[0].articles = articles;
                portals[0].articlestitle = articlestitle;
                portals[0].theme = theme;
                portals[0].tongji = tongji;
                portals[0].save()
            } else {
                var portalobj = {
                    host: host,
                    screenshots: screenshots,
                    title: title,
                    seotitle: seotitle,
                    keywords: keywords,
                    kaiguan: kaiguan,
                    usersystem: usersystem,
                    description: description,
                    moviestitle: moviestitle,
                    articles: articles,
                    images: images,
                    imagestitle: imagestitle,
                    articlestitle: articlestitle,
                    theme: theme,
                    tongji: tongji
                }
                var newportal = new Portal(portalobj);
                newportal.save()
            }
            res.redirect("/admin/portal");
        })
}

exports.bofangqi = (req, res) => {
    var player;
    Player.find()
        .then(players => {
            if (players.length > 0) {
                player = players[0];
            } else {
                player = {
                    kaiguan: '',
                    mark: '/mark/mark.png',
                    position: 'lefttop',
                    markx: 20,
                    marky: 20,
                    p2p: 'on',
                    waplock: 'on',
                    locktip: '<p style="color:#fff;">请使用qq浏览器观看</p>',
                    font: 'Microsoft Yahei',
                    fontsize: 14,
                    opacity: 0.8,
                    bold: 'on',
                    color: '#701919',
                    text: '云转码express-ffmpeg',
                    wenzikaiguan: 'on',
                    italic: 'on',
                    underline: 'on',
                    link: 'http://ffmpeg.moejj.com',
                    wenziposition: 'lefttop',
                    wenzibackground: '#fff',
                    wenzibackgroundopacity: 0.5,
                    tongji: '',
                    wenzix: 20,
                    wenziy: 20
                }
            }
            res.render('adminplayer', {
                title: '播放器设置',
                player: player
            })
        });
}
exports.postbofangqi = (req, res) => {
    var kaiguan = req.body.kaiguan;
    var position = req.body.position;
    var mark = req.body.watermark;
    var markx = req.body.markx;
    var marky = req.body.marky;
    var p2p = req.body.p2p;
    var wenzikaiguan = req.body.wenzikaiguan;
    var font = req.body.font;
    var fontsize = req.body.fontsize;
    var opacity = req.body.opacity;
    var link = req.body.link;
    var wenziposition = req.body.wenziposition;
    var wenzibackground = req.body.wenzibackground;
    var wenzibackgroundopacity = req.body.wenzibackgroundopacity;
    var wenzix = req.body.wenzix;
    var wenziy = req.body.wenziy;
    var color = req.body.color;
    var bold = req.body.bold;
    var text = req.body.text;
    var italic = req.body.italic;
    var underline = req.body.underline;
    var waplock = req.body.waplock;
    var locktip = req.body.locktip;
    var tongji = req.body.tongji;
    Player.find()
        .then(players => {
            if (players.length > 0) {
                players[0].kaiguan = kaiguan;
                players[0].mark = mark;
                players[0].position = position;
                players[0].markx = markx;
                players[0].marky = marky;
                players[0].p2p = p2p;
                players[0].waplock = waplock;
                players[0].locktip = locktip;
                players[0].wenzikaiguan = wenzikaiguan;
                players[0].font = font;
                players[0].fontsize = fontsize;
                players[0].opacity = opacity;
                players[0].link = link;
                players[0].wenziposition = wenziposition;
                players[0].wenzibackground = wenzibackground;
                players[0].wenzibackgroundopacity = wenzibackgroundopacity;
                players[0].wenzix = wenzix;
                players[0].wenziy = wenziy;
                players[0].color = color;
                players[0].bold = bold;
                players[0].text = text;
                players[0].italic = italic;
                players[0].underline = underline;
                players[0].tongji = tongji;
                players[0].save()
            } else {
                var playerobj = {
                    kaiguan: kaiguan,
                    mark: mark,
                    position: position,
                    markx: markx,
                    marky: marky,
                    p2p: p2p,
                    waplock: waplock,
                    locktip: locktip,
                    text: text,
                    wenzikaiguan: wenzikaiguan,
                    font: font,
                    fontsize: fontsize,
                    opacity: opacity,
                    bold: bold,
                    color: color,
                    underline: underline,
                    italic: italic,
                    link: link,
                    wenziposition: wenziposition,
                    wenzibackground: wenzibackground,
                    wenzibackgroundopacity: wenzibackgroundopacity,
                    wenzix: wenzix,
                    wenziy: wenziy,
                    tongji: tongji
                };
                var newplayer = new Player(playerobj);
                newplayer.save()
            }
            res.redirect("/admin/bofangqi");
        })
}
exports.tongji = (req, res) => {
    var page = req.query.page > 0 ? req.query.page : 1;
    var perPage = req.query.counts ? req.query.counts : 10;
    var sort = req.query.sort ? req.query.sort : "newtime";
    var perPage = parseInt(perPage);
    var sortquery = '';
    if (sort === "hot") {
        sortquery = '-count';
    } else if (sort === 'nothot') {
        sortquery = 'count';
    } else if (sort === 'newtime') {
        sortquery = '-createAt';
    } else if (sort === 'oldtime') {
        sortquery = 'createAt';
    }
    Movie.find()
        .sort(sortquery)
        .limit(perPage)
        .skip(perPage * (page - 1))
        .then(movies => {
            var backgroundColor = [];
            for (let index = 0; index < movies.length; index++) {
                backgroundColor.push(randomcolor());
                movies[index].formatdate = moment(movies[index].createAt).format('YYYY年MM月DD日, HH:mm:ss');
            }
            var data = {};
            var dataarr = _.pluck(movies, 'count');
            data.datasets = [{
                data: dataarr,
                backgroundColor: backgroundColor
            }];
            var labelarr = _.pluck(movies, 'originalname');
            data.labels = labelarr;
            Movie.find().count(count => {
                res.render('tongji', {
                    title: "播放统计",
                    movies: movies,
                    data: JSON.stringify(data),
                    page: page,
                    pages: Math.ceil(count / perPage)
                })
            })
        })
}

exports.login = (req, res) => {
    const user = req.session.leveluser;
    Portal.find()
        .then((err, portal) => {
            res.render(req.portal.theme + "/cmslogin", {
                user: user,
                portal: portal[0],
                title: "用户登陆",
                info: req.flash('info')
            })
        })
}
exports.reg = (req, res) => {
    Portal.find()
        .then((err, portal) => {
            res.render(req.portal.theme + '/cmsreg', {
                portal: portal[0],
                title: '用户注册',
                info: req.flash('info')
            })
        })
}
exports.postreg = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            errors: errors.array()
        });
    }
    var username = req.body.username;
    var email = req.body.email;
    var md5 = crypto.createHash('md5');
    var password = md5.update(req.body.password).digest('hex');
    var newuserobj = {
        username: username,
        email: email,
        password: password
    }
    User.findOne({username: username})
        .then(user => {
            if (user) {
                req.flash('info', '此用户名已经被注册');
                return res.redirect('/register');
            }
            User.findOne({email: email})
                .then(user => {
                    if (user) {
                        req.flash('info', '此邮箱已经被注册');
                        return res.redirect("/register");
                    }
                    var newuser = new User(newuserobj);
                    newuser.save(user => {
                        req.session.leveluser = user.username;
                        res.redirect('/');
                    });
                })
        });
}
exports.postlogin = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            errors: errors.array()
        });
    }
    const email = req.body.email;
    const md5 = crypto.createHash('md5');
    const password = md5.update(req.body.password).digest('hex');
    User.findOne({email: email, password: password})
        .then(user => {
            if (!user) {
                req.flash('info', '对不起，邮箱或密码错误');
                return res.redirect("/login");
            }
            req.session.leveluser = user.username;
            res.redirect("/");
        });

}
exports.logout = (req, res) => {
    req.session.leveluser = null;
    res.redirect("/");
}
exports.adminusers = (req, res) => {
    const page = req.query.page > 0 ? req.query.page : 1;
    const perPage = 15;
    User.find()
        .sort("-createAt")
        .limit(perPage)
        .skip(perPage * (page - 1))
        .then(users => {
            User.find().count(count => {
                res.render("adminusers", {
                    title: '后台用户管理',
                    users: users,
                    page: page,
                    pages: Math.ceil(count / perPage)
                })
            })
        })
}
exports.gencard = (req, res) => {
    const days = req.body.days;
    const counts = req.body.counts;
    const cards = [];
    for (let index = 0; index < parseInt(counts); index++) {
        cards.push({
            card: randomcard(),
            days: days,
            status: 'notuse',
            createAt: Date.now()
        })
    }
    Card.insertMany(cards)
    res.redirect("/admin/users");
}
exports.cards = (req, res) => {
    const page = req.query.page > 0 ? req.query.page : 1;
    const perPage = 15;
    Card.find()
        .sort("-createAt")
        .limit(perPage)
        .skip(perPage * (page - 1))
        .then(cards => {
            Card.find().count(count => {
                res.render("admincards", {
                    title: '后台用户管理',
                    cards: cards,
                    page: page,
                    pages: Math.ceil(count / perPage)
                })
            })
        })
}
exports.addcard = (req, res) => {
    Portal.find()
        .then(portal => {
            res.render(req.portal.theme + '/addcard', {
                portal: portal[0],
                title: '升级成会员',
                user: req.session.leveluser,
                info: req.flash('info')
            })
        })
}
exports.postcard = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            errors: errors.array()
        });
    }
    const card = req.body.card;
    Card.findOne({card: card, status: 'notuse'})
        .then(card => {
            if (card) {
                User.findOne({username: req.session.leveluser})
                    .then(user => {
                        var duedate = user.duedate;
                        if (duedate && moment(duedate).isAfter(Date.now())) {
                            duedate = moment(duedate).add(card.days, 'days');
                        } else {
                            duedate = moment().add(card.days, 'days');
                        }
                        user.duedate = duedate;
                        user.level = 2;
                        user.save(newuser => {
                            card.status = 'used';
                            card.useby = newuser.username;
                            card.save()
                            req.flash('info', '开通会员成功，会员时间到' + moment(newuser.duedate).format("YYYY MM DD"));
                            return res.redirect("/addcard");
                        })
                    })
            } else {
                req.flash('info', '对不起卡劵错误或已使用，请重新核对输入');
                return res.redirect("/addcard");
            }
        })
}
exports.getcardtxt = (req, res) => {
    Card.find({status: 'notuse'})
        .then(cards => {
            res.set({
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment; filename=card.txt'
            });
            var thecards = _.pluck(cards, 'card');
            res.send(thecards.join("\n"));
        })
}

exports.updatecategory = (req, res) => {
    const datas = req.body.datas;
    const datasjson = JSON.parse(datas);
    for (let index = 0; index < datasjson.length; index++) {
        const element = datasjson[index];
        Movie.findOne({_id: element.id})
            .then(movie => {
                movie.category = element.category;
                movie.save()
            })
    }
    res.json({
        success: 1
    });
}

exports.editcategory = (req, res) => {
    const id = req.params.id;
    Category.findOne({_id: id})
        .then(category => {
            res.render('editcategory', {
                title: '编辑分类' + category.title,
                category: category
            })
        })
}

exports.posteditcategory = (req, res) => {
    const id = req.params.id;
    const title = req.body.title;
    const antiurl = req.body.antiurl;
    const open = req.body.open;
    console.log(open);
    Category.findOne({_id: id})
        .then(category => {
            Movie.updateMany({category: category.title}, {$set: {category: title}});
            category.title = title;
            category.antiurl = antiurl;
            category.open = open;
            category.save()
            res.redirect("/admin/categories");
        })
}
exports.selectedcategory = (req, res) => {
    let ids = [];
    const category = req.body.category;
    ids = ids.concat(req.body.idarr);
    for (let index = 0; index < ids.length; index++) {
        const id = ids[index];
        Movie.findOne({_id: id})
            .then(movie => {
                movie.category = category;
                movie.save()
            })
    }
    res.json({
        success: 1
    });
}
exports.cuthead = async (req, res) => {
    let ids = [];
    const duration = req.body.duration;
    ids = ids.concat(req.body.idarr);
    for (let index = 0; index < ids.length; index++) {
        const id = ids[index];
        const movie = await Movie.findOne({_id: id})
        if (movie.status === "waiting") {
            ffmpegcut.cuthead(movie, duration);
        }
    }
    res.json({
        success: 1
    });
}
exports.deleteselected = (req, res) => {
    let ids = req.query.ids;
    ids = ids.split(',');
    Movie.deleteMany({_id: {$in: ids}})
    res.json({success: 1});
}

function randomcard() {
    const data = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f", "g", "A", "B", "C", "D", "E", "F", "G"];
    for (let j = 0; j < 500; j++) {
        let result = "";
        for (let i = 0; i < 20; i++) {
            const r = Math.floor(Math.random() * data.length);

            result += data[r];
        }
        return result;
    }
}

function randomcolor() {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return "rgb(" + r + ',' + g + ',' + b + ")";
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

function colorRgba(str, n) {
    //十六进制颜色值的正则表达式
    const reg = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/;
    let sColor = str.toLowerCase();
    //十六进制颜色转换为RGB格式  
    if (sColor && reg.test(sColor)) {
        if (sColor.length === 4) {
            let sColorNew = "#";
            for (let i = 1; i < 4; i += 1) {  //例如：#eee,#fff等
                sColorNew += sColor.slice(i, i + 1).concat(sColor.slice(i, i + 1));
            }
            sColor = sColorNew;
        }
        //处理六位颜色值  
        const sColorChange = [];
        for (let i = 1; i < 7; i += 2) {
            sColorChange.push(parseInt("0x" + sColor.slice(i, i + 2)));
        }
        return "rgba(" + sColorChange.join(",") + "," + n + ")";
    } else {
        return sColor;
    }
}