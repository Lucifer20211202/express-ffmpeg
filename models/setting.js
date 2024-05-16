const mongoose = require('mongoose');
const SettingSchema = require('../schemas/setting');
const Setting = mongoose.model('Setting', SettingSchema);

module.exports = Setting;