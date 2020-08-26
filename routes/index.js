require('dotenv').config();


const express = require('express');
const router = express.Router();
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const mongoose = require("mongoose");
var multer  = require('multer')
const  movieModel =require('../database/movies');


// For uploading files
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/uploadedImages/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now()+file.originalname)
  }
})
const fileFilter = (req,file,cb)=>{
    if(file.mimetype === 'image/jpeg' ||file.mimetype ===  'image/jpg' || file.mimetype === 'image/png'){
      cb(null,true);
    }else{
      cb(null,false);
    }
}
var upload = multer({ storage:storage,fileFilter:fileFilter });

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
router.get('/',async function(req, res, next) {
  var moviesData =await  movieModel.find({category:"movies"}).exec();
  var sportsData =await  movieModel.find({category:"sports"}).exec();
  var newsData   =await  movieModel.find({category:"news"}).exec();
  var cartoonsData=await  movieModel.find({category:"cartoons"}).exec();
  var carouselData = await movieModel.find({}).limit(5).exec();
  if (req.isAuthenticated()) {
    var userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.render('home', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        moviesData:moviesData,
        sportsData:sportsData,
        newsData:newsData,
        cartoonsData:cartoonsData,
        carouselData:carouselData,
      });
    }else{
      res.render('home', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        userInfo:userInfo,
        moviesData:moviesData,
        sportsData:sportsData,
        newsData:newsData,
        cartoonsData:cartoonsData,
        carouselData:carouselData,
      });
    }
  } else {
    res.render('home',
     { user:false,
      userInfo:'',
      admin:false,
      userInfo:userInfo,
      moviesData:moviesData,
      sportsData:sportsData,
      newsData:newsData,
      cartoonsData:cartoonsData,
      carouselData:carouselData,
   });
  }
});

router.get('/home/:path', async function(req,res){
  const path = req.params.path;
  const data = await movieModel.find({ path: path });
  if(data.length > 0){
    res.render('playvideo',{data:data});
  }else{
    res.redirect('/');
  }
})

router.get('/userAccount',function(req,res){
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.render('userAccount', 
      { admin:true,
        user:true,
        userInfo:userInfo,
      });
    }else{
      res.render('userAccount', 
      { admin:false,
        user:true,
        userInfo:userInfo,
      });
    }
  } else {
    res.redirect("/");
  }
})

router.get("/admin",async function(req,res){
  // if (req.isAuthenticated()) {
  //   const userInfo = req.user;
  //   res.render('admin', 
  //     { 
       
  //     });
  // } else {
  //   res.redirect("/");
  // }
  var UserData =  User.find({});
  UserData.exec(function(err,data){
    if(err) throw err;
    res.render('admin',{data:data});
  })
  
})


// Inserting Inside the database  movies .
router.post('/addProduct',upload.single('imagePath'),function(req,res){
    var setpath="";
    for(var i=0;i<req.body.title.length;i++){
      if(req.body.title[i]!=' '){
           setpath=setpath+req.body.title[i].toLowerCase();
       }else{
          setpath=setpath+'-';
       }
   }
    var movieName = req.body.title;
    var shortDesc = req.body.shortDesc;
    var longDesc =req.body.longDesc;
    var movieUrl = req.body.link;
    var isPrime = req.body.isPrime;
    var category = req.body.category;
    var genre = req.body.genre;
    var imageUrl = req.file.path; //different way to upload a image.
    imageUrl = imageUrl.substring(7);
    // console.log(isPrime);
    var productDetails = new movieModel({
      movieName:movieName,
      shortDesc:shortDesc,
      longDesc:longDesc,
      movieUrl:movieUrl,
      isPrime:isPrime,
      genre:genre,
      category:category,
      imageUrl:imageUrl,
      path:setpath
    })
    productDetails.save(function(err,data){
      if(err) throw err;
      console.log("Inserted");
    });
    res.redirect('/admin');
})


router.get("/login", (req, res) => {
  res.redirect('/');
});
router.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
})


module.exports = router;
