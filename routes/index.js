const auth = require("../config/auth");
const Admincontroller = require("../controller/admin");
const Setting = require('../models/setting');
const multer = require('multer');
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, './movies');
    },
    filename(req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({
    storage: storage
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

function checkLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/hlsserver');
    }
    next();
}

function checkNotLogin(req, res, next) {
    if (req.session.user) {
        return res.redirect('/admin');
    }
    next();
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

const storage1 = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, './public/mark');
    },
    filename(req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload1 = multer({
    storage: storage1
});

const storage2 = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, './public/videos/');
    },
    filename(req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload2 = multer({
    storage: storage2
});

module.exports = app => {
    app.get('/', checkNotLogin, (req, res) => {
        res.render('hlsserver', {
            title: '云转码'
        });
    });
    app.post("/hlsserver", checkNotLogin, (req, res) => {
        const user = req.body.user;
        const password = req.body.password;
        if (user === auth.user && password === auth.password) {
            req.session.user = user;
            res.redirect("/admin");
        } else {
            res.send('用户名或密码错误')
        }
    });
    app.get("/hlslogout", checkLogin, (req, res) => {
        req.session.user = null;
        res.redirect("/");
    });

    app.get("/admin", checkLogin, Admincontroller.getadmin);
    app.get("/admin/upload", checkLogin, Admincontroller.getupload);
    app.get("/admin/movies", checkLogin, Admincontroller.getmovies);
    // api
    app.get("/api/m3u8/:id", checkApiOpen, Admincontroller.apim3u8);
    // api end
    app.post("/upzimu", checkLogin, upload.single('zimu'), Admincontroller.postzimu);
    app.post("/upload", checkLogin, posttimeout, upload.single('file'), Admincontroller.postupload);
    app.post("/transcode", Admincontroller.transcode);
    app.post("/listszhuanma", Admincontroller.listszhuanma);
    app.delete("/delete/movie", checkLogin, Admincontroller.delete);
    app.delete("/delete/category", checkLogin, Admincontroller.delcategory);
    app.delete("/deleteselected", checkLogin, Admincontroller.deleteselected);
    app.get("/share/:id", Admincontroller.getmovie);
    app.get("/movie/:id/edit", checkLogin, Admincontroller.editmovie);
    app.post("/movie/:id/edit", checkLogin, Admincontroller.postupdatemovie);
    app.post("/movies/updatecategory", checkLogin, Admincontroller.updatecategory);
    app.get("/admin/setting", checkLogin, Admincontroller.setting);
    app.post("/admin/setting/basic", checkLogin, Admincontroller.postsetting);
    app.post("/admin/setting/fenfa", checkLogin, Admincontroller.postfenfa);
    app.post("/ruku", checkLogin, Admincontroller.ruku);
    app.get("/playmagnet", Admincontroller.playmagnet);
    app.post("/addcategory", checkLogin, Admincontroller.addcategory);
    app.get("/admin/categories", checkLogin, Admincontroller.getCategories);
    app.get("/category/:id/edit", checkLogin, Admincontroller.editcategory);
    app.post("/category/:id/edit", checkLogin, Admincontroller.posteditcategory);
    app.post("/selectedcategory", checkLogin, Admincontroller.selectedcategory);
    app.post("/selectedcuthead", checkLogin, Admincontroller.cuthead);
    app.post("/upwm", checkLogin, upload1.single('img'), Admincontroller.uploadwatermark);
    app.post("/upvtt", checkLogin, upload2.single('vtt'), Admincontroller.uploadvtt);
    app.post("/upposter", checkLogin, upload2.single('image'), Admincontroller.uploadposter);
    // app.get("*", (req, res, next) => {
    //     res.send(404);
    // })
};
