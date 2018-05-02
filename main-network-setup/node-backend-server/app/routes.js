/**
 * File    : /server/app/routes.js
 * Purpose : Define the URL routes
 */
module.exports = function (app) {

	//DataBase Operations;
	var DatabaseConnector = require('./modules/database/databaseoperations.js')
	var database =  new DatabaseConnector(CONFIG.database.host,CONFIG.database.port);
	
	//Login and register APIs for organization
	var Login = require('./modules/business/login/login.js');
	var loginOperation = new Login(database)
	app.post('/login', loginOperation.login.bind(loginOperation));
	app.post('/register', loginOperation.register.bind(loginOperation));
	
	//API to get all the orgs along with their admins
	var Organizations = require('./modules/business/organization/organization.js');
	var orgOperation = new Organizations(database)
	app.get('/organization', orgOperation.getOrgs.bind(orgOperation));

	var BlockchainConnector = require('./modules/business/blockchain/blockchainconnector.js');
	var blockchainOperation = new BlockchainConnector();
	
	//API for asset management
	var Asset = require('./modules/business/asset/asset.js');
	var assetOperation = new Asset(database,blockchainOperation)
	app.post('/asset', passport.authenticate('jwt', { session: false }),authorization,assetOperation.createAsset.bind(assetOperation));
	app.get('/asset/all', passport.authenticate('jwt', { session: false }),authorization,assetOperation.getAssetByOrg.bind(assetOperation));
	app.put('/asset', passport.authenticate('jwt', { session: false }),authorization,assetOperation.editAsset.bind(assetOperation));
	app.post('/asset/transfer', passport.authenticate('jwt', { session: false }),authorization,assetOperation.transferAsset.bind(assetOperation));
	app.get('/asset/history/:assetid', passport.authenticate('jwt', { session: false }),authorization,assetOperation.getAssetHistory.bind(assetOperation));
	
};
