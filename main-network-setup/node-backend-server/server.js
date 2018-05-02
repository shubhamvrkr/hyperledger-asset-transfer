const log4js = require('log4js');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const helmet = require('helmet')
multer = require('multer');
fs =  require('fs')
path = require('path')
var cookieParser = require('cookie-parser')
jwt = require('jsonwebtoken');
const compression = require('compression');
const hpp = require('hpp');
passport = require("passport");
const passportJWT = require("passport-jwt");
bcrypt = require('bcrypt');
amqp = require('amqplib');
MongoClient = require('mongodb').MongoClient;
ObjectID = require('mongodb').ObjectID;
Client = require('fabric-client');

CONFIG = require('./config.json')
NETWORK_CONFIG = require('./network-config.json');

orgdetails=[];
for(var i=0;i<NETWORK_CONFIG.organization.length;i++){
	orgdetails[NETWORK_CONFIG.organization[i].name] = NETWORK_CONFIG.organization[i];
}

const ExtractJwt = passportJWT.ExtractJwt;
const JwtStrategy = passportJWT.Strategy;

//secretKey
jwtOptions = {}
jwtOptions.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme('jwt');
jwtOptions.secretOrKey = CONFIG.secret;

var strategy = new JwtStrategy(jwtOptions, function(jwt_payload, next) {
  
	console.log('payload received', jwt_payload.id);

	 user = {
		 "id":jwt_payload.id,
		 "org":jwt_payload.org,
		 "role":jwt_payload.role
	 }
    next(null, user);
});

authorization = function(req, res, next){
	
	if(req.user.role=="ADMIN" ){
		next(null, req.user);
	}
}

passport.use(strategy);


app.use(bodyParser.urlencoded({
	extended: true
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(helmet());
app.use(compression());
app.use(hpp());
app.use(passport.initialize());


app.use(function (req, res, next) {
	
	// Website you wish to allow to connect
	res.setHeader('Access-Control-Allow-Origin', '*');

	// Request methods you wish to allow
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

	// Request headers you wish to allow
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Authorization');

	next();
});

require('./app/routes.js')(app);
app.listen(9090);
console.log('Server is listening on port ' + 9090);


function getAdmin(client, keyfilepath,certfilepath,mspID,username){

	var keyPath = keyfilepath;
	var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
	var certPath = certfilepath;
	var certPEM = readAllFiles(certPath)[0];
	return Promise.resolve(client.createUser({
		username: username,
		mspid: mspID,
		cryptoContent: {
			privateKeyPEM: keyPEM.toString(),
			signedCertPEM: certPEM.toString()
		}
	}));

}

function readAllFiles(dir) {
	var files = fs.readdirSync(dir);
	var certs = [];
	files.forEach((file_name) => {
		let file_path = path.join(dir,file_name);
		let data = fs.readFileSync(file_path);
		certs.push(data);
	});
	return certs;
}



