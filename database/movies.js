const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URL, {useNewUrlParser: true, useUnifiedTopology: true} , function(err){
    if(err) throw err;
    console.log('connected');
});
const conn = mongoose.connection;
var movieSchema = new mongoose.Schema({
    movieName:String,
    shortDesc:String,
    longDesc:String,
    movieUrl:String,
    isPrime:Boolean,
    category:String,
    genre:String,
    imageUrl:String,
    path:String,
})
var movieModel = mongoose.model('movie-data',movieSchema);
module.exports = movieModel;