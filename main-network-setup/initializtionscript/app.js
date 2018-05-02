
const Client = require('fabric-client');
const fs = require('fs');
const path = require('path');

let configdata = fs.readFileSync('config.json');  
let config = JSON.parse(configdata);

let tls = config.tls;

let orgdetails=[];
for(var i=0;i<config.organization.length;i++){

	orgdetails[config.organization[i].name] = config.organization[i];
}

var orderer;
var totalorgsjoinedchannel = 0;
var totalorgsinstallchannel = 0;
var channel = null;
//creates the client object 
var client = new Client();


var caRootsPath = config.orderer.tlscertpath;
let data = fs.readFileSync(caRootsPath);
let caroots = Buffer.from(data).toString();
orderer = client.newOrderer(
	config.orderer.url,
	{
		'pem': caroots,
		'ssl-target-name-override': config.orderer.name
	}
);



createChannel(config.channel.channelname,config.organization[0].mspid,config.organization[0].admin);


//install the chaincode on the specified peer node
//The SDK will read the GOPATH environment from the host machine
//The full path from where the SDK will read the chaincode will be $GOPATH + src + specified path(e.g chaincode)
//install will just install the source code and dependencies on the peers
//Not necessary that install has to be called after create and join channel request, admin can install chaincode independent of any operation.
//installchaincode(org1peersurl,'org1',org1mspid,"chaincode","mychaincodeid","v0");
//installchaincode(org2peersurl,'org2',org2mspid,"chaincode","mychaincodeid","v0");

function createChannel(channel_name,org1mspid,admin){

	console.log("************CREATING THE CHANNEL**********");
	var signatures= [];
	//return instance of the KeyValueStore which is used to store to save sensitive information such as authenticated user's private keys, certificates, etc.
	Client.newDefaultKeyValueStore({
			path: "./hfc-test-kvs/"+org1mspid
	}).then((store) => {

		client.setStateStore(store);
		return getAdmin(client, admin.keypath,admin.certpath,org1mspid,admin.username);
			
	}).then((admin) =>{
		
		let envelope_bytes = fs.readFileSync(config.channel.channelartifacts);
		configtemp = client.extractChannelConfig(envelope_bytes);

		//signs the config object
		var signature = client.signChannelConfig(configtemp);
		//encodes the signature in buffer to hex 
		var string_signature = signature.toBuffer().toString('hex');
		
		//adds to the signature array defined above
		signatures.push(string_signature);
		signatures.push(string_signature);
		
		//generates transaction id
		let tx_id = client.newTransactionID();
		
		// builds the create channel request
		var request = {
			config: configtemp,
			signatures : signatures,
			name : channel_name,
			orderer : orderer,
			txId  : tx_id
		};
		// send create request to orderer
		return client.createChannel(request);
			
	}).then((result) => {
		
	
		if(result.status && result.status === 'SUCCESS') {

			console.log('Successfully created the channel...SUCCESS 200');
			sleep(5000).then(()=>{
				console.log('\nSleeping for 5 sec...');
				joinChannel(channel_name,config.organization[0].mspid,config.organization[0].admin,config.organization[0].peers,config.organization[0].tlscertpath).then(()=>{

						return sleep(5000).then(()=>{
							console.log('\nSleeping for 5 sec...');
							return joinChannel(channel_name,config.organization[1].mspid,config.organization[1].admin,config.organization[1].peers,config.organization[1].tlscertpath)
						});
						
				}).then(()=>{
						return sleep(5000).then(()=>{
							    console.log('\nSleeping for 5 sec...');
								return joinChannel(channel_name,config.organization[2].mspid,config.organization[2].admin,config.organization[2].peers,config.organization[2].tlscertpath)
						});

				}).then(()=>{
						return sleep(5000).then(()=>{
							console.log('\nSleeping for 5 sec...');
							return joinChannel(channel_name,config.organization[3].mspid,config.organization[3].admin,config.organization[3].peers,config.organization[3].tlscertpath)
						});
				}).then(()=>{
					return installchaincode(config.chaincode.chaincodepath,config.chaincode.chaincodeid,config.chaincode.chaincodeversion,config.organization[0].peers,config.organization[0].admin,config.organization[0].mspid,config.organization[0].tlscertpath)
					
				}).then(()=>{
					return installchaincode(config.chaincode.chaincodepath,config.chaincode.chaincodeid,config.chaincode.chaincodeversion,config.organization[1].peers,config.organization[1].admin,config.organization[1].mspid,config.organization[1].tlscertpath)
				
				}).then(()=>{
					return installchaincode(config.chaincode.chaincodepath,config.chaincode.chaincodeid,config.chaincode.chaincodeversion,config.organization[2].peers,config.organization[2].admin,config.organization[2].mspid,config.organization[2].tlscertpath)
				
				}).then(()=>{
					return installchaincode(config.chaincode.chaincodepath,config.chaincode.chaincodeid,config.chaincode.chaincodeversion,config.organization[3].peers,config.organization[3].admin,config.organization[3].mspid,config.organization[3].tlscertpath)
				}).then(()=>{

					instantiateChaincode(config.channel.channelname,orgdetails,config.organization[0].tlscertpath,config.organization[0].mspid,config.organization[0].admin,config.chaincode.chaincodepath,config.chaincode.chaincodeversion,config.chaincode.chaincodeid,config.organization[0].peers,config.organization[1].mspid,config.organization[2].mspid,config.organization[3].mspid)
				
				});
			});
			
			
		} else {

			console.error('\nFailed to create the channel. ');
		}

	}, (err) => {

		console.error('\nFailed to create the channel: ' , err);
			
	}).then((nothing) => {

	}, (err) => {
		console.error('\nFailed to sleep due to error: ', err);
	});
}
 
function joinChannel(channel_name,mspID,admin,peers,tlscertpath){

	console.log("************JOINING THE ORGS "+mspID+" TO THE CHANNEL**********");

	var genesis_block =null;
	//gets the channel object from the client object that we created globally
	if(channel==null){
		channel = client.newChannel(channel_name);
		channel.addOrderer(orderer)	
	}

	var targets = [];
	return new Promise((resolve,reject)=>{
		
		Client.newDefaultKeyValueStore({
			path: "./hfc-test-kvs/"+mspID
		}).then((store) => {
			
			client.setStateStore(store);
			return getAdmin(client, admin.keypath,admin.certpath,mspID,admin.username);
			
		}).then((admin) => {
		
			tx_id = client.newTransactionID();
			//build a request object for getting the genesis block for the channel from ordering service
			let request = {
				txId : 	tx_id
			};
			//request genesis block from ordering service
			return channel.getGenesisBlock(request);
			
		}).then((block) =>{

			genesis_block = block;		
			return getAdmin(client, admin.keypath,admin.certpath,mspID,admin.username);
			
		}).then((admin) => {
		
			//client.newPeer returns a peer object initialized with URL and its tls certificates and stores in a array named target
			//admin of org can choose which peers to join the channel
			for (var i=0;i<peers.length;i++) {

				let peer = peers[i];
				data = fs.readFileSync(tlscertpath);
				if(tls){
					targets.push(client.newPeer(
									peer.url,
									{
										pem: Buffer.from(data).toString(),
										'ssl-target-name-override': peer.name
									}
								)
					);

				}else{
					targets.push(client.newPeer(peer.url));
				}
				
			}
			var tx_id = client.newTransactionID();
			//builds the join channel request with genesis block and peers(targets)
			let request = {
				targets : targets,
				block : genesis_block,
				txId : 	tx_id
			};
			//request specified peers to join the channel
			return channel.joinChannel(request);
			
		}, (err) => {
		
			console.error('Failed to enroll user admin due to error: ' + err);
			reject();
			
		}).then((results) => {
		
			if(results[0] && results[0].response && results[0].response.status == 200) {
				console.log("ORG "+mspID+" sucessfully joined the channel")
				resolve();

			} else {
				console.error(' Failed to join channel');
				reject();
			}
		}, (err) => {
			console.error('Failed to join channel due to error: ' + err);
			reject();
		});
	});
}

function installchaincode(chaincodepath,chaincodeid,chaincodeversion,peers,admin,orgmspid,tlscertpath){

	console.log("************INSTALLING THE CHAINCODE ON "+orgmspid+" **********");
	var targets = [];
	for (var i=0;i<peers.length;i++) {
		
		let peer = peers[i];
		data = fs.readFileSync(tlscertpath);
	
		if(tls){
			let peer_obj = client.newPeer(
								peer.url,
								{
									pem: Buffer.from(data).toString(),
									'ssl-target-name-override': peer.name
								}
							);
			targets.push(peer_obj);
		}else{

			let peer_obj = client.newPeer(peer.url);
			targets.push(peer_obj);
		}
		
	}
 return new Promise((resolve,reject)=>{

		Client.newDefaultKeyValueStore({
			path: "./hfc-test-kvs/"+orgmspid
		}).then((store) => {
		
			client.setStateStore(store);
			return getAdmin(client, admin.keypath,admin.certpath,orgmspid,admin.username);
			
		}).then((admin) => {
			
			var request = {
				targets: targets,
				chaincodePath: chaincodepath,
				chaincodeId: chaincodeid,
				chaincodeVersion: chaincodeversion
			};
			
			return client.installChaincode(request);
			
		},(err) => {

			console.error('Failed to enroll user \'admin\'. ' + err);
			reject()

		}).then((results) => {
			
			//gets response of peers and check the response status
			var proposalResponses = results[0];
			var proposal = results[1];
			var all_good = true;
			var errors = [];
			for(var i in proposalResponses) {
				let one_good = false;
				if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
					one_good = true;
					
				} else {
					one_good = false;
				}
				all_good = all_good & one_good;
			}
			if (all_good) {
				console.log('\nSuccessfully installed chaincode on '+orgmspid);
				resolve()
			}
		},
		(err) => {
			console.error('Failed to send install proposal due to error: ',err);
			reject()
		});
  });
}

function instantiateChaincode(channel_name,orgdetails,tlscertpath,mspid,admin,chaincodePath, chaincodeVersion,chaincodeID,eventpeers,mspid2,mspid3,mspid4){

	console.log("************ INSTANTIATING CHAINCODE **********");
	//sets the timeout for the request, make sure you set enough time out because on the request peer build a container for chaincode 
	//and it make take some more time to send the response
	Client.setConfigSetting('request-timeout', 1000000);
	
	var type = 'instantiate';
	var targets = [];
	if(channel==null){
		channel = client.newChannel(channel_name);
		channel.addOrderer(orderer)	
	}
	
	for(var m in orgdetails){

		var organization = orgdetails[m];
		//return peers object of org1 
		for (var i=0;i<organization.peers.length;i++) {

			let peer = organization.peers[i];
			data = fs.readFileSync(organization.tlscertpath);
			if(tls){
					let peer_obj = client.newPeer(
								peer.url,
								{
									pem: Buffer.from(data).toString(),
									'ssl-target-name-override': peer.name
								}
							);
					targets.push(peer_obj);
					channel.addPeer(peer_obj);
			}else{

					let peer_obj = client.newPeer(peer.url);
					targets.push(peer_obj);
					channel.addPeer(peer_obj);
			}
		}
	}

	Client.newDefaultKeyValueStore({
		path: "./hfc-test-kvs/"+mspid
	}).then((store) => {
	
		client.setStateStore(store);
		return getAdmin(client, admin.keypath,admin.certpath,mspid,admin.username);

	}).then((admin) => {

		return channel.initialize();
		
	}, (err) => {

		console.error('Failed to enroll user admin ',err);
	
	}).then(() => {
	
			let request = buildChaincodeProposal(client, chaincodePath, chaincodeVersion,chaincodeID,mspid,mspid2,mspid3,mspid4);
			tx_id = request.txId;
			return channel.sendInstantiateProposal(request);
	
	}, (err) => {

		console.error('Failed to initialize the channel: ',err);
	
		
	}).then((results) => {
		
		//gets the endorsement response from the peer and check if enough peers have endorsed the transaction
		var proposalResponses = results[0];
		var proposal = results[1];
		var all_good = true;
		for (var i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[0].response &&
				proposalResponses[0].response.status === 200) {
				one_good = true;
			} 
			all_good = all_good & one_good;
		}
		if (all_good) {

			//building the request to send the obtained proposal from peers to the orderer
			var request = {
				proposalResponses: proposalResponses,
				proposal: proposal
			};
			var deployId = tx_id.getTransactionID();

			eh = client.newEventHub();
			let data = fs.readFileSync(tlscertpath);
			if(tls){
				eh.setPeerAddr(eventpeers[0].eventurl, {
						pem: Buffer.from(data).toString(),
						'ssl-target-name-override': peers[0].name
					});
			}else{
				eh.setPeerAddr(eventpeers[0].eventurl);
			}
			eh.connect();
			console.log("connecting to event hub")
			console.log(eh.isconnected())
			let txPromise = new Promise((resolve, reject) => {
				let handle = setTimeout(() => {
					eh.disconnect();
					reject();
				}, 30000);

				eh.registerTxEvent(deployId, (tx, code) => {

					clearTimeout(handle);
					eh.unregisterTxEvent(deployId);
					eh.disconnect();
					if (code !== 'VALID') {

						console.log("Instantiate tx is invalid")
						reject();
					} else {
						console.log("Instantiate tx is valid")
						resolve();
					}
				});
			});
			//sends the obtained respose from peers to orderer for ordering
			var sendPromise = channel.sendTransaction(request);
			return Promise.all([sendPromise].concat([txPromise])).then((results) => {
				
				return results[0]; 
			
			}).catch((err) => {
				console.error('Failed to send instantiate transaction and get notifications within the timeout period: ' ,err);
				return 'Failed to send instantiate transaction and get notifications within the timeout period.';
			});
		
		} else {
		
			console.error('Failed to send instantiate Proposal or receive valid response. Response null or status is not 200. exiting...');
		}
	
	},(err) => {
	
		console.error('Failed to send instantiate proposal due to error: ',err);
	
		
	}).then((response) => {
	
		//gets the response from the orderer and verifies the response status
		if (response.status === 'SUCCESS') {
			console.log('Successfully instantiated chaincode');
		} else {
			console.error('Failed to order the transaction. Error code: ',response);
		}
	}, (err) => {
		console.error('Failed to send instantiate due to error: ',err);
	});
}

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

function buildChaincodeProposal(client, chaincode_path, version,chaincodeID,mspid1,mspid2,mspid3,mspid4){
	
	var tx_id = client.newTransactionID();

	// build instantiate proposal to send for endorsement
	//specify the function name , arguments , endorsement-policy etc
	var request = {
		chaincodePath: chaincode_path,
		chaincodeId: chaincodeID,
		chaincodeVersion: version,
		fcn: 'init',
		args: [],
		txId: tx_id,
		// use this to demonstrate the following policy:
		// 'if signed by org1 admin, then that's the only signature required,
		// but if that signature is missing, then the policy can also be fulfilled
		// when members (non-admin) from both orgs signed'
		'endorsement-policy': {
			identities: [
				{ role: { name: 'member', mspId: mspid1 }},
				{ role: { name: 'member', mspId: mspid2 }},
				{ role: { name: 'member', mspId: mspid3 }},
				{ role: { name: 'member', mspId: mspid4 }},
				{ role: { name: 'admin', mspId: mspid1}}
			],
			policy: {
				'1-of': [
					{ 'signed-by': 4},
					{ '1-of': [{ 'signed-by': 0}, { 'signed-by': 1 }, { 'signed-by': 2 }, { 'signed-by': 3 }]}
				]
			}
		}
	};

	return request;

}

function sleep(time){
	return new Promise((resolve,reject)=>{
		setTimeout(function(){
			resolve();
		}, time);
	});
}