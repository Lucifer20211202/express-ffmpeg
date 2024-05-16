const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const config = require("./config/auth");
const session = require('express-session');
const flash = require('connect-flash');
const jwt = require('jsonwebtoken');
const fs = require("fs");
const mongoose = require("mongoose");
const MongoStore = require('connect-mongo')(session);
const routes = require('./routes/index');
const app = express();
mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
const Setting = require('./models/setting');
const Fenfa = require("./models/fenfa");
const User = require('./models/user');
const Portal = require('./models/portal');
const moment = require('moment');
// view engine setup

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(logger('dev'));
app.use(express.json({limit: '5mb'}));
app.use(express.urlencoded({limit: '5mb', extended: false}));
app.use(cookieParser());
app.use(session({
    secret: config.secret,
    resave: true,
    saveUninitialized: false,
    key: "hls",
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30
    }, //30day
    store: new MongoStore({
        url: process.env.MONGODB_CONNECTION_STRING
    })
}));
app.use("/videos/*/ts.key", (req, res, next) => {
    Setting.find()
        .exec((err, setting) => {
            if (err) {
                console.log(err);
            }
            const antiurlarr = setting[0].antiurl;
            if (antiurlarr[0] !== "") {
                if (antiurlarr.indexOf(req.headers.origin) !== -1) {
                    res.header("Access-Control-Allow-Origin", req.headers.origin);
                    res.header("Access-Control-Allow-Methods", "POST, GET");
                    res.header("Access-Control-Allow-Headers", "X-Requested-With");
                    res.header("Access-Control-Allow-Headers", "Content-Type");
                }
                next();
            } else {
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Methods", "POST, GET");
                res.header("Access-Control-Allow-Headers", "X-Requested-With");
                res.header("Access-Control-Allow-Headers", "Content-Type");
                next();
            }
        })
});
app.use("/videos/:id/index.m3u8", openUsersystem, (req, res, next) => {
    const id = req.params.id;
    Setting.find()
        .exec((err, setting) => {
            if (err) {
                console.log(err);
            }
            if (setting[0].antikey !== "") {
                const token = req.query.token;
                jwt.verify(token, setting[0].antikey, (err, decoded) => {
                    if (err) {
                        console.log(err);
                        res.statusCode = 404;
                        return res.send("对不起，您没有权限");
                    }
                    Fenfa.find()
                        .exec((err, fenfa) => {
                            if (err) {
                                console.log(err);
                            }
                            if (fenfa[0].kaiguan === "on") {
                                var path = "./public/videos/" + id + "/index.m3u8";
                                var m3u8exists = fs.existsSync(path);
                                if (m3u8exists) {
                                    var data = fs.readFileSync(path);
                                    var datastring = data.toString('utf-8');
                                    var m3u8arr = datastring.split("index");
                                    var domains = fenfa[0].domains;
                                    var domainslength = fenfa[0].domains.length;
                                    var index = 0;
                                    for (let i = 0; i < m3u8arr.length; i++) {
                                        if (i > 0) {
                                            if (index < domainslength) {
                                                m3u8arr[i] = domains[index] + "/videos/" + id + "/index" + m3u8arr[i];
                                                index++;
                                            } else {
                                                index = 1;
                                                m3u8arr[i] = domains[0] + "/videos/" + id + "/index" + m3u8arr[i];
                                            }
                                        }
                                    }
                                    var newm3u8 = m3u8arr.join("");
                                    res.send(newm3u8);
                                }
                            } else {
                                if (decoded.access === "view") {
                                    if (req.usersystem) {
                                        var path = "./public/videos/" + id + "/index.m3u8";
                                        var m3u8exists = fs.existsSync(path);
                                        if (m3u8exists) {
                                            var data = fs.readFileSync(path);
                                            var datastring = data.toString('utf-8');
                                            var m3u8arr = datastring.split("index");
                                        }
                                        var newm3u8arr = [];
                                        var length = m3u8arr.length >= 18 ? 18 : m3u8arr.length;
                                        for (let index = 0; index < length; index++) {
                                            if (index == length - 1) {
                                                var lastm3u8 = m3u8arr[length - 1];
                                                var lastarr = lastm3u8.split("ts");
                                                lastarr.pop();
                                                lastarr.push("\n#EXT-X-ENDLIST\n");
                                                newm3u8arr.push(lastarr.join("ts"));
                                            } else {
                                                newm3u8arr.push(m3u8arr[index]);
                                            }
                                        }
                                        var newm3u8 = newm3u8arr.join("index");
                                        if (req.session.leveluser) {
                                            User.findOne({username: req.session.leveluser})
                                                .exec((err, user) => {
                                                    if (err) {
                                                        console.log(err);
                                                    }
                                                    if (user.level === 2 && moment(user.duedate).isAfter(Date.now())) {
                                                        next();
                                                    } else {
                                                        res.send(newm3u8);
                                                    }
                                                })
                                        } else {
                                            res.send(newm3u8);
                                        }
                                    } else {
                                        next();
                                    }
                                }
                            }
                        })
                })
            } else {
                next();
            }
        });
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(function (req, res, next) {
    res.locals.createPagination = (pages, page) => {
        let url = require('url'),
            qs = require('querystring'),
            params = qs.parse(url.parse(req.url).query),
            str = '',
            list_len = 2,
            total_list = list_len * 2 + 1,
            j = 1,
            pageNo = parseInt(page);
        if (pageNo >= total_list) {
            j = pageNo - list_len;
            total_list = pageNo + list_len;
            if (total_list > pages) {
                total_list = pages;
            }
        } else {
            j = 1;
            if (total_list > pages) {
                total_list = pages;
            }
        }
        params.page = 0
        for (j; j <= total_list; j++) {
            params.page = j
            let clas = pageNo === j ? "active" : "no"
            str += `<li class="${clas}"><a href="?${qs.stringify(params)}">${j}</a></li>`
        }
        return str
    }
    next();
});
app.use(flash());
// app.use(function (req, res, next) {
//   res.setTimeout(480000, function () { // 4 minute timeout adjust for larger uploads
//     console.log('Request has timed out.');
//     res.send(408);
//   });

//   next();
// });
routes(app);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

function openUsersystem(req, res, next) {
    Portal.find()
        .exec((err, portals) => {
            if (err) {
                console.log(err);
            }
            if (portals[0].usersystem === 'on') {
                req.usersystem = true;
            } else {
                req.usersystem = false;
            }
            next();
        })
}

module.exports = app;
