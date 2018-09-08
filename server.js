var express = require('express');
var app = express();
var http = require('http').Server(app);
var cors = require('cors');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var request = require('request');
var storage = require('node-persist');
var querystring = require('querystring');
var refresh = require('spotify-refresh');
require('dotenv').config();

storage.initSync();

var stateKey = 'spotify_auth_state';
var redirect_uri = 'http://localhost:3000/callback'

function getIDfromUrl(url) {
  var split1 = url.split('/');
  var split2 = split1[4].split('?');

  return split2[0];
}
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

app.use('/public', express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(cookieParser());

app.get('/login', function(req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);
  var scope = 'user-read-private user-read-email playlist-modify-private playlist-modify-public';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: process.env.CLIENT_ID,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;



        res.redirect('/added#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.post('/song', function(req, res) {
  refresh(process.env.REFRESH_TOKEN, process.env.CLIENT_ID, process.env.CLIENT_SECRET, function(err, res, body) {
    if (err) return err;
    request.post({
      url: 'https://api.spotify.com/v1/playlists/5dPp7yV9i8mELe1Kk9UC6D/tracks?uris=spotify%3Atrack%3A' +
        getIDfromUrl(req.body.submituri),
      headers: {
        'Authorization': 'Bearer ' + body.access_token,
        'Host': 'api.spotify.com',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      json: true
    });
  });

  console.log("added " + getIDfromUrl(req.body.submituri) + " to the playlist");
  res.redirect("/added");
})


app.get("/", function(err, res) {
  res.sendFile(__dirname + "/index.html");
})
app.get("/added", function(err, res) {
  res.sendFile(__dirname + "/added.html");
})

http.listen(3000);
