require('dotenv').config();


const express = require('express');
const router = express.Router();
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const mongoose = require("mongoose");
var multer  = require('multer')
const  movieModel =require('../database/movies');

/*********************************** using multer for uploading the files ***************/
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
/*******************************  maintaining Session ***************/
router.use(session({
  secret: 'Any string can be here',
  resave: false,
  saveUninitialized: true,
}))
router.use(passport.initialize());
router.use(passport.session());

/******************************* MondoDB  Connect and user Schema **********************/
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
  favorites:[],
  googleId:String,
  facebookId:String,
})

/*************************** Google Auth ***************************/
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
  callbackURL: "https://disneyflix.herokuapp.com/auth/google/home",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  // function(accessToken, refreshToken, profile, cb) {
    // User.findOrCreate({
    //     username:profile.displayName,
    //     email:profile.emails[0].value,
    //     photo:profile.photos[0].value,
    //     isPrime:false,
    //     googleId: profile.id
    //   }, function (err, user) {
    //   return cb(err, user);
    // });
    
  // }
    function(accessToken, refreshToken, profile, done) {
      //check user table for anyone with a facebook ID of profile.id
      User.findOne({
          'googleId': profile.id 
      }, function(err, user) {
          if (err) {
              return done(err);
          }
          //No user was found... so create a new user with values from Facebook (all the profile. stuff)
          if (!user) {
              user = new User({
                    username:profile.displayName,
                    email:profile.emails[0].value,
                    photo:profile.photos[0].value,
                    isPrime:false,
                    googleId: profile.id
              });
              user.save(function(err) {
                  if (err) console.log(err);
                  return done(err, user);
              });
          } else {
              //found user. Return
              return done(err, user);
          }
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
/*****************************  Facebook Auth  **********************/
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_CLIENT_ID,
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
  callbackURL: "https://disneyflix.herokuapp.com/auth/facebook/home",
  profileFields: ['id', 'displayName', 'name', 'gender', 'email','profileUrl']
},
  function(accessToken, refreshToken, profile, done) {
    //check user table for anyone with a facebook ID of profile.id
    console.log(profile);
    User.findOne({
        'facebookId': profile.id 
    }, function(err, user) {
        if (err) {
            return done(err);
        }
        //No user was found... so create a new user with values from Facebook (all the profile. stuff)
        if (!user) {
            user = new User({
                  username:profile.displayName,
                  email:profile.emails[0].value,
                  photo:profile.photos[0].value,
                  isPrime:false,
                  facebookId: profile.id
            });
            user.save(function(err) {
                if (err) console.log(err);
                return done(err, user);
            });
        } else {
            //found user. Return
            return done(err, user);
        }
    });
  }
));

router.get('/auth/facebook',
   passport.authenticate('facebook',{ scope: ['email']}));
 
router.get('/auth/facebook/home',
   passport.authenticate('facebook', { failureRedirect: '/login' }),
   function(req, res) {
       // Successful authentication, redirect home.
       res.redirect('/');
   });


/**************************** GET home page. ******************/
router.get('/',async function(req, res, next) {
  var moviesData =await  movieModel.find({category:"movies"}).sort({ $natural: -1 }).limit(10).exec();
  var sportsData =await  movieModel.find({category:"sports"}).sort({ $natural: -1 }).limit(10).exec();
  var newsData   =await  movieModel.find({category:"news"}).sort({ $natural: -1 }).limit(10).exec();
  var cartoonsData=await  movieModel.find({category:"cartoons"}).sort({ $natural: -1 }).limit(10).exec();
  var len =await moviesData.length+sportsData.length+newsData.length+cartoonsData.length;
  var carouselData = await movieModel.find({category:"movies"}).sort({ $natural: -1 }).limit(5).exec();
  var userRecommended = await movieModel.find({}).skip(Math.random()*len).limit(15).exec();
  if (req.isAuthenticated()) {
    var userInfo = req.user;
/////////////////////     Machine Computation for recommendation ////////////////////
    var favArray = req.user.favorites;
    var favoriteData = await movieModel.find({_id:{$in:favArray}}).exec();
    var collectionFavCategory = {};
    var collectionFavGenre = {};
    var final_genre="";
    var final_category="";
    var maxCount =0;
    for(var i=0;i<favoriteData.length;i++){
      var value = favoriteData[i].category;
      collectionFavCategory[value] = collectionFavCategory[value] ? collectionFavCategory[value]+1:1;
      if(collectionFavCategory[value] > maxCount){
        final_category = value;
        maxCount = collectionFavCategory[value];
      }
    }
    maxCount =0;
    for(var i=0;i<favoriteData.length;i++){
      var value = favoriteData[i].genre;
      if(final_category === favoriteData[i].category){
        collectionFavGenre[value] = collectionFavGenre[value] ? collectionFavGenre[value]+1:1;
        if(collectionFavGenre[value] > maxCount){
          final_genre = value;
          maxCount = collectionFavGenre[value];
        }
      }
    }
    var userRecommendedTemp = await  movieModel.find({category:final_category,genre:final_genre}).exec();
    if(userRecommendedTemp.length> 0){
        userRecommended = userRecommendedTemp;
    }
////////////////////////// End of Machine Computation of Recommendation ////////////////////
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('home', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        moviesData:moviesData,
        sportsData:sportsData,
        newsData:newsData,
        cartoonsData:cartoonsData,
        carouselData:carouselData,
        userRecommended:userRecommended,
        isPrime:req.user.isPrime,
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
        userRecommended:userRecommended,
        isPrime:req.user.isPrime,
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
      userRecommended:userRecommended,
      isPrime:false,
   });
  }
});

router.get('/home/:path', async function(req,res){
  const path = req.params.path;
  const data = await movieModel.find({ path: path });
  const genre = data[0].genre;
  const category = data[0].category;
  const recommendedData = await movieModel.find({genre:genre,category:category});
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    var addedToFavList = false;
    var favList = req.user.favorites;
    favList.forEach(function(item){
      if(item == data[0]._id){
        addedToFavList = true;
      }
    })
    if(userInfo.email === "ashishkumarguptacse@gmail.com"  || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('playvideo', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        addedToFavList:addedToFavList,
        data:data,
        isPrime:req.user.isPrime,
        recommendedData:recommendedData,
      });
    }else{
      if(data[0].isPrime && req.user.isPrime){//If video is  prime then user is  prime can see
        res.render('playvideo', 
        { admin:false,
          user:true,
          userInfo:userInfo,
          addedToFavList:addedToFavList,
          data:data,
          isPrime:true,
          recommendedData:recommendedData,
        });
      }else if(data[0].isPrime && !req.user.isPrime){
        res.redirect('back');
      }
      else{
        res.render("playvideo",{ admin:false,
          user:true,
          userInfo:userInfo,
          addedToFavList:addedToFavList,
          data:data,
          isPrime:false,
          recommendedData:recommendedData,
        });
      }
    }
  } else {
    if(!data[0].isPrime){ //If video is not prime then user can see
      res.render("playvideo",{ admin:true,
        user:false,
        userInfo:'',
        addedToFavList:false,
        data:data,
        isPrime:false,
        recommendedData:recommendedData,
      });
    }else{ // if video is prime and user is not login
      res.redirect('back');
    }
  }
})
/******************************* /userAccount *********************/
router.get('/userAccount',async function(req,res){
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    var favArray = req.user.favorites;
    var favoriteData = await movieModel.find({_id:{$in:favArray}}).exec(); // Is is for fetching multiple data .
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('userAccount', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        favoriteData:favoriteData,
        isPrime:req.user.isPrime,
      });
    }else{
      res.render('userAccount', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        favoriteData,favoriteData,
        isPrime:req.user.isPrime,
      });
    }
  } else {
    res.redirect("/");
  }
})

router.get('/userAccount/favlist/del/:id',async function(req,res){
  if (req.isAuthenticated()) {
    userInfo = req.user;
    var id = req.params.id;
    var userId = req.user.id;
    await User.update({_id:userId},{$pull:{"favorites":id}}).exec(); // It deletes the string from array of string .
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.redirect('back');
    }else{
      var id = req.params.id;
      var userId = req.user.id;
      await User.update({_id:userId},{$pull:{"favorites":id}}).exec(); // It deletes the string from array of string .
      res.redirect('back');
    }
  } else {
    res.redirect("/");
  }
})

/************************************  /admin **************************/

router.get("/admin",async function(req,res){
  if (req.isAuthenticated()) {
    var userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      var UserData =  User.find({});
      UserData.exec(function(err,data){
        if(err) throw err;
        res.render('admin',{data:data});
      })
    }else{
      res.redirect("/");
    }
  } else {
    res.redirect("/");
  }
  
})
router.get('/admin/del/:id',function(req,res){
  if (req.isAuthenticated()) {
    userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      var id = req.params.id;
      var del = User.findByIdAndDelete(id); // It deletes the string from array of string .
      del.exec(function(err,data){
        if(err) throw err;
      })
      res.redirect('back');
    }else{
      res.redirect('/');
    }
  } else {
    res.redirect("/");
  }
})

router.get('/adminmovies',async function(req,res){
  if (req.isAuthenticated()) {
    userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      var data =await  movieModel.find({category:"movies"}).sort({ $natural: -1 }).exec();
      res.render('adminVideoCategory',
      {
        title:"Movies",
        path:'adminmovies',
        data:data,
      }
      );
    }else{
      res.redirect('/');
    }
  } else {
    res.redirect('/');
  }
})
router.get('/admin/delVideo/:id',function(req,res){
  if (req.isAuthenticated()) {
    userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      var id = req.params.id;
      var del = movieModel.findByIdAndDelete(id); // It deletes the string from array of string .
      del.exec(function(err,data){
        if(err) throw err;
      })
      res.redirect('back');
    }else{
      res.redirect('/');
    }
  } else {
    res.redirect("/");
  }
})
router.get('/adminsports',async function(req,res){
  var data =await  movieModel.find({category:"sports"}).sort({ $natural: -1 }).exec();
  if (req.isAuthenticated()) {
    userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('adminVideoCategory',
      {
        title:"Movies",
        path:'adminmovies',
        data:data,
      }
      );
    }else{
      res.render('adminVideoCategory',
      {
        title:"Movies",
        path:'adminmovies',
        data:data,
      }
      );
    }
  } else {
    res.render('adminVideoCategory',
    {
      title:"Movies",
      path:'adminmovies',
      data:data,
    }
    );
  }
})
router.get('/adminnews',async function(req,res){
  var data =await  movieModel.find({category:"news"}).sort({ $natural: -1 }).exec();
  if (req.isAuthenticated()) {
    userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('adminVideoCategory',
      {
        title:"Movies",
        path:'adminmovies',
        data:data,
      }
      );
    }else{
      res.render('adminVideoCategory',
      {
        title:"Movies",
        path:'adminmovies',
        data:data,
      }
      );
    }
  } else {
    res.render('adminVideoCategory',
    {
      title:"Movies",
      path:'adminmovies',
      data:data,
    }
    );
  }
})
router.get('/admincartoons',async function(req,res){
  var data =await  movieModel.find({category:"cartoons"}).sort({ $natural: -1 }).exec();
  if (req.isAuthenticated()) {
    userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('adminVideoCategory',
      {
        title:"Movies",
        path:'adminmovies',
        data:data,
      }
      );
    }else{
      res.render('adminVideoCategory',
      {
        title:"Movies",
        path:'adminmovies',
        data:data,
      }
      );
    }
  } else {
    res.render('adminVideoCategory',
    {
      title:"Movies",
      path:'adminmovies',
      data:data,
    }
    );
  }
})
router.post('/admineditVideos',upload.single('imagePath'),function(req,res){
    var movieName = req.body.title;
    var shortDesc = req.body.shortDesc;
    var longDesc =req.body.longDesc;
    var movieUrl = req.body.link;
    var isPrime = req.body.isPrime;
    var category = req.body.category;
    var genre = req.body.genre;
    if(!req.file){ // if the file is not uploaded by the user.
        var id = req.body.id;
        movieModel.findByIdAndUpdate(id , { // updating the data base.
            movieName:movieName,
            shortDesc:shortDesc,
            longDesc:longDesc,
            movieUrl:movieUrl,
            isPrime:isPrime,
            genre:genre,
            category:category,
        },function(err,data){
          if(err) throw err;
          res.redirect('back');
        })
    }else{ // if file is uploaded by the user.
        var imageUrl = req.file.path;
        imageUrl = imageUrl.substring(7);
        var id = req.body.id;
        movieModel.findByIdAndUpdate(id , { // updating the data base.
            movieName:movieName,
            shortDesc:shortDesc,
            longDesc:longDesc,
            movieUrl:movieUrl,
            isPrime:isPrime,
            genre:genre,
            category:category,
            imageUrl:imageUrl,
        },function(err,data){
          if(err) throw err;
          res.redirect('back');
        })
    }
  
})
/********************************  /addProduct *******************/
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
/*************************  /movies *************************/
router.get('/movies',async function(req,res){
  var moviesData =await  movieModel.find({category:"movies"}).sort({ $natural: -1 }).exec();
  var carouselData = await movieModel.find({category:"movies"}).limit(5).exec();
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('navbarTabPages', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"movies",
        isPrime:req.user.isPrime,
      });
    }else{
      res.render('navbarTabPages', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"movies",
        isPrime:req.user.isPrime,
      });
    }
  } else {
    res.render("navbarTabPages",
    {
      admin:false,
      user:false,
      userInfo:'',
      data : moviesData,
      carouselData:carouselData,
      path:"movies",
      isPrime:false,
    }
    );
  }
})
router.get('/movies/:path',async function(req,res){
  const path = req.params.path;
  const data = await movieModel.find({ path: path });
  var genre="action";
  var category="movies";
  if(data.length > 0 ){
    genre = data[0].genre;
    category = data[0].category;
  }else{
    res.redirect('/');
  }
  const recommendedData = await movieModel.find({genre:genre,category:category});
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    var addedToFavList = false;
    var favList = req.user.favorites;
    favList.forEach(function(item){
      if(item == data[0]._id){
        addedToFavList = true;
      }
    })
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.render('playvideo', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        addedToFavList:addedToFavList,
        data:data,
        isPrime:req.user.isPrime,
        recommendedData:recommendedData,
      });
    }else if(data[0].isPrime && !req.user.isPrime){ 
      res.redirect('back');
    }else{
      if(data[0].isPrime && req.user.isPrime){//If video is not prime then user is not prime cannot  see
        res.render('playvideo', 
        { admin:false,
          user:true,
          userInfo:userInfo,
          addedToFavList:addedToFavList,
          data:data,
          isPrime:req.user.isPrime,
          recommendedData:recommendedData,
        });
      }else{
        res.render("playvideo",{ admin:false,
          user:true,
          userInfo:userInfo,
          addedToFavList:addedToFavList,
          data:data,
          isPrime:req.user.isPrime,
          recommendedData:recommendedData,
        });
      }
    }
  }  else {
    if(!data[0].isPrime){ //If video is not prime then user can see
      res.render("playvideo",{ admin:true,
        user:false,
        userInfo:'',
        addedToFavList:false,
        data:data,
        isPrime:false,
        recommendedData:recommendedData,
      });
    }else{ // if video is prime and user is not login

      res.redirect('/');
    }
  }
});

/*************************  /sports *************************/
router.get('/sports',async function(req,res){
  var moviesData =await  movieModel.find({category:"sports"}).sort({ $natural: -1 }).exec();
  var carouselData = await movieModel.find({category:"sports"}).sort({ $natural: -1 }).limit(5).exec();
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('navbarTabPages', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"sports",
        isPrime:req.user.isPrime,
      });
    }else{
      res.render('navbarTabPages', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"sports",
        isPrime:req.user.isPrime,
      });
    }
  } else {
    res.render("navbarTabPages",
    {
      admin:false,
      user:false,
      userInfo:'',
      data : moviesData,
      carouselData:carouselData,
      path:"sports",
      isPrime:false,
    }
    );
  }
})
router.get('/sports/:path',async function(req,res){
  const path = req.params.path;
  const data = await movieModel.find({ path: path });
  var genre="none";
  var category="sports";
  if(data.length > 0 ){
    genre = data[0].genre;
    category = data[0].category;
  }else{
    res.redirect('/');
  }
  const recommendedData = await movieModel.find({genre:genre,category:category});
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    var addedToFavList = false;
    var favList = req.user.favorites;
    favList.forEach(function(item){
      if(item == data[0]._id){
        addedToFavList = true;
      }
    })
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('playvideo', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        addedToFavList:addedToFavList,
        data:data,
        isPrime:req.user.isPrime,
        recommendedData:recommendedData,
      });
    }else{
      if(data[0].isPrime && req.user.isPrime){//If video is not prime then user is not prime cannot  see
        res.render('playvideo', 
        { admin:false,
          user:true,
          userInfo:userInfo,
          addedToFavList:addedToFavList,
          data:data,
          isPrime:req.user.isPrime,
          recommendedData:recommendedData,
        });
      }else if(data[0].isPrime && !req.user.isPrime){
        res.redirect('back');
      }else{
        res.render("playvideo",{ admin:false,
          user:true,
          userInfo:userInfo,
          addedToFavList:addedToFavList,
          data:data,
          isPrime:req.user.isPrime,
          recommendedData:recommendedData,
        });
      }
    }
  } else {
    if(!data[0].isPrime){ //If video is not prime then user can see
      res.render("playvideo",{ admin:true,
        user:false,
        userInfo:'',
        addedToFavList:false,
        data:data,
        isPrime:false,
        recommendedData:recommendedData,
      });
    }else{ // if video is prime and user is not login
      res.redirect('/');
    }
  }
});


/*************************  /news *************************/
router.get('/news',async function(req,res){
  var moviesData =await  movieModel.find({category:"news"}).sort({ $natural: -1 }).exec();
  var carouselData = await movieModel.find({category:"news"}).sort({ $natural: -1 }).limit(5).exec();
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('navbarTabPages', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"news",
        isPrime:req.user.isPrime,
      });
    }else{
      res.render('navbarTabPages', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"news",
        isPrime:req.user.isPrime,
      });
    }
  } else {
    res.render("navbarTabPages",
    {
      admin:false,
      user:false,
      userInfo:'',
      data : moviesData,
      carouselData:carouselData,
      path:"news",
      isPrime:false,
    }
    );
  }
})
router.get('/news/:path',async function(req,res){
  const path = req.params.path;
  const data = await movieModel.find({ path: path });
  var genre="none";
  var category="news";
  if(data.length > 0 ){
    genre = data[0].genre;
    category = data[0].category;
  }else{
    res.redirect('/');
  }
  const recommendedData = await movieModel.find({genre:genre,category:category});
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    var addedToFavList = false;
    var favList = req.user.favorites;
    favList.forEach(function(item){
      if(item == data[0]._id){
        addedToFavList = true;
      }
    })
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('playvideo', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        addedToFavList:addedToFavList,
        data:data,
        isPrime:req.user.isPrime,
        recommendedData:recommendedData,
      });
    }else{
      if(data[0].isPrime && req.user.isPrime){//If video is not prime then user is not prime cannot  see
        res.render('playvideo', 
        { admin:false,
          user:true,
          userInfo:userInfo,
          addedToFavList:addedToFavList,
          data:data,
          isPrime:req.user.isPrime,
          recommendedData:recommendedData,
        });
      }else if(data[0].isPrime && !req.user.isPrime){
        res.redirect('back');
      }else{
        res.render("playvideo",{ admin:false,
          user:true,
          userInfo:userInfo,
          addedToFavList:addedToFavList,
          data:data,
          isPrime:req.user.isPrime,
          recommendedData:recommendedData,
        });
      }
    }
  } else {
    if(!data[0].isPrime){ //If video is not prime then user can see
      res.render("playvideo",{ admin:true,
        user:false,
        userInfo:'',
        addedToFavList:false,
        data:data,
        isPrime:false,
        recommendedData:recommendedData,
      });
    }else{ // if video is prime and user is not login
      res.redirect('/');
    }
  }
});

/*************************  /kids *************************/
router.get('/cartoons',async function(req,res){
  var moviesData =await  movieModel.find({category:"cartoons"}).sort({ $natural: -1 }).exec();
  var carouselData = await movieModel.find({category:"cartoons"}).sort({ $natural: -1 }).limit(5).exec();
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('navbarTabPages', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"cartoons",
        isPrime:req.user.isPrime,
      });
    }else{
      res.render('navbarTabPages', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"cartoons",
        isPrime:req.user.isPrime,
      });
    }
  } else {
    res.render("navbarTabPages",
    {
      admin:false,
      user:false,
      userInfo:'',
      data : moviesData,
      carouselData:carouselData,
      path:"cartoons",
      isPrime:false,
    }
    );
  }
})
router.get('/cartoons/:path',async function(req,res){
  const path = req.params.path;
  const data = await movieModel.find({ path: path });
  var genre="comedy";
  var category="cartoons";
  if(data.length > 0 ){
    const genre = data[0].genre;
    const category = data[0].category;
  }else{
    res.redirect('/');
  }
  const recommendedData = await movieModel.find({genre:genre,category:category});
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    var addedToFavList = false;
    var favList = req.user.favorites;
    favList.forEach(function(item){
      if(item == data[0]._id){
        addedToFavList = true;
      }
    })
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.render('playvideo', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        addedToFavList:addedToFavList,
        data:data,
        isPrime:req.user.isPrime,
        recommendedData:recommendedData,
      });
    }else{
      if(data[0].isPrime && req.user.isPrime){//If video is not prime then user is not prime cannot  see
        res.render('playvideo', 
        { admin:false,
          user:true,
          userInfo:userInfo,
          addedToFavList:addedToFavList,
          data:data,
          isPrime:req.user.isPrime,
          recommendedData:recommendedData,
        });
      }else if(data[0].isPrime && !req.user.isPrime){
        res.redirect('back');
      }else{
        res.render("playvideo",{ admin:false,
          user:true,
          userInfo:userInfo,
          addedToFavList:addedToFavList,
          data:data,
          isPrime:req.user.isPrime,
          recommendedData:recommendedData,
        });
      }
    }
  } else {
    if(!data[0].isPrime){ //If video is not prime then user can see
      res.render("playvideo",{ admin:true,
        user:false,
        userInfo:'',
        addedToFavList:false,
        data:data,
        isPrime:false,
        recommendedData:recommendedData,
      });
    }else{ // if video is prime and user is not login
      res.redirect('/');
    }
  }
});

/************************** /addfavorite **********************/

router.get('/addfavorites/:id',function(req,res){
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    var videoId = req.params.id;
    var id = req.user.id;
    User.findByIdAndUpdate(id,{
      $push:{favorites:videoId}
    },function(err,data){
      if(err) throw err;
    })
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){ // checking if it is a Admin
      res.redirect('back');
    }else{
      res.redirect('back'); //this will redirect to same page.
    }
  } else {
    res.redirect('back');
  }
})

/*************************** /getPremium ***********************/

router.get('/getPremium',async function(req,res){
  if(req.isAuthenticated()){
    var userId = req.user.id  ;
    console.log(userId); 
    await User.findByIdAndUpdate({_id:userId}, {isPrime:true}).exec();
    res.redirect('/');
  }else{
   res.redirect('/');
  }
})

/********************************** /adminPrimeEditUser ******************/
router.post('/adminPrimeEditUser',async function(req,res){
  if(req.isAuthenticated()){
    if(req.user.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){
      var userId = req.body.id  ;
      var setPrime = req.body.isPrime;
      await User.findByIdAndUpdate({_id:userId}, {isPrime:setPrime}).exec();
      res.redirect('back');
    }
  }else{
   res.redirect('/');
  }
})


/*********************  login and logout **********************/
router.get("/login", (req, res) => {
  res.redirect('/');
});
router.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
})

/***************************  404 Case Page not found ************/
//this is for the 404 page
router.get('*', function(req, res){
  if(req.isAuthenticated()){
    var userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){
        res.render('404',
      {
        admin:true,
        user:true,
        userInfo:userInfo,
        isPrime:true,
      });
    }else{
        res.render('404',
      {
        admin:false,
        user:true,
        userInfo:userInfo,
        isPrime:req.user.isPrime,
      });
    }
  }else{
    res.render('404',
      {
        admin:false,
        user:false,
        userInfo:userInfo,
        isPrime:false,
      });
  }
});
router.get('/*', function(req, res){
  if(req.isAuthenticated()){
    var userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){
        res.render('404',
      {
        admin:true,
        user:true,
        userInfo:userInfo,
        isPrime:true,
      });
    }else{
        res.render('404',
      {
        admin:false,
        user:true,
        userInfo:userInfo,
        isPrime:req.user.isPrime,
      });
    }
  }else{
    res.render('404',
      {
        admin:false,
        user:false,
        userInfo:userInfo,
        isPrime:false,
      });
  }
  
});
router.get('404', function(req, res){
  if(req.isAuthenticated()){
    var userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com" || userInfo.email === "amans271999@gmail.com "){
        res.render('404',
      {
        admin:true,
        user:true,
        userInfo:userInfo,
        isPrime:true,
      });
    }else{
        res.render('404',
      {
        admin:false,
        user:true,
        userInfo:userInfo,
        isPrime:req.user.isPrime,
      });
    }
  }else{
    res.render('404',
      {
        admin:false,
        user:false,
        userInfo:userInfo,
        isPrime:false,
      });
  }
  
});


module.exports = router;
