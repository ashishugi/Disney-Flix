require('dotenv').config();


const express = require('express');
const router = express.Router();
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const mongoose = require("mongoose");



router.use(session({
  secret: 'Any string can be here',
  resave: false,
  saveUninitialized: true,
}))
router.use(passport.initialize());
router.use(passport.session());

mongoose.connect(process.env.MONGODB_URL, {useNewUrlParser: true, useUnifiedTopology: true} , function(err){
  if(err) throw err;
  console.log('connected');
});
mongoose.set('useCreateIndex', true);
const conn = mongoose.connection;

var userSchema = new mongoose.Schema({
  username:String,
  email:String,
  photo:String,
  isPrime:Boolean,
  googleId:String,
  facebookId:String,
})

/* Google Auth */
// var User = new userModel({});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
var User = new mongoose.model("movie-user",userSchema);

passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
      done(err, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret:process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/home",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
        username:profile.displayName,
        email:profile.emails[0].value,
        photo:profile.photos[0].value,
        isPrime:false,
        googleId: profile.id
      }, function (err, user) {
      return cb(err, user);
    });
  }
));
router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile','https://www.googleapis.com/auth/userinfo.email',] }));


router.get('/auth/google/home',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  }
);


/* GET home page. */
router.get('/', function(req, res, next) {
    if (req.isAuthenticated()) {
      const userInfo = req.user;
      res.render('home', 
        { 
          user:true,
          userInfo,
        });
    } else {
      res.render('home', { user:false });
    }
});
router.get('/userAccount',function(req,res){
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    res.render('userAccount', 
      { 
        user:true,
        userInfo,
      });
  } else {
    res.redirect("/");
  }
})
router.get("/login", (req, res) => {
  res.redirect('/');
});
router.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
})


module.exports = router;
