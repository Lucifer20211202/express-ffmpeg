const redis = require('ioredis');
const client = redis.createClient(process.env.REDIS_CONNECTION_STRING);
const jwt = require('jsonwebtoken');
const Setting = require('../models/setting');
exports.getTokenByRedis = cb => {
    getTokenFromRedis((err, token) => {
        if (err) {
            console.log(err);
        }
        if (!token) {
            getMoviesFromJwt((err, token) => {
                if (err) {
                    console.log(err)
                }
                return cb(null, token);
            })
        } else {
            return cb(null, token);
        }
    })
}

async function getMoviesFromJwt(cb) {
    const setting = await Setting.findOne()
    const token = jwt.sign({access: "view"}, setting.antikey, {expiresIn: '100s'});
    client.setex('token', 99, token);
    cb(null, token);
}

function getTokenFromRedis(cb) {
    client.get('token', (err, token) => {
        if (err) {
            console.log(err);
        }
        return cb(err, token);
    })
}