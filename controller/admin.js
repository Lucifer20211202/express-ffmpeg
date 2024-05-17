const Movie = require('../models/movie');
const Setting = require("../models/setting");
const Distribute = require("../models/distribute");
const FFmpeghelper = require('../helper/ffmpeg');
const ListsFFmpegHelper = require("../helper/listsffmpeg");
const ffmpegcut = require('../helper/ffmpegcut');
const Category = require("../models/category");
const Player = require("../models/player");
const fs = require('fs');
const redis = require('ioredis');
redis.createClient(process.env.REDIS_CONNECTION_STRING);
const cache = require('../helper/rediscache');

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
    if (body.dzchunkindex * 1 + 1 === body.dztotalchunkcount * 1) {
        const files = fs.readdirSync(tmppath);
        for (let i = 0; i < files.length; i++) {
            fs.appendFileSync(`${file.path}`, fs.readFileSync(`${tmppath}/${filename}${i}`));
            fs.unlinkSync(`${tmppath}/${filename}${i}`);
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

exports.getmovies = async (req, res) => {
    const page = req.query.page > 0 ? req.query.page : 1;
    const perPage = req.query.counts > 0 ? req.query.counts * 1 : 10;
    const keyword = req.query.keyword;
    const categories = await Category.find()
    if (keyword && keyword !== "") {
        let reg = /^[A-Za-z0-9]{24}$/;
        if (reg.test(keyword)) {
            const movies = await Movie
                .find({_id: keyword})
            res.render("movies", {
                user: req.session.user,
                title: '搜索结果',
                movies: movies,
                categories: categories,
                page: 1,
                pages: 1
            })
        } else {
            reg = new RegExp(keyword);
            const movies = await Movie
                .find({originalname: reg})
            res.render("movies", {
                user: req.session.user,
                title: '搜索结果',
                movies: movies,
                categories: categories,
                page: 1,
                pages: 1
            })
        }
    } else {
        const category = req.query.category;
        let search = {};
        if (category && category !== "") {
            search = {category: category};
        }
        const movies = await Movie.find(search)
            .sort('-createAt')
            .limit(perPage)
            .skip(perPage * (page - 1))
        const count = await Movie.countDocuments()
        res.render("movies", {
            user: req.session.user,
            title: "全部电影库",
            movies: movies,
            categories: categories,
            page: page,
            pages: Math.ceil(count / perPage)
        })
    }

}
// apimanager
exports.apim3u8 = async (req, res) => {
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
    const movie = await Movie.findOne({_id: id})
    if (!movie) {
        return res.status(404).send("页面已删除");
    }
    const setting = await Setting.findOne()
    const antiurl = setting.antiurl;
    if (antiurl.indexOf(url) != -1 || refer.indexOf(setting.host) == 0) {
        const path = `./public/videos/${id}/index.m3u8`;
        const data = fs.readFileSync(path);
        const datastring = data.toString('utf-8');
        const m3u8arr = datastring.split("index");
        const m3u8strings = m3u8arr.join(`${setting.host}/videos/${id}/index`);
        res.header('Content-Type', 'application/octet-stream');
        res.header('Content-Disposition', 'attachment; filename=index.m3u8');
        return res.status(200).send(m3u8strings);
    } else {
        res.status(404).send("无权访问");
    }
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
exports.delete = async (req, res) => {
    const id = req.query.id;
    const movie = await Movie.findOne({_id: id})
    movie.remove()
    fs.exists(movie.path, exists => {
        if (exists) {
            fs.unlinkSync(movie.path);
        }
    });
    deleteall(`./public/videos/${id}`);
    res.json({success: 1});
}

exports.delcategory = (req, res) => {
    const id = req.query.id;
    Category.deleteOne({_id: id})
    res.json({success: 1});
}

exports.getmovie = async (req, res) => {
    const id = req.params.id;
    const agent = req.headers["user-agent"].toLowerCase();
    const movie = await Movie.findOneAndUpdate({_id: id}, {$inc: {count: 1}})
    const setting = await Setting.findOne()
    const player = await Player.findOne()
    const phoneviewer = agent.match(/(iphone|ipod|ipad|android)/);
    if (!movie) {
        res.statusCode = 404;
        return res.send("对不起，此页面不存在");
    }
    let waplock = true;
    if (player?.waplock === 'on') {
        const browser = agent.match(/mqqbrowser/);
        if (phoneviewer) {
            if (browser) {
                waplock = false;
            }
        }
    }
    const category = await Category.findOne({title: movie.category})
    let categoryanti = "";
    let open = "";
    if (category) {
        categoryanti = category.antiurl ? category.antiurl : "";
        open = category.open ? category.open : "";
    }
    const rgba = colorRgba(player.wenzibackground, player.wenzibackgroundopacity);
    if (setting?.antikey !== "") {
        cache.getTokenByRedis((err, token) => {
            if (err) {
                console.log(err);
            }
            res.render("movie", {
                level: req.level,
                title: `${movie.originalname}在线播放`,
                id: id,
                token: token,
                poster: movie.poster,
                phoneviewer: phoneviewer,
                antiredirect: setting.antiredirect,
                waplock: waplock,
                player: player,
                rgba: rgba,
                antiurl: setting.antiurl,
                categoryanti: categoryanti,
                open: open
            })
        })
    } else {
        res.render("movie", {
            level: req.level,
            title: `${movie.originalname}在线播放`,
            id: id,
            token: '',
            poster: movie.poster,
            phoneviewer: phoneviewer,
            antiredirect: setting.antiredirect,
            waplock: waplock,
            player: player,
            rgba: rgba,
            antiurl: setting.antiurl,
            categoryanti: categoryanti,
            open: open
        })
    }
}

exports.setting = async (req, res) => {
    const setting = await Setting.findOne()
    let newset;
    if (setting) {
        newset = setting;
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
    const fenfa = await Distribute.findOne()
    let newfenfa;
    if (fenfa) {
        newfenfa = fenfa
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
}

exports.postfenfa = async (req, res) => {
    let kaiguan = req.body.kaiguan;
    const domains = req.body.domains;
    if (!kaiguan) {
        kaiguan = "";
    }
    const fenfa = await Distribute.findOne()
    if (fenfa) {
        fenfa.kaiguan = kaiguan;
        fenfa.domains = domains;
        fenfa.save()
    } else {
        const fenfaobj = {
            kaiguan: kaiguan,
            domains: domains
        };
        const newfenfa = new Distribute(fenfaobj);
        newfenfa.save()
    }
    res.redirect("/admin/setting");
}

exports.postsetting = async (req, res) => {
    const host = req.body.host;
    const hd = req.body.hd;
    const antiurl = req.body.antiurl;
    const antiredirect = req.body.antiredirect;
    const antikey = req.body.key;
    const wmpath = req.body.watermark;
    let miaoqie = req.body.miaoqie;
    const screenshots = req.body.screenshots;
    const tsjiami = req.body.tsjiami;
    const api = req.body.api;
    const antiurlarr = antiurl.split("|");
    if (!miaoqie) {
        miaoqie = "";
    }
    const setting = await Setting.findOne()
    if (setting) {
        setting.host = host;
        setting.hd = hd;
        setting.antikey = antikey;
        setting.wmpath = wmpath;
        setting.antiurl = antiurlarr;
        setting.antiredirect = antiredirect;
        setting.miaoqie = miaoqie;
        setting.screenshots = screenshots;
        setting.tsjiami = tsjiami;
        setting.api = api;
        setting.save();
    } else {
        const settingobj = {
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
        };
        const setting1 = new Setting(settingobj);
        setting1.save();
    }
    res.redirect("/admin/setting");
}

exports.editmovie = async (req, res) => {
    const id = req.params.id;
    const movie = await Movie.findOne({_id: id})
    res.render("editmovie", {
        title: "修改电影标题",
        movie: movie
    })
}

exports.postupdatemovie = async (req, res) => {
    const id = req.params.id;
    const originalname = req.body.originalname;
    const movie = await Movie.findOne({_id: id})
    movie.originalname = originalname;
    movie.save()
    res.redirect("/admin/movies");
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
    const des = `./public/videos/${req.body.id}`;
    const exists = fs.existsSync(des);
    if (exists) {
        fs.rename(path, `${des}/1.vtt`, err => {
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
    const des = `./public/videos/${id}`;
    const exists = fs.existsSync(des);
    if (!exists) {
        fs.mkdirSync(des);
    }
    fs.rename(path, `${des}/poster.jpg`, async err => {
        if (err) {
            console.log(err);
        }
        const movie = await Movie.findOne({_id: id})
        movie.poster = `/videos/${id}/poster.jpg`;
        movie.save()
        res.json({
            code: 0
        });
    })
}
exports.postzimu = (req, res) => {
    res.json({
        code: 0
    })
}

exports.playmagnet = async (req, res) => {
    const setting = await Setting.findOne()
    res.render("playmagnet", {
        title: "在线播放磁力链接",
        antiurl: setting.antiurl
    })
}

exports.ruku = (req, res) => {
    fs.readdir('./movies', (err, files) => {
        if (err) {
            console.log(err);
        }
        const path = "./movies/";
        files.forEach(file => {
            fs.stat(path + file, async (err, stats) => {
                if (err) {
                    console.log(err);
                }
                if (stats.isFile && stats.size > 500000) {
                    const movie = await Movie.findOne({originalname: file})
                    if (!movie) {
                        const movieobj = {
                            originalname: file,
                            status: "waiting",
                            path: path + file,
                            size: stats.size,
                            createAt: Date.now()
                        };
                        const newmovie = new Movie(movieobj);
                        newmovie.save()
                    }
                }
            })
        })
        res.json({success: 1});
    });
}

exports.addcategory = async (req, res) => {
    const id = req.body.id;
    const inputcategory = req.body.inputcategory;
    const selectcategory = req.body.selectcategory;
    if (selectcategory && selectcategory !== "") {
        const movie = await Movie.findOne({_id: id})
        movie.category = selectcategory;
        movie.save()
    }
    if (inputcategory && inputcategory !== "") {
        const categoryarr = inputcategory.split(",");
        const newcategoryarr = [];
        categoryarr.forEach(element => {
            newcategoryarr.push({title: element});
        });
        Category.insertMany(newcategoryarr);
    }
    res.json({
        success: 1
    });
}

exports.getCategories = async (req, res) => {
    const categories = await Category.find()
    res.render('categories', {
        title: "分类管理",
        categories: categories
    })
}

exports.player = async (req, res) => {
    let player;
    const players = await Player.findOne()
    if (players) {
        player = players;
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
            text: '云转码',
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
}

exports.postplayer = async (req, res) => {
    const kaiguan = req.body.kaiguan;
    const position = req.body.position;
    const mark = req.body.watermark;
    const markx = req.body.markx;
    const marky = req.body.marky;
    const p2p = req.body.p2p;
    const wenzikaiguan = req.body.wenzikaiguan;
    const font = req.body.font;
    const fontsize = req.body.fontsize;
    const opacity = req.body.opacity;
    const link = req.body.link;
    const wenziposition = req.body.wenziposition;
    const wenzibackground = req.body.wenzibackground;
    const wenzibackgroundopacity = req.body.wenzibackgroundopacity;
    const wenzix = req.body.wenzix;
    const wenziy = req.body.wenziy;
    const color = req.body.color;
    const bold = req.body.bold;
    const text = req.body.text;
    const italic = req.body.italic;
    const underline = req.body.underline;
    const waplock = req.body.waplock;
    const locktip = req.body.locktip;
    const tongji = req.body.tongji;
    const players = await Player.findOne()
    if (players) {
        players.kaiguan = kaiguan;
        players.mark = mark;
        players.position = position;
        players.markx = markx;
        players.marky = marky;
        players.p2p = p2p;
        players.waplock = waplock;
        players.locktip = locktip;
        players.wenzikaiguan = wenzikaiguan;
        players.font = font;
        players.fontsize = fontsize;
        players.opacity = opacity;
        players.link = link;
        players.wenziposition = wenziposition;
        players.wenzibackground = wenzibackground;
        players.wenzibackgroundopacity = wenzibackgroundopacity;
        players.wenzix = wenzix;
        players.wenziy = wenziy;
        players.color = color;
        players.bold = bold;
        players.text = text;
        players.italic = italic;
        players.underline = underline;
        players.tongji = tongji;
        players.save()
    } else {
        const playerobj = {
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
        const newplayer = new Player(playerobj);
        newplayer.save()
    }
    res.redirect("/admin/player");
}

exports.updatecategory = async (req, res) => {
    const datas = req.body.datas;
    const datasjson = JSON.parse(datas);
    for (let index = 0; index < datasjson.length; index++) {
        const element = datasjson[index];
        const movie = await Movie.findOne({_id: element.id})
        movie.category = element.category;
        movie.save()
    }
    res.json({
        success: 1
    });
}

exports.editcategory = async (req, res) => {
    const id = req.params.id;
    const category = await Category.findOne({_id: id})
    res.render('editcategory', {
        title: `编辑分类${category.title}`,
        category: category
    })
}

exports.posteditcategory = async (req, res) => {
    const id = req.params.id;
    const title = req.body.title;
    const antiurl = req.body.antiurl;
    const open = req.body.open;
    const category = await Category.findOne({_id: id})
    Movie.updateMany({category: category.title}, {$set: {category: title}});
    category.title = title;
    category.antiurl = antiurl;
    category.open = open;
    category.save()
    res.redirect("/admin/categories");
}

exports.selectedcategory = async (req, res) => {
    let ids = [];
    const category = req.body.category;
    ids = ids.concat(req.body.idarr);
    for (let index = 0; index < ids.length; index++) {
        const id = ids[index];
        const movie = await Movie.findOne({_id: id})
        movie.category = category;
        movie.save()
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
        return `rgba(${sColorChange.join(",")},${n})`;
    } else {
        return sColor;
    }
}