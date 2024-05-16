const ffmpeg = require('fluent-ffmpeg');
const Movie = require('../models/movie');
const Setting = require('../models/setting');
const fs = require('fs');
exports.transcode = (movie, cb) => {
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
        const wmimage = setting.wmpath;
        const hd = setting.hd * 1;
        const videometa = metadata.streams[0];
        let size = "";
        let bv = "500k";
        let bufsize = "1000k";
        let maxrate = "500k";
        let vf = `movie=${wmimage} [watermark]; [in][watermark] overlay=main_w-overlay_w [out]`;
        if (hd === 480) {
            size = "720x480";
        } else if (hd === 1080) {
            size = "1920x1080";
            bv = "2000k";
            bufsize = "4000k";
            maxrate = "2000k";
        } else {
            size = "1280x720";
            bv = "1000k";
            bufsize = "2000k";
            maxrate = "1000k";
        }
        const srtexists = fs.existsSync(srtpath);
        if (srtexists) {
            vf = 'movie=' + wmimage + ' [watermark]; [in][watermark] overlay=main_w-overlay_w,subtitles=' + srtpath + '[out]';
        }
        if (videometa.height <= hd) {
            size = videometa.width + "x" + videometa.height;
        }
        if (setting.miaoqie === "on") {
            let videowidth;
            if (hd === 480) {
                videowidth = 720;
            } else if (hd === 1080) {
                videowidth = 1920;
            } else {
                videowidth = 1280;
            }
            if (videometa.width <= videowidth && metadata.streams[0].codec_name === "h264") {
                if (srtexists) {
                    ffmpegtrans(path, des, size, bv, bufsize, maxrate, vf, id, cb);
                } else {
                    chunk(path, des, id);
                }
            } else {
                ffmpegtrans(path, des, size, bv, bufsize, maxrate, vf, id, cb);
            }
        } else {
            ffmpegtransandchunk(path, des, size, bv, bufsize, maxrate, vf, id);
        }
    });

}

function ffmpegtransandchunk(path, des, size, bv, bufsize, maxrate, vf, id) {
    ffmpeg(path)
        .addOptions([
            '-s ' + size,
            '-b:v ' + bv,
            '-vcodec libx264',
            '-acodec aac',
            '-ac 2',
            '-b:a 128k',
            '-bufsize ' + bufsize,
            '-maxrate ' + maxrate,
            '-q:v 6',
            '-strict -2',
            '-start_number 0',
            '-hls_time 10',
            '-hls_list_size 0',
            '-f hls'
        ])
        .addOption('-vf', vf)
        .output(des + '/index.mp4')
        .on('start', async () => {
            screenshots(path, des);
            const movie = await Movie.findOne({_id: id})
            movie.status = "trans&chunk";
            movie.save()
        })
        .on('error', (err, stdout, stderr) => {
            console.log(`Cannot process video: ${path}${err.message}`);
        })
        .on('end', async () => {
            const movie = await Movie.findOne({_id: id})
            fs.unlinkSync(movie.path);
            fs.exists(des + "/index.mp4", exists => {
                if (exists) {
                    fs.unlinkSync(des + '/index.mp4');
                }
            });
            movie.status = "finished";
            movie.save()
        })
        .run()
}

function ffmpegtrans(path, des, size, bv, bufsize, maxrate, vf, id, cb) {
    ffmpeg(path)
        .addOptions([
            '-s ' + size,
            '-b:v ' + bv,
            '-vcodec libx264',
            '-acodec aac',
            '-ac 2',
            '-b:a 128k',
            '-bufsize ' + bufsize,
            '-maxrate ' + maxrate,
            '-q:v 6',
            '-strict -2'
        ])
        .addOption('-vf', vf)
        .output(des + '/index.mp4')
        .on('start', cb)
        .on('error', (err, stdout, stderr) => {
            console.log(`Cannot process video: ${path}${err.message}`);
        })
        .on('end', () => {
            chunk(des + "/index.mp4", des, id);
        })
        .run()
}

function chunk(path, des, id) {
    ffmpeg(path)
        .addOptions([
            '-start_number 0',
            '-hls_time 10',
            '-hls_list_size 0',
            '-f hls',
            '-strict -2'
        ]).output(des + "/index.m3u8")
        .on('end', async () => {
            const movie = await Movie.findOne({_id: id})
            fs.unlinkSync(movie.path);
            fs.exists(des + "/index.mp4", exists => {
                if (exists) {
                    fs.unlinkSync(des + '/index.mp4');
                }
            });
            movie.status = "finished";
            movie.save()
        })
        .on('error', (err, stdout, stderr) => {
            console.log('Cannot chunk video: ' + err.message);
        })
        .on("start", async () => {
            screenshots(path, des);
            const movie = await Movie.findOne({_id: id})
            console.log("chunking");
            movie.status = "chunking";
            movie.save()
        })
        .run()
}

function screenshots(path, des) {
    ffmpeg(path)
        .screenshots({
            count: 4,
            filename: "%i.jpg",
            folder: des
        });
}
