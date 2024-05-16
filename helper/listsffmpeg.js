const ffmpeg = require('fluent-ffmpeg');
const Movie = require('../models/movie');
const Setting = require('../models/setting');
const fs = require('fs');
exports.transcode = async () => {
    const movie = await Movie.findOne({status: 'waiting'})
    if (!movie) {
        return
    }
    const path = movie.path;
    const id = movie._id;
    const outpath = './public/videos/';
    const des = outpath + id;
    const videoarr = path.split(".");
    videoarr.pop();
    const srtpath = videoarr.join(".") + ".srt";
    fs.exists(des, exists => {
        if (!exists) {
            fs.mkdir(des, err => {
                if (err) {
                    console.log(err);
                }
            })
        }
    });
    ffmpeg.ffprobe(path, async (err, metadata) => {
        if (err) {
            console.log(err);
        }
        const setting = await Setting.findOne()
        let wmimage = setting.wmpath;
        let hd = setting.hd * 1;
        let wd = 0;
        const markdir = "./public/mark/mark.png";
        const videometa = metadata.format;
        const videostreams = metadata.streams;
        const bitrate = Math.floor(videometa.bit_rate / 1000);
        let size = "";
        let bv = 500;
        let bufsize = 1000;
        let maxrate = 500;
        let config = [];
        let videooriginH = 0;
        let videooriginC = "";
        let audiooriginC = "";
        const tsjiami = setting.tsjiami;
        if (!wmimage || wmimage === "") {
            wmimage = markdir;
        }
        let vf = 'movie=' + wmimage + ' [watermark]; [in][watermark] overlay=main_w-overlay_w [out]';
        if (hd === 480) {
            wd = 720;
        } else if (hd === 1080) {
            wd = 1920;
            bv = 2000;
            bufsize = 4000;
            maxrate = 2000;
        } else {
            wd = 1280;
            bv = 1000;
            bufsize = 2000;
            maxrate = 1000;
        }
        if (bitrate < bv) {
            bv = bitrate;
            maxrate = bv;
            bufsize = 2 * bv;
        }
        for (let i = 0; i < videostreams.length; i++) {
            if (videostreams[i].codec_type === 'video') {
                if (videostreams[i].height <= hd) {
                    hd = videostreams[i].height;
                }
                if (videostreams[i].width <= wd) {
                    wd = videostreams[i].width;
                }
                videooriginH = videostreams[i].height;
                videooriginC = videostreams[i].codec_name;
                break;
            }
        }
        for (let i = 0; i < videostreams.length; i++) {
            if (videostreams[i].codec_type === 'audio') {
                audiooriginC = videostreams[i].codec_name;
                break;
            }
        }
        size = wd + "x" + hd;
        const srtexists = fs.existsSync(srtpath);
        if (srtexists) {
            vf = 'movie=' + wmimage + ' [watermark]; [in][watermark] overlay=main_w-overlay_w,subtitles=' + srtpath + '[out]';
        }
        config = [
            '-s ' + size,
            '-b:v ' + bv + "k",
            '-vcodec libx264',
            '-acodec aac',
            '-ac 2',
            '-b:a 128k',
            '-bufsize ' + bufsize + "k",
            '-maxrate ' + maxrate + "k",
            '-q:v 6',
            '-strict -2',
            '-start_number 0',
            '-hls_time 10',
            '-hls_list_size 0',
            '-f hls'
        ];
        if (tsjiami === 'on') {
            fs.writeFileSync(des + "/key.info", setting.host + "/videos/" + id + "/ts.key\n" + des + "/ts.key");
            const key = randomkey();
            fs.writeFileSync(des + "/ts.key", key);
            const jiamiconfig = '-hls_key_info_file ' + des + '/key.info';
            config.push(jiamiconfig);
        }
        if (setting.miaoqie === "on") {
            if (videooriginH <= setting.hd * 1 && videooriginC === "h264" && audiooriginC === "aac") {
                if (srtexists) {
                    ffmpegtransandchunk(des, path, config, vf, id);
                } else {
                    chunk(path, des, id, config, vf, tsjiami);
                }
            } else {
                ffmpegtransandchunk(des, path, config, vf, id);
            }
        } else {
            ffmpegtransandchunk(des, path, config, vf, id);
        }
    })
}

function ffmpegtransandchunk(des, path, config, vf, id) {
    console.log(`ffmpegtransandchunk`)
    ffmpeg(path)
        .addOptions(config)
        .addOption('-vf', vf)
        .output(des + '/index.m3u8')
        .on('start', async () => {
            const movie = await Movie.findOne({_id: id})
            movie.status = "trans&chunk";
            movie.save()
        })
        .on('error', async (err, stdout, stderr) => {
            console.log('Cannot process video: ' + path + err.message);
            const movie = await Movie.findOne({_id: id})
            movie.status = "error & failed";
            movie.save()
            await exports.transcode();
        })
        .on('end', async () => {
            await screenshots(path, des);
            const movie = await Movie.findOne({_id: id})
            movie.status = "finished";
            movie.save()
            await exports.transcode();
        })
        .run()
}

async function screenshots(path, des) {
    const setting = await Setting.findOne()
    ffmpeg(path)
        .screenshots({
            count: setting.screenshots,
            filename: "%i.jpg",
            folder: des
        })
        .on('end', () => {
            thumbnails(des, path);
        });
}

function chunk(path, des, id, config, vf, tsjiami) {
    const chunkconfig = [
        '-c copy',
        '-bsf:v h264_mp4toannexb',
        '-hls_time 10',
        '-strict -2',
        '-start_number 0',
        '-hls_list_size 0'
    ];
    if (tsjiami === 'on') {
        chunkconfig.push('-hls_key_info_file ' + des + '/key.info');
    }
    ffmpeg(path)
        .addOptions(chunkconfig).output(des + "/index.m3u8")
        .on('end', async () => {
            await screenshots(path, des);
            const movie = await Movie.findOne({_id: id})
            movie.status = "finished";
            movie.save()
            await exports.transcode();
        })
        .on('error', (err, stdout, stderr) => {
            console.log('Cannot chunk video: ' + path + err.message);
            deleteall(des);
            fs.mkdirSync(des);
            ffmpegtransandchunk(des, path, config, vf, id);
        })
        .on("start", async () => {
            const movie = await Movie.findOne({_id: id})
            console.log("chunking");
            movie.status = "chunking";
            movie.save()
        })
        .run()
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

function thumbnails(des, path) {
    const nsg = require('node-sprite-generator');
    const Jimp = require('jimp');
    const tmp = des + '/dplayer-thumbnails';
    const output = des + '/thumbnails.jpg';
    ffmpeg(path)
        .screenshots({
            count: 100,
            folder: tmp,
            filename: 'screenshot%00i.png',
            size: '160x?'
        })
        .on('end', () => {
            nsg({
                src: [
                    `${tmp}/*.png`
                ],
                spritePath: `${tmp}/sprite.png`,
                stylesheetPath: `${tmp}/sprite.css`,
                layout: 'horizontal',
                compositor: 'jimp'
            }, err => {
                Jimp.read(`${tmp}/sprite.png`, (err, lenna) => {
                    if (err) throw err;
                    lenna.quality(parseInt(85))
                        .write(output);
                    fs.unlinkSync(path);
                    deleteall(tmp);
                });
            });
        });
}

function randomkey() {
    const data = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f", "g", "A", "B", "C", "D", "E", "F", "G"];
    for (let j = 0; j < 500; j++) {
        let result = "";
        for (let i = 0; i < 16; i++) {
            const r = Math.floor(Math.random() * data.length);

            result += data[r];
        }
        return result;
    }
}