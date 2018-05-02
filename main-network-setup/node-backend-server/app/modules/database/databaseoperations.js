"use strict";
class DatabaseConnector {

	
    constructor (host,port) {
       var self  =this;
	   //initialize the connection with the database
	  // console.log(host+":"+port+"/test")
	   MongoClient.connect(host+":"+port+"/assetmanagement", function(err, db) {
		   
			if(err){
				console.log("error: ",err)
			}else{
				
				//console.log("database connected")
				self.db = db;
				//create required collections
				db.createCollection("organization", function(err, res) {
					if(err){
						console.log("error: ",err)
					}
					db.createCollection("assets", function(err, res) {
						if(err){
							console.log("error: ",err)
						}
					});
				});
			}
	   });
    }
	
	getObject(collectionname,obj,callback){
		
		 var collection = this.db.collection(collectionname);
		 collection.find(obj).toArray(function(err, doc){
			if(err!=null){
				callback(err,null)
				
			}else{
				if(doc.length>0) 
				{
					callback(null,doc)
				}
				else{
					callback(null,null)
				}
			}			
			
		});
		
	}
	
	saveObject(collectionname,obj,callback){
		
		 var collection = this.db.collection(collectionname);
		 collection.insertOne(obj, function(err,result){
			 if(err){
				 callback(err,false)
			 }
			 callback(result.insertedId,true)
		 });
	}
	
	getObjects(collectionname,obj,callback){
		
		var collection = this.db.collection(collectionname)
		collection.find({},obj).toArray(function(err, result) {
			if (err){
				callback(err,null)
			}else{
				callback(null,result)
			}
			
		})
		
	}
	
	updateObject(collectionname,oldObj,newObj,callback){
		
		var collection = this.db.collection(collectionname)
		collection.updateOne(oldObj,newObj,{upsert:false},function(err,res){
		
			if (err){
				callback(err,false)
			}else{
				callback(null,true)
			}
		});
		
	}	
}
module.exports = DatabaseConnector;
