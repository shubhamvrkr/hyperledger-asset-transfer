"use strict";
class Asset {

    constructor (db,bc) {
		
        this.database = db;
		this.collectionName = "assets";
		this.blockchainconnector = bc;
	}
		
	getAssetByOrg(req, res, next){
		
		console.log("***************GET ASSETS BY ORG*************);
		
		var self = this;
		
		var org = req.user.org;
		console.log("org: ",org);
		
		self.blockchainconnector.queryChaincode(NETWORK_CONFIG,org,"getassetbyorg",[org],function(err,result){
			
				if(err!=null){
					res.status(500).json(err.message);
				}
				var promises = [];
				
				for(var assetid in result){
					
					promises.push(return new Promise((resolve, reject)=>{
							self.blockchainconnector.queryChaincode(NETWORK_CONFIG,org,"getassetdetails",[assetid],function(err,assetDetails){
								
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
												if(org==null){
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
		
		console.log("***************GET ASSETS HISTORY*************);
		var assetid = req.params.assetid;
		var org = req.user.org;
		
		console.log("assetID: ",assetid);
		console.log("org: ",org);
		
		self.blockchainconnector.queryChaincode(NETWORK_CONFIG,org,"getassethistory",[assetid],function(err,result){
				if(err!=null){
					
					res.status(500).json(err.message);
				}
				res.status(200).json(result);
		});
		
	}
	
	
	createAsset(req, res, next){
		
		console.log("***************CREATE ASSETS *************);
		
		var self = this;
		
		var assetid = req.body.asset.id;
		var parents = req.body.asset.parents;
		var metadata = req.body.asset.metadata;
		
		self.blockchainconnector.invokeChaincode(NETWORK_CONFIG,org,"createasset",[assetid,metadata,parents],function(err,response){
			
			if(err!=null){
				res.status(500).json(err.message);
			}else{
				
				if(response==null){
					res.status(500).json("Transaction failed!! Please try after some time!!");
				}
				self.database.getObject(self.collectionName,{id:assetid},function(err,assetObject){
					
					if(err!=null){
						res.status(500).json(err.message);
						
					}else{
						
						if(assetObject==null){
							
							var arr = []
							var txRecord = {
								"id":response,
								"task":"createasset"
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
							res.status(500).json("Asset with id "+id+" already exits!!");
						}
							
					}
				}
			}
		})
	}
	
	
	editAsset(req, res, next){
		
		console.log("***************EDIT ASSETS *************);
		
		var self = this;
		
		var assetid = req.body.asset.id;
		var metadata = req.body.asset.metadata;
		
		self.blockchainconnector.invokeChaincode(NETWORK_CONFIG,org,"editeasset",[assetid,metadata],function(err,response){
			
			if(err!=null){
				res.status(500).json(err.message);
			}else{
				
				if(response==null){
					res.status(500).json("Transaction failed!! Please try after some time!!");
				}
				self.database.getObject(self.collectionName,{id:assetid},function(err,assetObject){
					
					if(err!=null){
						res.status(500).json(err.message);
						
					}else{
						
						if(assetObject!=null){
							
							var arr = assetObject.tx
							var txRecord = {
								"id":response,
								"task":"editasset"
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
				}
			}
		})
	}
	
	
	transferAsset(req, res, next){
		
		console.log("***************TRANSFER ASSETS *************);
		
		var self = this;
		
		var assetid = req.body.asset.id;
		var newowner = req.body.asset.newowner;
		
		self.blockchainconnector.invokeChaincode(NETWORK_CONFIG,org,"transfereasset",[assetid,newowner],function(err,response){
			
			if(err!=null){
				res.status(500).json(err.message);
			}else{
				
				if(response==null){
					res.status(500).json("Transaction failed!! Please try after some time!!");
				}
				self.database.getObject(self.collectionName,{id:assetid},function(err,assetObject){
					
					if(err!=null){
						res.status(500).json(err.message);
						
					}else{
						
						if(assetObject!=null){
							
							var arr = assetObject.tx
							var txRecord = {
								"id":response,
								"task":"transferasset"
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
				}
			}
		})
	}

	
}
module.exports = Asset;
