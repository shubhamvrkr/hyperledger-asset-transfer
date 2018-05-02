"use strict";
class BlockchainConnector {

    constructor () {
	}
	
	queryChaincode(config,org,functionname,args,callback){
		
		console.log("args: ",args)
		var targets = [];
		var client = new Client();
		var channel = client.newChannel(config.channel.channelname);
		var caRootsPath = config.orderer.tlscertpath;
		let data = fs.readFileSync(caRootsPath);
		let caroots = Buffer.from(data).toString();
		let orderer = client.newOrderer(
			config.orderer.url,
			{
				'pem': caroots,
				'ssl-target-name-override': config.orderer.name
			}
		);
		channel.addOrderer(orderer)
		
		var organization  = orgdetails[org];
		console.log("organization: ",organization);
		
		for (var i=0;i<organization.peers.length;i++) {

				let peer = organization.peers[i];
				data = fs.readFileSync(organization.tlscertpath);
				if(organization.tls){
					var newpeer = client.newPeer(
									peer.url,
									{
										pem: Buffer.from(data).toString(),
										'ssl-target-name-override': peer.name
									}
								);
					targets.push(newpeer);
					channel.addPeer(newpeer);

				}else{
					var newpeer = client.newPeer(peer.url);
					targets.push(newpeer);
					channel.addPeer(newpeer);
					
				}
				
		}
		
		Client.newDefaultKeyValueStore({
			path: "./hfc-test-kvs/"+organization.mspid
		}).then((store) => {

				client.setStateStore(store);
				return getAdmin(client, organization.admin.keypath, organization.admin.certpath, organization.mspid, organization.admin.username);
		
		}).then((admin) => {
			
			return channel.initialize();
			
		}, (err) => {
			
			callback(err,null);
			
		}).then(() => {
	
			var tx_id = client.newTransactionID();

			// build query request
			var request = {
				chaincodeId: config.chaincode.chaincodeid,
				txId: tx_id,
				fcn: functionname,
				args: args
			};
			
			//send query request to peers
			return channel.queryByChaincode(request, targets);
	
		}, (err) => {
			
			console.log('Failed to initialize the channel: ',err);
			callback(err,null)
			
		}).then((response_payloads) =>{
	
			console.log(response_payloads[0]);
			if (response_payloads) {

				callback(null,response_payloads[0].toString('utf8'))
			}else{
				callback(null,null);
			}				
			
		},(err) => {
			
			console.log('Failed to send query due to error: ',err);
			callback(err,null)
	
		});
	}
	
	
	invokeChaincode(config,org,functionname,args,callback){
		
		console.log("args: ",args[0])
		var targets = []
		var message = {};
		var invokeId = null;
		var tx_id = null;
		var eh = null;
		var client = new Client();
		var channel = client.newChannel(config.channel.channelname);
		var caRootsPath = config.orderer.tlscertpath;
		let data = fs.readFileSync(caRootsPath);
		let caroots = Buffer.from(data).toString();
		let  orderer = client.newOrderer(
			config.orderer.url,
			{
				'pem': caroots,
				'ssl-target-name-override': config.orderer.name
			}
		);
		channel.addOrderer(orderer)
		
		var organization  = orgdetails[org];
		console.log("organization: ",organization);
		
		for (var i=0;i<organization.peers.length;i++) {

				let peer = organization.peers[i];
				data = fs.readFileSync(organization.tlscertpath);
				if(organization.tls){
					var newpeer = client.newPeer(
									peer.url,
									{
										pem: Buffer.from(data).toString(),
										'ssl-target-name-override': peer.name
									}
								)
					targets.push(newpeer);
					channel.addPeer(newpeer);	

				}else{
					var newpeer = client.newPeer(peer.url);
					targets.push(newpeer);
					channel.addPeer(newpeer);	
				}
				
		}
		
		Client.newDefaultKeyValueStore({
			path: "./hfc-test-kvs/"+organization.mspid
		}).then((store) => {

				client.setStateStore(store);
				return getAdmin(client, organization.admin.keypath, organization.admin.certpath, organization.mspid, organization.admin.username);
		
		}).then((admin) => {
			
			return channel.initialize();
			
		}, (err) => {
			console.log("Error in enrolling admin: ",err.message);
			callback(err,null);
			
		}).then(() => {
	
			tx_id = client.newTransactionID();

			// build query request
			var request = {
				chaincodeId: config.chaincode.chaincodeid,
				txId: tx_id,
				fcn: functionname,
				args: args
			};
			
			//send query request to peers
			return channel.sendTransactionProposal(request);
	
		}, (err) => {
			
			console.log('Failed to initialize the channel: ',err);
			callback(err,null)
			
		}).then((results) =>{
	
				//get the endorsement response from the peers and check for response status
				let pass_results = results;
				console.log("Results: ",results[0][0].details)
				var proposalResponses = pass_results[0];

				var proposal = pass_results[1];
				var all_good = true;
				for(var i in proposalResponses) {
					let one_good = false;
					let proposal_response = proposalResponses[i];
					if( proposal_response.response && proposal_response.response.status === 200) {
						console.log('transaction proposal has response status of good');
						one_good = channel.verifyProposalResponse(proposal_response);
						if(one_good) {
							console.log(' transaction proposal signature and endorser are valid');
						}
					} else {
						console.log('transaction proposal was bad');
					}
					all_good = all_good & one_good;
				}
				if (all_good) {
					
					//checks if the proposal has same read/write sets.
					//This will validate that the endorsing peers all agree on the result of the chaincode execution.
					all_good = channel.compareProposalResponseResults(proposalResponses);
					if(all_good){
						console.log(' All proposals have a matching read/writes sets');
					}
					else {
						console.log(' All proposals do not have matching read/write sets');
					}
				}
			if (all_good) {
				
				// check to see if all the results match
				console.log('Successfully sent Proposal and received ProposalResponse');
				console.log('Successfully sent Proposal and received ProposalResponse: ', proposalResponses[0].response.status, proposalResponses[0].response.message, proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature);

				var request = {
					proposalResponses: proposalResponses,
					proposal: proposal
				};
				invokeId = tx_id.getTransactionID();
				
			/*	var eh = client.newEventHub();
				let data = fs.readFileSync(organization.tlscertpath);
				if(config.tls){

						eh.setPeerAddr(organization.peers[0].eventurl, {
							pem: Buffer.from(data).toString(),
							'ssl-target-name-override': organization.peers[0].name
						});

				}else{
					console.log(organization.peers[0].eventurl)
					eh.setPeerAddr(organization.peers[0].eventurl);
				}
				eh.connect();

				let txPromise = new Promise((resolve, reject) => {
						let handle = setTimeout(() => {
							eh.disconnect();
							reject();
						}, 30000);

						eh.registerTxEvent(invokeId, (tx, code) => {
							console.log('The chaincode invoke transaction has been committed on peer ',eh._ep._endpoint.addr);
							clearTimeout(handle);
							eh.unregisterTxEvent(invokeId);
							eh.disconnect();
							if (code !== 'VALID') {
								console.log("Invoke tx is invalid")
								reject();
								
							} else {
								console.log("Invoke tx is valid")
								resolve();
							}
						});
				});*/
				
				//sends the endorsement response to the orderer for ordering
				var sendPromise = channel.sendTransaction(request);
				
				return Promise.all([sendPromise]).then((results) => {
					console.log("result: ",results);
					return results[0];
									
				}).catch((err) => {
					console.log("Error while sending to the orderer: ",err);
					message.status= "FAILURE",
					message.message= 'Failed to send instantiate transaction and get notifications within the timeout period.'
					return message;
				});
			
			}else{
			
				message.status= "FAILURE",
				message.message= pass_results[0][0].details
			
				return message
			}
	
		}).then((response) => {

			//gets the final response from the orderer and check the response status
			if (response.status === 'SUCCESS') {
				
				console.log("finalresponse: ",response);
				message.status = "SUCCESS";
				message.message =invokeId
				callback(null,message)
			
			} else {
				console.log('Failed to order the transaction');
				callback(null,message)
			}
		}, (err) => {

			console.log('Failed to send transaction due to error: ',err);
			callback(err,null)
		});
	}
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

module.exports = BlockchainConnector;
