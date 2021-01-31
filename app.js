//Initializing Dependencies
require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const ran = require("./randomize.js");

const app = express();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

//Initializing Passport & Express Session
app.use(
  session({
    secret: "Our Secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

//Initializing MongoDB and Schema
mongoose.connect(
  "mongodb+srv://" +
    process.env.DB_USER +
    ":" +
    process.env.DB_PSWD +
    process.env.DB_CLUSTER,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secrets: [],
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

//Passport Hashing and Strategy
passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL:
        "https://dry-retreat-29280.herokuapp.com/auth/google/stories",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

//GET and POST Methods
app.get("/", function (req, res) {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/stories",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/stories");
  }
);

app.get("/submit", function (req, res) {
  if (req.isAuthenticated()) {
    User.findById(req.user._id, function (err, found) {
      if (err) {
        console.log(err);
      } else {
        if (found) {
          res.render("submit", {
            userSecrets: found.secrets,
            user: found,
          });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/stories", function (req, res) {
  if (req.isAuthenticated()) {
    let everySecret = [];
    User.find({ secrets: { $ne: null } }, function (err, found) {
      if (err) {
        console.log(err);
      } else {
        if (found) {
          found.forEach(function (user) {
            user.secrets.forEach(function (secret) {
              everySecret.push(secret);
            });
          });
          res.render("stories", { userSecrets: ran(everySecret) });
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/delete", function (req, res) {
  User.findById(req.body.userId, function (err, found) {
    if (err) {
      console.log(err);
    } else {
      found.secrets.splice(req.body.checkbox, 1);
      found.save();
      res.redirect("/submit");
    }
  });
});

app.post("/login", function (req, res) {
  if (req.body.username == "" || req.body.password == "") {
    res.redirect("/login");
  }
  const newUser = new User({
    email: req.body.username,
    password: req.body.password,
  });

  req.login(newUser, function (err) {
    if (err) {
      console.log(err);
      res.redirect("/login");
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/stories");
      });
    }
  });
});

app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/stories");
        });
      }
    }
  );
});

app.post("/submit", function (req, res) {
  const newSecret = req.body.secret;

  User.findById(req.user._id, function (err, found) {
    if (err) {
      console.log(err);
    } else {
      if (found) {
        found.secrets.push(newSecret);
        found.save();
        res.redirect("/stories");
      }
    }
  });
});

//initialize server
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function () {
  console.log("Server running on Port:" + port + "...");
});
