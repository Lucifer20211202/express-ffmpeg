const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const Movie = require('../models/movie');
exports.cuthead = (movie, duration) => {
    const des = './movies';
    const path = movie.path;
    const originalname = movie.originalname;
    const namearr = originalname.split('.');
    const houzhui = namearr[namearr.length - 1];
    namearr.pop();
    const moviename = namearr.join('.') + 'cut.' + houzhui;
    ffmpeg(path)
        .addInputOption('-ss', duration)
        .addOption('-c', 'copy')
        .output(des + '/' + moviename)
        .on('error', (err, stdout, stderr) => {
            console.log(`Cannot cut video: ${path}${err.message}`);
        })
        .on('end', async () => {
            const m = await Movie.findOne({_id: movie._id})
            m.originalname = moviename;
            m.path = des + '/' + moviename;
            m.save()
            fs.unlinkSync(path);
        })
        .run()
}