const auth = require("../config/auth");
const Admincontroller = require("../controller/admin");
const Cmscontroller = require("../controller/cms");
const Portal = require('../models/portal');
const Setting = require('../models/setting');
const User = require('../models/user');
const multer = require('multer');
const {body} = require('express-validator/check');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './movies');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({
    storage: storage
});
const imagestorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const imagesupload = multer({
    storage: imagestorage
});
const articlestorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/uploads');
    },
    filename: (req, file, cb) => {
        const fileFormat = (file.originalname).split(".");
        cb(null, file.fieldname + '-' + Date.now() + "." + fileFormat[fileFormat.length - 1]);
    }
});
const articleupload = multer({
    storage: articlestorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpg' && file.mimetype !== 'image/jpeg') {
            cb(null, false);
        } else {
            cb(null, true);
        }
    }
});
module.exports = app => {
    app.get('/hlsserver', checkNotLogin, (req, res, next) => {
        res.render('hlsserver', {
            title: '云转码切片服务平台'
        });
    });
    app.post("/hlsserver", checkNotLogin, (req, res) => {
        const user = req.body.user;
        const password = req.body.password;
        if (user === auth.user && password === auth.password) {
            req.session.user = user;
            res.redirect("/admin");
        } else {
            res.redirect('https://baidu.com');
        }
    });
    app.get("/hlslogout", checkLogin, (req, res) => {
        req.session.user = null;
        res.redirect("/hlsserver");
    });

    function posttimeout(req, res, next) {
        req.setTimeout(10000, () => {
            res.statusCode = 500;
            return res.json({
                success: 0
            });
        });
        next();
    }

    app.get("/admin", checkLogin, Admincontroller.getadmin);
    app.get("/admin/upload", checkLogin, Admincontroller.getupload);
    app.get("/admin/movies", checkLogin, Admincontroller.getmovies);
    // cms
    app.get("/cms", checkLogin, Cmscontroller.manager);
    app.get("/cms/images", checkLogin, Cmscontroller.cmsimages);
    app.get("/cms/articles", checkLogin, Cmscontroller.cmsarticles);
    app.get("/cms/postimages", checkLogin, Cmscontroller.postimages);
    app.post("/cms/postimages", checkLogin, Cmscontroller.dopostimages);
    app.get("/cms/postarticles", checkLogin, Cmscontroller.postarticles);
    app.post("/cms/postarticles", checkLogin, Cmscontroller.dopostarticles);
    app.post("/imagesupload", checkLogin, imagesupload.single('image'), Cmscontroller.imagesupload);
    app.get("/image/:id", checkopen, Cmscontroller.getimage);
    app.get("/article/:id", checkopen, Cmscontroller.getarticle);
    app.post("/upload/image", checkLogin, articleupload.single('editormd-image-file'), Cmscontroller.uploadimage);
    app.get("/imageslist", checkopen, Cmscontroller.getimages);
    app.get("/articles", checkopen, Cmscontroller.getarticles);
    app.get("/article/:id/edit", checkLogin, Cmscontroller.editarticle);
    app.post("/article/:id/edit", checkLogin, Cmscontroller.posteditarticle);
    // cms end
    // api
    app.get("/api/m3u8/:id", checkApiOpen, Admincontroller.apim3u8);
    // api end
    app.post("/upzimu", checkLogin, upload.single('zimu'), Admincontroller.postzimu);
    app.post("/upload", checkLogin, posttimeout, upload.single('file'), Admincontroller.postupload);
    app.post("/transcode", Admincontroller.transcode);
    app.post("/listszhuanma", Admincontroller.listszhuanma);
    app.delete("/delete/movie", checkLogin, Admincontroller.delete);
    app.delete("/delete/category", checkLogin, Admincontroller.delcategory);
    app.delete("/delete/user", checkLogin, Admincontroller.deluser);
    app.delete("/delete/image", checkLogin, Cmscontroller.deleteimage);
    app.delete("/delete/article", checkLogin, Cmscontroller.deletearticle);
    app.delete("/deleteselected", checkLogin, Admincontroller.deleteselected);
    app.get("/share/:id", checkLevel, Admincontroller.getmovie);
    app.get("/", checkopen, Cmscontroller.index);
    app.get("/movies", Cmscontroller.getmovies);
    app.get("/movie/:id", checkopen, Cmscontroller.getmovie);
    app.get("/movie/:id/edit", checkLogin, Admincontroller.editmovie);
    app.post("/movie/:id/edit", checkLogin, Admincontroller.postupdatemovie);
    app.post("/movies/updatecategory", checkLogin, Admincontroller.updatecategory);
    app.get("/category/:category", checkopen, Cmscontroller.getcategory);
    app.get("/admin/setting", checkLogin, Admincontroller.setting);
    app.post("/admin/setting/basic", checkLogin, Admincontroller.postsetting);
    app.post("/admin/setting/fenfa", checkLogin, Admincontroller.postfenfa);
    app.post("/ruku", checkLogin, Admincontroller.ruku);
    app.get("/playmagnet", Admincontroller.playmagnet);
    app.post("/addcategory", checkLogin, Admincontroller.addcategory);
    app.get("/admin/categories", checkLogin, Admincontroller.getCategories);
    app.get("/category/:id/edit", checkLogin, Admincontroller.editcategory);
    app.post("/category/:id/edit", checkLogin, Admincontroller.posteditcategory);
    app.get("/admin/portal", checkLogin, Admincontroller.portal);
    app.post("/admin/portal", checkLogin, Admincontroller.postportal);
    app.get("/admin/bofangqi", checkLogin, Admincontroller.bofangqi);
    app.post("/admin/bofangqi", checkLogin, Admincontroller.postbofangqi);
    app.get("/admin/tongji", checkLogin, Admincontroller.tongji);
    app.post("/selectedcategory", checkLogin, Admincontroller.selectedcategory);
    app.post("/selectedcuthead", checkLogin, Admincontroller.cuthead);
    app.get("/login", checkUsersystemOpen, checkLevelNotLogin, Admincontroller.login);
    app.post("/login", checkUsersystemOpen, checkLevelNotLogin, [
            body('email')
                .isEmail()
                .normalizeEmail(),
            body('password')
                .not().isEmpty()
                .trim()
                .escape()],
        Admincontroller.postlogin);
    app.get("/logout", checkUsersystemOpen, checkLevelLogin, Admincontroller.logout);
    app.get("/register", checkUsersystemOpen, checkLevelNotLogin, Admincontroller.reg);
    app.post("/register", checkUsersystemOpen, checkLevelNotLogin, [
            body('username')
                .trim()
                .isLength({min: 6, max: 16})
                .escape(),
            body('email')
                .isEmail()
                .normalizeEmail(),
            body('password')
                .trim()
                .isLength({min: 6, max: 16})
                .escape()
        ],
        Admincontroller.postreg);
    app.get("/admin/users", checkLogin, Admincontroller.adminusers);
    app.post("/admin/gencard", checkLogin, Admincontroller.gencard);
    app.get("/admin/cards", checkLogin, Admincontroller.cards);
    app.get("/addcard", checkUsersystemOpen, checkLevelLogin, Admincontroller.addcard);
    app.post("/addcard", checkUsersystemOpen, checkLevelLogin, [
            body('card')
                .trim()
                .matches(/^[\S]{20}$/).withMessage('必须20个非空字符')
                .escape()
        ],
        Admincontroller.postcard);
    const storage1 = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, './public/mark');
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        }
    });
    const upload1 = multer({
        storage: storage1
    });
    app.post("/upwm", checkLogin, upload1.single('img'), Admincontroller.uploadwatermark);
    const storage2 = multer.diskStorage({
        "destination": (req, file, cb) => {
            cb(null, './public/videos/');
        },
        "filename": (req, file, cb) => {
            cb(null, file.originalname);
        }
    });
    const upload2 = multer({
        storage: storage2
    });
    app.post("/upvtt", checkLogin, upload2.single('vtt'), Admincontroller.uploadvtt);
    app.post("/upposter", checkLogin, upload2.single('image'), Admincontroller.uploadposter);


    function checkLogin(req, res, next) {
        if (!req.session.user) {
            return res.redirect('/hlsserver');
        }
        next();
    }

    app.get("/admin/card.txt", checkLogin, Admincontroller.getcardtxt);

    function checkNotLogin(req, res, next) {
        if (req.session.user) {
            return res.redirect('/admin');
        }
        next();
    }

    function checkLevelLogin(req, res, next) {
        if (!req.session.leveluser) {
            return res.redirect('/login');
        }
        next();
    }

    function checkLevelNotLogin(req, res, next) {
        if (req.session.leveluser) {
            return res.redirect('/');
        }
        next();
    }

    async function checkopen(req, res, next) {
        const portals = await Portal.findOne()
        if (portals.length > 0) {
            if (portals.kaiguan === "on") {
                req.portal = portals;
                return next();
            } else {
                return res.status(404).send('对不起，cms未开启');
            }
        } else {
            return res.status(404).send('对不起，cms未开启');
        }
    }

    async function checkUsersystemOpen(req, res, next) {
        const portals = await Portal.findOne()
        if (portals.usersystem !== 'on') {
            return res.status(404).send("会员系统未开启");
        } else {
            req.portal = portals;
            next();
        }
    }

    async function checkLevel(req, res, next) {
        req.level = 2;
        if (req.session.leveluser) {
            const user = await User.findOne({username: req.session.leveluser})
            if (user.level === 2) {
                req.level = 2;
                next();
            } else {
                req.level = 1;
                next();
            }
        } else {
            const portals = await Portal.findOne()
            if (portals.usersystem === 'on') {
                req.level = 0;
                next();
            } else {
                next();
            }
        }
    }

    async function checkApiOpen(req, res, next) {
        const setting = await Setting.findOne()
        const api = setting.api;
        if (api !== "on") {
            return res.status(404).send("API未开启。");
        }
        // var antiurlarr = setting.antiurl;
        // if(antiurlarr.indexOf(req.headers.origin)!=-1){
        res.header("Access-Control-Allow-Origin", '*');
        res.header("Access-Control-Allow-Methods", "POST, GET");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.header("Access-Control-Allow-Headers", "Content-Type");
        // }
        next();
    }
};
