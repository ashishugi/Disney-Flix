const mongoose = require('mongoose');
const findOrCreate = require('mongoose-findorcreate');
const passportLocalMongoose = require("passport-local-mongoose");
mongoose.connect(process.env.MONGODB_URL, {useNewUrlParser: true, useUnifiedTopology: true} , function(err){
    if(err) throw err;
    console.log('connected');
});
const conn = mongoose.connection;

var userSchema = new mongoose.Schema({
    username:String,
    email:String,
    googleId:String,
})

module.export = userSchema;