"use strict";
class Organization {

    constructor (db) {
        this.database = db;
		this.collectionName = "organization";
		
	}
	
	getOrgs(req, res, next){
		
		console.log("***************GET ALL ORGS*************");
		var self = this;
		var fields ={
			_id:false,
			passhash:false
		}
		self.database.getObjects(self.collectionName,fields,function(err,results){

			if(err){
				console.log(err.message);
				res.status(500).json(err.message);
			}else{
				res.status(200).json(results);
			}
		})
	}
}
module.exports = Organization;
