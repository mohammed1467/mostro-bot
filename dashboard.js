require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/login', passport.authenticate('discord'));
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/dashboard');
});

function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

app.get('/dashboard', checkAuth, (req, res) => {
    res.render('index', { user: req.user });
});

app.listen(3000, () => console.log('🌐 Dashboard يعمل على المنفذ 3000'));
