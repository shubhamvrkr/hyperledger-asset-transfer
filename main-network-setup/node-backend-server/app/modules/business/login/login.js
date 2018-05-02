"use strict";
class Login {

    constructor (db) {
        this.database = db;
		this.collectionName = "organization";
		
	}
	register(req, res, next){
		
		console.log("***************REGISTER API CALLED*************");
		var self = this;
		var username = req.body.username;
		var password = req.body.password;
		var organization = req.body.organization;
		
		console.log("username: ",username);
		console.log("password: ",password);
		console.log("organization: ",organization);
		
		var salt = bcrypt.genSaltSync(10);
		var passhash = bcrypt.hashSync(password, salt);
		
		self.database.getObject(self.collectionName,{id:username},function(err,orgObject){
			
			if(err){
				res.status(500).json(err.message);
			}
			
			if(orgObject!=null){
				
				console.log('orgDetails: ',orgObject[0]);
				res.status(409).json("Organization / Admin already exists!!");
			
			}else{
				
				var orgObject = {
					"id":username,
					"passhash":passhash,
					"organization":organization,
				}
				self.database.saveObject(self.collectionName,orgObject,function(message,status){
					
					if(status){
						res.status(200).json("Organization / Admin added successfully");
					}else{
					
						res.status(500).json("Server error!! please try after some time");
					}
					
				});
			}
		});
	}
	
	login(req, res, next){
		
		console.log("***************LOGIN API CALLED*************");
		var self = this;
		var username = req.body.username;
		var password = req.body.password;
		
		console.log("username: ",username);
		console.log("password: ",password);
		
		self.database.getObject(self.collectionName,{id:username},function(err,org){
			
			if(err){
				res.status(500).json(err.message);
				
			}else{
				
				if(org==null){
					
					res.status(422).json({message:"kindly check the provided username/credentials!!"});
		
				}else{
				
					org = org[0];
					console.log("passhash from db: ",org.passhash);
					console.log("passhash: ",password)
					if(bcrypt.compareSync(password, org.passhash)){
						
						 var payload = {id: org.id, org:org.organization, role:"ADMIN"};
						 var token = jwt.sign(payload, jwtOptions.secretOrKey);
						 res.status(200).json({message: "ok", data:{user:{"username":org.id,"organization":org.organization},token: token}});
						
						
					}else{
						
						res.status(422).json({message:"kindly check the provided username/credentials!!"});
					}
				
				}
			}
		});
	}
}
module.exports = Login;
