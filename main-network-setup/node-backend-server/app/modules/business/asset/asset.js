"use strict";
class Asset {

    constructor (db,bc) {
		
        this.database = db;
		this.collectionName = "assets";
		this.blockchainconnector = bc;
	}
		
	getAssetByOrg(req, res, next){
		
		console.log("***************GET ASSETS BY ORG*************");
		
		var self = this;
		
		var org = req.user.org;
		console.log("org: ",org);
		
		self.blockchainconnector.queryChaincode(NETWORK_CONFIG,org,"getassetsowned",[],function(err,result){
			
				if(err!=null){
					res.status(500).json(err.message);
				}
				var promises = [];
				result = JSON.parse(result);
				console.log("result: ",result);
				console.log("asset1: ",result[0]);
				for (var i in result){
					let assetid = result[i];
					promises.push(new Promise((resolve, reject)=>{
							self.blockchainconnector.queryChaincode(NETWORK_CONFIG,org,"getassetdetails",[assetid.toString()],function(err,assetDetails){
								
									if(err!=null){
										reject(err);
									}else{	
										
										var assetObject =  {
											"details":assetDetails
										}
										self.database.getObject(self.collectionName,{id:assetid},function(err,assetTxList){
											
											if(err){
												reject(err);
											}else{
												if(assetTxList==null){
													assetObject.tx = [];
												}else{
													assetTxList = assetTxList[0];
													assetObject.tx  = assetTxList;
												}
												resolve(assetObject)
											}
										});
									}
							});
						
					}));
				}
				Promise.all(promises).then(function(result) {
						res.status(200).json(result);
						
				}).catch(function(err) {
					res.status(500).json(err.message);
				});	
		});
	}
	
	getAssetHistory(req, res, next){
		
		console.log("***************GET ASSETS HISTORY*************");
		var self= this;
		var assetid = req.params.assetid;
		var org = req.user.org;
		
		console.log("assetID: ",assetid);
		console.log("org: ",org);
		
		self.blockchainconnector.queryChaincode(NETWORK_CONFIG,org,"getassethistory",[assetid.toString()],function(err,result){
				if(err!=null){
					
					res.status(500).json(err.message);
				}
				res.status(200).json(result);
		});
		
	}
	
	createAsset(req, res, next){
		
		console.log("***************CREATE ASSETS *************");
		
		var self = this;
		
		var assetid = req.body.asset.id;
		var parents = req.body.asset.parents;
		var metadata = req.body.asset.metadata;

		var org = req.user.org;

		self.blockchainconnector.invokeChaincode(NETWORK_CONFIG,org,"createasset",[assetid.toString(),metadata.toString(),parents.toString()],function(err,response){
			
			if(err!=null){
				res.status(500).json(err.message);
			}else{
				
				if(response.status=="FAILURE"){
					res.status(500).json(response.message);
				}else{
						
						self.database.getObject(self.collectionName,{id:assetid},function(err,assetObject){
					
					if(err!=null){
						res.status(500).json(err.message);
						
					}else{
						
						if(assetObject==null){
							
							var arr = []
							var txRecord = {
								"id":response.message,
								"task":"createasset",
								"time":Date.now()
							}
							arr.push(txRecord);
							var assetObject = {
									"id":assetid,
									"tx":arr
							}
							self.database.saveObject(self.collectionName,assetObject,function(message,status){
								
								if(status){
									res.status(200).json(assetObject);
								}else{
									res.status(500).json("Server error!! please try after some time");
								}
								
							});
							
						}else{
							res.status(500).json("Asset with id "+assetid+" already exits!!");
						}
							
					}
					});


				}
				
			}
		})
	}
	
	editAsset(req, res, next){
		
		console.log("***************EDIT ASSETS *************");
		
		var self = this;
		
		var assetid = req.body.asset.id;
		var metadata = req.body.asset.metadata;
		
		var org = req.user.org;

		self.blockchainconnector.invokeChaincode(NETWORK_CONFIG,org,"updateasset",[assetid.toString(),metadata.toString()],function(err,response){
			
			if(err!=null){
				res.status(500).json(err.message);
			}else{
				
				if(response.status=="FAILURE"){
					res.status(500).json(response.message);
				}else{

					self.database.getObject(self.collectionName,{id:assetid},function(err,assetObject){
					
						if(err!=null){
							res.status(500).json(err.message);
							
						}else{
							
							if(assetObject!=null){
								
								var arr = assetObject[0].tx
								var txRecord = {
									"id":response.message,
									"task":"updateasset",
									"time":Date.now()
								}
								arr.push(txRecord);
								var assetObject = {
										"id":assetid,
										"tx":arr
								}
								self.database.updateObject(self.collectionName,{id:assetid},assetObject,function(message,status){
									
									if(status){
										res.status(200).json(assetObject);
									}else{
										res.status(500).json("Server error!! please try after some time");
									}
									
								});
								
							}else{
								res.status(500).json("Asset with id "+id+" doesnt exits!!");
							}
								
						}
					});


				}
				
			}
		})
	}
	
	transferAsset(req, res, next){
		
		console.log("***************TRANSFER ASSETS *************");
		
		var self = this;
		
		var assetid = req.body.asset.id;
		var newowner = req.body.asset.newowner;
		
		var org = req.user.org;
		console.log("org: ",org)
		self.blockchainconnector.invokeChaincode(NETWORK_CONFIG,org,"transferasset",[assetid.toString(),newowner.toString()],function(err,response){
			
			if(err!=null){
				res.status(500).json(err.message);
			}else{
				
				console.log("response: ",response)
				if(response.status=="FAILURE"){
					res.status(500).json(response.message);
				}else{
					
					self.database.getObject(self.collectionName,{id:assetid},function(err,assetObject){
						
						if(err!=null){
							res.status(500).json(err.message);
							
						}else{
							
							if(assetObject!=null){
								
								console.log(assetObject[0])
								var arr = assetObject[0].tx
								var txRecord = {
									"id":response.message,
									"task":"transferasset",
									"time":Date.now()
								}
								arr.push(txRecord);
								var assetObject = {
										"id":assetid,
										"tx":arr
								}
								self.database.updateObject(self.collectionName,{id:assetid},assetObject,function(message,status){
									
									if(status){
										res.status(200).json(assetObject);
									}else{
										res.status(500).json("Server error!! please try after some time");
									}
									
								});
								
							}else{
								res.status(500).json("Asset with id "+id+" doesnt exits!!");
							}

						}
					});
				}
				
			}
		})
	}
}
module.exports = Asset;
