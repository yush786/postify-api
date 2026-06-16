const cookieParser = require("cookie-parser");
const express = require("express");
const app = express();

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());
const multer = require("multer");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const mongoose = require("mongoose");
app.use(express.static(path.join(__dirname, "public")));

crypto.randomBytes(12, function(err,bytes){
  console.log(bytes.toString("hex"));
});
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images/uploads');
  },
  filename: function (req, file, cb) {
    crypto.randomBytes(12,function(err,bytes){
      if(err) return cb(err);
      const fn = bytes.toString("hex")+path.extname(file.originalname);
      cb(null,fn);
    });
  },
});

const upload = multer({ storage: storage });




// ---------------- DATABASE ----------------
mongoose.connect("mongodb://127.0.0.1:27017/miniproject");

const usermodel = require("./Models/usermodel");
const postmodel = require("./Models/post");

// ---------------- HOME ----------------
app.get("/", (req, res) => {
  res.render("index");
});

//----------------image upload----------------
app.get("/profile/uploads", (req, res) => {
  res.render("profileuploads");
});

app.post("/uploads", isloggedIn, upload.single("image"), async (req, res) => {
  console.log("UPLOAD ROUTE HIT");

  let user = await usermodel.findOne({ email: req.user.email });
  user.profilepic = req.file.filename;
  await user.save();
  
  res.redirect("/profile");
});

//---------------Multer----------------
app.get("/test", (req, res) => {
  res.render("test");
});


//----------------upload file----------------
app.post("/upload", upload.single("image"), (req, res) => {
 console.log(req.file);
  res.send("file uploaded successfully");
});

// ---------------- LOGIN PAGE ----------------
app.get("/login", (req, res) => {
  res.render("login");
});

// ---------------- PROFILE ----------------
// logged in user ka profile + posts
app.get("/profile", isloggedIn, async (req, res) => {
  let user = await usermodel.findOne({ email: req.user.email });
  await user.populate("posts");
  res.render("profile", { user });
});

// ---------------- LIKE / UNLIKE ----------------
// post ko like / unlike karta hai
app.get("/like/:id", isloggedIn, async (req, res) => {
  let post = await postmodel.findById(req.params.id);
  if (!post) return res.redirect("/profile");

  let userid = req.user.userid;

  if (post.likes.indexOf(userid) === -1) {
    post.likes.push(userid);
  } else {
    post.likes.pull(userid);
  }

  await post.save();
  res.redirect("/profile");
});

// ---------------- EDIT POST (GET) ----------------
// edit page open karta hai
app.get("/edit/:id", isloggedIn, async (req, res) => {
  let post = await postmodel.findById(req.params.id);
  res.render("edit", { post });
});

// ---------------- EDIT POST (POST) ----------------
// post update karta hai
app.post("/edit/:id", isloggedIn, async (req, res) => {
  let post = await postmodel.findById(req.params.id);

  // 🔐 ownership check
  if (!post || post.user.toString() !== req.user.userid) {
    return res.redirect("/profile");
  }

  post.content = req.body.content;
  await post.save();

  res.redirect("/profile");
});

// ---------------- CREATE POST ----------------
app.post("/post", isloggedIn, async (req, res) => {
  let user = await usermodel.findOne({ email: req.user.email });
  let { content } = req.body;

  let post = await postmodel.create({
    user: user._id,
    content,
  });

  user.posts.push(post._id);
  await user.save();

  res.redirect("/profile");
});

//---------------- DELETE POST ----------------
app.get("/delete/:id", isloggedIn, async (req, res) => {
  let post = await postmodel.findById(req.params.id);

  if (!post || post.user.toString() !== req.user.userid) {
    return res.redirect("/profile");
  }

  await postmodel.findByIdAndDelete(req.params.id);
  res.redirect("/profile");
});

// ---------------- REGISTER ----------------
app.post("/register", async (req, res) => {
  let { email, password, username, name, age } = req.body;

  let user = await usermodel.findOne({ email });
  if (user) return res.status(500).send("User already registered");

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      let user = await usermodel.create({
        username,
        name,
        age,
        email,
        password: hash,
      });

      let token = jwt.sign({ email, userid: user._id }, "secretkey");

      res.cookie("token", token);
      res.redirect("/profile");
    });
  });
});

// ---------------- LOGIN ----------------
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  let user = await usermodel.findOne({ email });
  if (!user) return res.redirect("/login");

  bcrypt.compare(password, user.password, (err, result) => {
    if (!result) return res.redirect("/login");

    let token = jwt.sign({ email: user.email, userid: user._id }, "secretkey");

    res.cookie("token", token);
    res.redirect("/profile");
  });
});

// ---------------- LOGOUT ----------------
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

// ---------------- AUTH MIDDLEWARE ----------------
function isloggedIn(req, res, next) {
  if (!req.cookies.token) return res.redirect("/login");

  try {
    let data = jwt.verify(req.cookies.token, "secretkey");
    req.user = data;
    next();
  } catch (err) {
    res.clearCookie("token");
    res.redirect("/login");
  }
}

// ---------------- SERVER ----------------
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
