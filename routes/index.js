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


/**************************** GET home page. ******************/
router.get('/',async function(req, res, next) {
  var moviesData =await  movieModel.find({category:"movies"}).sort({ $natural: -1 }).limit(10).exec();
  var sportsData =await  movieModel.find({category:"sports"}).sort({ $natural: -1 }).limit(10).exec();
  var newsData   =await  movieModel.find({category:"news"}).sort({ $natural: -1 }).limit(10).exec();
  var cartoonsData=await  movieModel.find({category:"cartoons"}).sort({ $natural: -1 }).limit(10).exec();
  var len =await moviesData.length;
  var carouselData = await movieModel.find({category:"movies"}).limit(5).exec();
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
      });
    }else{
      res.render('playvideo', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        addedToFavList:addedToFavList,
        data:data
      });
    }
  } else {
    res.render("playvideo",{ admin:true,
      user:false,
      userInfo:'',
      addedToFavList:false,
      data:data,
    });
  }
})
/******************************* /userAccount *********************/
router.get('/userAccount',async function(req,res){
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    var favArray = req.user.favorites;
    var favoriteData = await movieModel.find({_id:{$in:favArray}}).exec(); // Is is for fetching multiple data .
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.render('userAccount', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        favoriteData:favoriteData,
      });
    }else{
      res.render('userAccount', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        favoriteData,favoriteData,
      });
    }
  } else {
    res.redirect("/");
  }
})

router.get('/userAccount/del/:id',async function(req,res){
  var id = req.params.id;
  if (req.isAuthenticated()) {
    userInfo = req.user;
    console.log(req.user._id);
    var userId = req.user.id;
    await User.update({_id:userId},{$pull:{"favorites":id}}).exec(); // It deletes the string from array of string .
    console.log(req.user);
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.redirect('back');
    }else{
      res.redirect('back');
    }
  } else {
    res.redirect("/");
  }
})

/************************************  Admin **************************/

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
router.get('/admin/del/:id',function(req,res){
  if (req.isAuthenticated()) {
    userInfo = req.user;
    var id = req.params.id;
    alert('Are you sure you want to delete this user ?');
    var del = User.findByIdAndDelete(id); // It deletes the string from array of string .
    del.exec(function(err,data){
      if(err) throw err;
    })
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.redirect('back');
    }else{
      res.redirect('back');
    }
  } else {
    res.redirect("/");
  }
})

router.get('/adminmovies',async function(req,res){
  var data =await  movieModel.find({category:"movies"}).sort({ $natural: -1 }).exec();
  if (req.isAuthenticated()) {
    userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
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
router.get('/admin/delVideo/:id',function(req,res){
  console.log(req.params.id);
  if (req.isAuthenticated()) {
    userInfo = req.user;
    var id = req.params.id;
    var del = movieModel.findByIdAndDelete(id); // It deletes the string from array of string .
    del.exec(function(err,data){
      if(err) throw err;
    })
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.redirect('back');
    }else{
      res.redirect('back');
    }
  } else {
    res.redirect("back");
  }
})
router.get('/adminsports',async function(req,res){
  var data =await  movieModel.find({category:"sports"}).sort({ $natural: -1 }).exec();
  if (req.isAuthenticated()) {
    userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
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
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
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
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
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
router.post('/editVideos',upload.single('imagePath'),function(req,res){
  var movieName = req.body.title;
  var shortDesc = req.body.shortDesc;
  var longDesc =req.body.longDesc;
  var movieUrl = req.body.link;
  var isPrime = req.body.isPrime;
  var category = req.body.category;
  var genre = req.body.genre;
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
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.render('navbarTabPages', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"movies",
      });
    }else{
      res.render('navbarTabPages', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"movies",
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
    }
    );
  }
})
router.get('/movies/:path',async function(req,res){
  const path = req.params.path;
  const data = await movieModel.find({ path: path });
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    var addedToFavList = false;
    var favList = req.user.favorites;
    favList.forEach(function(item){
      if(item == data[0]._id){
        addedToFavList = true;
      }
    })
    console.log(addedToFavList);
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.render('playvideo', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        data:data,
        addedToFavList:addedToFavList,
      });
    }else{
      res.render('playvideo', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        data:data,
        addedToFavList:addedToFavList,
      });
    }
  } else {
    res.render("playvideo",{ admin:true,
      user:false,
      userInfo:'',
      data:data,
      addedToFavList:false,
    });
  }
});

/*************************  /sports *************************/
router.get('/sports',async function(req,res){
  var moviesData =await  movieModel.find({category:"sports"}).sort({ $natural: -1 }).exec();
  var carouselData = await movieModel.find({category:"sports"}).sort({ $natural: -1 }).limit(5).exec();
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.render('navbarTabPages', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"sports",
      });
    }else{
      res.render('navbarTabPages', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"sports",
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
    }
    );
  }
})
router.get('/sports/:path',async function(req,res){
  const path = req.params.path;
  const data = await movieModel.find({ path: path });
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
      });
    }else{
      res.render('playvideo', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        addedToFavList:addedToFavList,
        data:data
      });
    }
  } else {
    res.render("playvideo",{ admin:true,
      user:false,
      userInfo:'',
      addedToFavList:false,
      data:data,
    });
  }
});


/*************************  /news *************************/
router.get('/news',async function(req,res){
  var moviesData =await  movieModel.find({category:"news"}).sort({ $natural: -1 }).exec();
  var carouselData = await movieModel.find({category:"news"}).sort({ $natural: -1 }).limit(5).exec();
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.render('navbarTabPages', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"news",
      });
    }else{
      res.render('navbarTabPages', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"news",
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
    }
    );
  }
})
router.get('/news/:path',async function(req,res){
  const path = req.params.path;
  const data = await movieModel.find({ path: path });
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
      });
    }else{
      res.render('playvideo', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        addedToFavList:addedToFavList,
        data:data
      });
    }
  } else {
    res.render("playvideo",{ admin:true,
      user:false,
      userInfo:'',
      addedToFavList:false,
      data:data,
    });
  }
});

/*************************  /kids *************************/
router.get('/cartoons',async function(req,res){
  var moviesData =await  movieModel.find({category:"cartoons"}).sort({ $natural: -1 }).exec();
  var carouselData = await movieModel.find({category:"cartoons"}).sort({ $natural: -1 }).limit(5).exec();
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.render('navbarTabPages', 
      { admin:true,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"cartoons",
      });
    }else{
      res.render('navbarTabPages', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        data : moviesData,
        carouselData:carouselData,
        path:"cartoons",
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
    }
    );
  }
})
router.get('/cartoons/:path',async function(req,res){
  const path = req.params.path;
  const data = await movieModel.find({ path: path });
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
      });
    }else{
      res.render('playvideo', 
      { admin:false,
        user:true,
        userInfo:userInfo,
        addedToFavList:addedToFavList,
        data:data
      });
    }
  } else {
    res.render("playvideo",{ admin:true,
      user:false,
      userInfo:'',
      addedToFavList:false,
      data:data,
    });
  }
});

/************************** /addfavorite **********************/

router.get('/addfavorites/:id',function(req,res){
  if (req.isAuthenticated()) {
    const userInfo = req.user;
    var videoId = req.params.id;
    var id = req.user.id;
    console.log(videoId);
    User.findByIdAndUpdate(id,{
      $push:{favorites:videoId}
    },function(err,data){
      if(err) throw err;
    })
    if(userInfo.email === "ashishkumarguptacse@gmail.com"){ // checking if it is a Admin
      res.redirect('back');
    }else{
      res.redirect('back'); //this will redirect to same page.
    }
  } else {
    res.redirect('/');
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
